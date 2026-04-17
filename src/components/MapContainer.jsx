import { useEffect, useRef } from 'react';

const API_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const IS_KEY_SET = API_KEY && API_KEY !== 'YOUR_VWORLD_API_KEY_HERE' && API_KEY.trim() !== '';

export default function MapContainer({ coord, radius, features, onMapDoubleClick }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioContext.createOscillator();
      const g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(523.25, audioContext.currentTime);
      o.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.1);
      g.gain.setValueAtTime(0.05, audioContext.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      o.start(); o.stop(audioContext.currentTime + 0.5);
    } catch (e) {}
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. 기본 배경 레이어 (OSM)
    const viewer = new Cesium.Viewer(containerRef.current, {
      imageryProvider: new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/'
      }),
      baseLayerPicker: false, geocoder: false, homeButton: false, infoBox: false,
      sceneModePicker: false, selectionIndicator: false, timeline: false,
      navigationHelpButton: false, animation: false, scene3DOnly: true,
    });

    // 2. 브이월드 레이어 (성공 시 중첩)
    if (IS_KEY_SET) {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}/Satellite/{z}/{y}/{x}.jpeg`,
          maximumLevel: 18,
          credit: '© VWORLD'
        })
      );
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}/Hybrid/{z}/{y}/{x}.png`,
          maximumLevel: 18,
        })
      );
    }

    viewer.scene.globe.showGroundAtmosphere = false;

    // 🇰🇷 초기 시점: 대한민국이 한눈에 들어오는 높이로 설정
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(127.5, 36.5, 1500000), // 경도, 위도, 높이(미터)
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      }
    });

    // 3. 더블 클릭 이벤트 핸들러 추가
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        onMapDoubleClick?.(lat, lng);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    viewerRef.current = viewer;

    return () => { 
      handler.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy(); 
    };
  }, []);

  useEffect(() => {
    if (!viewerRef.current || !coord) return;
    const viewer = viewerRef.current;
    
    // 줌인 시점 중앙 보정 (오프셋 없이 정중앙에 위치)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(coord.lng, coord.lat, 1000), // 높이 1000m에서 정적으로 내려다봄
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
    });
    
    // 이전 가이드 엔티티 삭제
    viewer.entities.values
      .filter(e => e.rectangle)
      .forEach(e => viewer.entities.remove(e));

    // BBOX 기반 사각형 영역 계산 (vworldApi 로직과 동일)
    const latDeg = radius / 111.32;
    const lngDeg = radius / (111.32 * Math.cos(coord.lat * (Math.PI / 180)));
    const west = coord.lng - lngDeg;
    const south = coord.lat - latDeg;
    const east = coord.lng + lngDeg;
    const north = coord.lat + latDeg;

    viewer.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
        material: Cesium.Color.RED.withAlpha(0.1),
        outline: true,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 4.0
      },
      name: '추출 영역'
    });
  }, [coord, radius]);

  // 🏛️ 건물 데이터 3D 시각화 (에러 방지 강화)
  useEffect(() => {
    if (!viewerRef.current || !features || features.length === 0) return;
    const viewer = viewerRef.current;

    // 기존 건물들만 삭제
    viewer.entities.values
      .filter(e => e.polygon)
      .forEach(e => viewer.entities.remove(e));

    features.forEach((f) => {
      try {
        const geom = f.geometry;
        if (!geom || !geom.coordinates) return;

        const props = f.properties || {};
        const height = parseFloat(props.A18 || props.bld_hgt || (props.gro_flo_co * 3.5) || 12);

        // Polygon 또는 MultiPolygon 대응 및 유효성 검사 강화
        let rawCoords = [];
        if (geom.type === 'Polygon') {
          rawCoords = geom.coordinates[0];
        } else if (geom.type === 'MultiPolygon') {
          rawCoords = geom.coordinates[0][0];
        }

        // 1차원 배열로 펼치기 및 숫자 유효성 검사
        const polygonCoords = rawCoords
          .flat()
          .map(Number)
          .filter(n => !isNaN(n));

        // 좌표는 반드시 경도, 위도 쌍(2개씩)이어야 하므로 짝수여야 함
        if (polygonCoords.length < 6 || polygonCoords.length % 2 !== 0) {
          console.warn('부적절한 좌표 배열 스킵:', polygonCoords.length);
          return;
        }

        viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(polygonCoords),
            extrudedHeight: height,
            material: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.6),
            outline: true,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.3),
          },
          name: props.BLD_NM || '건물',
        });
      } catch (err) {
        console.warn('건물 렌더링 스킵:', err.message);
      }
    });
  }, [features]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
