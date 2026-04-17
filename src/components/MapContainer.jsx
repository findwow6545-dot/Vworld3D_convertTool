import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const API_KEY = import.meta.env.VITE_VWORLD_API_KEY || '';
const IS_KEY_SET = API_KEY && API_KEY !== 'YOUR_VWORLD_API_KEY_HERE' && API_KEY.trim() !== '';

const MapContainer = forwardRef(({ coord, radius, features, onMapDoubleClick }, ref) => {
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
    } catch (e) { }
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
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
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

  // 🧭 지도 시점 보정 및 가이드 표시
  useEffect(() => {
    if (!viewerRef.current || !coord) return;
    const viewer = viewerRef.current;

    // 💡 더블 클릭 지점이 화면 정중앙에 수평/수직적으로 완벽하게 위치하도록 오프셋 정밀 보정
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        coord.lng + 0.005, // 수평 중앙 정렬을 위해 경도 오프셋 축소
        coord.lat - 0.025, // 수직 중앙 정렬을 위해 위도 오프셋 최적화
        1800              // 피사체가 크게 보이도록 고도 하향 및 중앙 집중
      ),
      orientation: { 
        heading: Cesium.Math.toRadians(340), 
        pitch: Cesium.Math.toRadians(-35),
        roll: 0 
      }
    });

    // 이전 가이드 엔티티 삭제
    viewer.entities.values
      .filter(e => e.rectangle)
      .forEach(e => viewer.entities.remove(e));

    // BBOX 기반 사각형 영역 계산
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

  // 🏛️ 건물 및 도로 3D 시각화
  useEffect(() => {
    if (!viewerRef.current || !features) return;
    const viewer = viewerRef.current;
    const { buildings = [], roads = [] } = features;

    // 기존 데이터 삭제
    viewer.entities.values
      .filter(e => e.polygon || e.polyline)
      .forEach(e => viewer.entities.remove(e));

    // 1. 건물 렌더링
    buildings.forEach((f) => {
      try {
        const geom = f.geometry;
        if (!geom || !geom.coordinates) return;
        const props = f.properties || {};
        const height = parseFloat(props.bld_hgt || 12);

        let polygonCoords = [];
        if (geom.type === 'Polygon') polygonCoords = geom.coordinates[0].flat();
        else if (geom.type === 'MultiPolygon') polygonCoords = geom.coordinates[0][0].flat();

        if (polygonCoords.length < 6) return;

        viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(polygonCoords),
            extrudedHeight: height,
            material: Cesium.Color.fromCssColorString('#FFFFFF'), // 명시적 불투명 흰색 적용
            outline: true,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
          },
          name: props.BLD_NM || '건물',
        });
      } catch (e) { }
    });

    // 2. 도로 렌더링 추가
    roads.forEach((f) => {
      try {
        const geom = f.geometry;
        if (!geom || !geom.coordinates) return;
        if (geom.type === 'LineString') {
          viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(geom.coordinates.flat()),
              width: 3,
              material: Cesium.Color.YELLOW.withAlpha(0.8),
              clampToGround: true
            }
          });
        }
      } catch (e) { }
    });
  }, [features]);

  useImperativeHandle(ref, () => ({
    async captureTopViewImage(filename) {
      if (!viewerRef.current || !coord) return;
      const viewer = viewerRef.current;

      // 1. 기존 엔티티 백업 후 투명화 (건물, 도로, 라인 등 전부 숨김)
      const entities = viewer.entities.values;
      const visibilityStates = entities.map(e => e.show);
      entities.forEach(e => { e.show = false; });

      // 2. 현재 카메라 시점 백업
      const cachedCamera = {
        position: viewer.camera.position.clone(),
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      };

      // 3. 순수 위성지도 탑 뷰(Top-Down) 설정
      // 영역 확장 캡처를 위해 카메라를 더 멀리 둡니다. (영역이 더 넓게 잡히도록 4000 적용)
      const altitude = radius * 4000;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(coord.lng, coord.lat, altitude),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
      });

      // 4. 고해상도 타일 로딩 대기 후 캡처 실시
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            viewer.render(); // 강제 최신 프레임 렌더링

            // 추출 반경 기반 BBOX (빨간 사각형 영역) 계산
            const latDeg = radius / 111.32;
            const lngDeg = radius / (111.32 * Math.cos(coord.lat * (Math.PI / 180)));
            const west = coord.lng - lngDeg;
            const south = coord.lat - latDeg;
            const east = coord.lng + lngDeg;
            const north = coord.lat + latDeg;

            // 북서쪽(Top-Left)과 남동쪽(Bottom-Right) 월드 좌표
            const nwCart = Cesium.Cartesian3.fromDegrees(west, north, 0);
            const seCart = Cesium.Cartesian3.fromDegrees(east, south, 0);

            // 월드 좌표를 현재 화면의 CSS 픽셀 좌표로 변환
            const nwPixel = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, nwCart);
            const sePixel = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, seCart);

            if (!nwPixel || !sePixel) {
               throw new Error("캡처 대상 영역이 화면을 벗어났습니다.");
            }

            // 정확한 모델 비율(WebGL intrinsic 대 CSS 픽셀)을 구함 (devicePixelRatio 오류 방지)
            const scaleX = viewer.scene.canvas.width / viewer.scene.canvas.clientWidth;
            const scaleY = viewer.scene.canvas.height / viewer.scene.canvas.clientHeight;

            const px = Math.min(nwPixel.x, sePixel.x) * scaleX;
            const py = Math.min(nwPixel.y, sePixel.y) * scaleY;
            
            // 물리적인 정사각형 픽셀 사이즈 유지 보장 (기준 건물 반경)
            let pw = Math.abs(sePixel.x - nwPixel.x) * scaleX;
            let ph = Math.abs(sePixel.y - nwPixel.y) * scaleY;
            const baseSize = Math.max(pw, ph); 

            // 건물 영역보다 더 많이 나오게 확장 (예: 1.6배 널찍하게 캡처)
            const expandFactor = 1.6;
            const cropSize = baseSize * expandFactor;

            // 중심을 기준으로 확장된 정사각형(Square) 크롭 영역 재정렬
            const cx = px + (pw / 2);
            const cy = py + (ph / 2);
            const finalPx = Math.floor(cx - (cropSize / 2));
            const finalPy = Math.floor(cy - (cropSize / 2));

            // 2000px 고정을 해제하고, 추출된 엄청난 크기의 실제 원본 픽셀 크기 적용
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropSize;
            cropCanvas.height = cropSize;
            const ctx = cropCanvas.getContext('2d');
            
            // 이미지 보간 속성 (고품질)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // 오리지널 렌더링된 거대 영역을 그대로 리사이징 없이 원상태로 맵핑
            ctx.drawImage(
              viewer.scene.canvas,
              finalPx, finalPy, cropSize, cropSize,  // Source 영역 (확장된 정사각형)
              0, 0, cropSize, cropSize               // Destination (최대 원본 크기)
            );

            // 최종 JPG 이미지 생성 및 다운로드 (압축률 100%)
            const dataUrl = cropCanvas.toDataURL('image/jpeg', 1.0);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            link.click();
            resolve();
          } catch(e) {
            reject(e);
          } finally {
            // 5. 모든 엔티티 및 카메라 원래대로 복구
            entities.forEach((e, i) => { e.show = visibilityStates[i]; });
            viewer.camera.setView({
              destination: cachedCamera.position,
              orientation: {
                heading: cachedCamera.heading,
                pitch: cachedCamera.pitch,
                roll: cachedCamera.roll
              }
            });
          }
        }, 1500); // 1.5초 대기
      });
    }
  }));

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default MapContainer;
