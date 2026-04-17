/**
 * 3ds Max 최적화 OBJ 변환기 (V3 - Multiple Layers)
 * 오목한(Concave) 건물에서도 면이 깨지지 않도록 N-Gon 방식을 채택하고
 * 도로 데이터(LineString -> Polygon Strips) 지원 추가
 */

export const generateObjFile = (data, center) => {
  // data is expected to be { buildings: [], roads: [] }
  const { buildings = [], roads = [] } = data;
  
  if (!center) return '';

  let lines = [];
  lines.push('# Vworld 3D Optimized for 3ds Max (N-Gon Version)');
  lines.push('s off'); // 면이 뭉개지지 않도록 설정

  const originLat = center.lat;
  const originLng = center.lng;
  const degToMeterLat = 111000;
  const degToMeterLng = 111000 * Math.cos((originLat * Math.PI) / 180);

  let vertexCount = 1;

  // 1. 건물 변환
  if (buildings.length > 0) {
    lines.push('\ng Buildings');
    buildings.forEach((feature, index) => {
      const props = feature.properties || {};
      const bldName = props.BLD_NM || props.bld_nm || props.A11 || `Building_${index}`;
      
      let height = 15;
      if (props.A18 && parseFloat(props.A18) > 0) height = parseFloat(props.A18);
      else if (props.bld_hgt && parseFloat(props.bld_hgt) > 0) height = parseFloat(props.bld_hgt);
      else if (props.gro_flo_co && parseInt(props.gro_flo_co) > 0) height = parseInt(props.gro_flo_co) * 3.5;

      const geom = feature.geometry;
      if (!geom || !geom.coordinates) return;

      let rings = [];
      if (geom.type === 'Polygon') {
        rings = geom.coordinates;
      } else if (geom.type === 'MultiPolygon') {
        rings = geom.coordinates.map(poly => poly[0]);
      }

      rings.forEach((ring) => {
        // 중복 정점 완벽 제거
        let cleanRing = [];
        const seen = new Set();
        ring.forEach(([lng, lat]) => {
          const key = `${lng.toFixed(8)},${lat.toFixed(8)}`;
          if (!seen.has(key)) {
            cleanRing.push([lng, lat]);
            seen.add(key);
          }
        });

        const count = cleanRing.length;
        if (count < 3) return;

        const baseStart = vertexCount;
        const topStart = vertexCount + count;

        // 바닥(y=0)
        cleanRing.forEach(([lng, lat]) => {
          const x = (lng - originLng) * degToMeterLng;
          const z = -(lat - originLat) * degToMeterLat;
          lines.push(`v ${x.toFixed(4)} 0.0000 ${z.toFixed(4)}`);
        });
        // 천장(y=height)
        cleanRing.forEach(([lng, lat]) => {
          const x = (lng - originLng) * degToMeterLng;
          const z = -(lat - originLat) * degToMeterLat;
          lines.push(`v ${x.toFixed(4)} ${height.toFixed(4)} ${z.toFixed(4)}`);
        });

        // 면(Faces) 생성
        // 옆면 (Side Quads)
        for (let i = 0; i < count; i++) {
          const next = (i + 1) % count;
          lines.push(`f ${baseStart + i} ${baseStart + next} ${topStart + next} ${topStart + i}`);
        }

        // 지붕 (N-Gon Top)
        const topFace = [];
        for (let i = 0; i < count; i++) {
          topFace.push(topStart + i);
        }
        lines.push(`f ${topFace.join(' ')}`);

        // 바닥 (N-Gon Bottom)
        const bottomFace = [];
        for (let i = count - 1; i >= 0; i--) {
          bottomFace.push(baseStart + i);
        }
        lines.push(`f ${bottomFace.join(' ')}`);

        vertexCount += count * 2;
      });
    });
  }

  // 2. 도로 변환 (Spline/Line 방식)
  if (roads.length > 0) {
    lines.push('\ng Roads');
    roads.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) return;

      const lineGroup = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;

      lineGroup.forEach((coords) => {
        if (coords.length < 2) return;
        
        const startVertex = vertexCount;
        const h = 0.1; // 지면에서 10cm 높이 (Spline 시인성)

        // 모든 정점 생성
        coords.forEach(([lng, lat]) => {
          const x = (lng - originLng) * degToMeterLng;
          const z = -(lat - originLat) * degToMeterLat;
          lines.push(`v ${x.toFixed(4)} ${h} ${z.toFixed(4)}`);
          vertexCount++;
        });

        // 연속 라인(l) 생성
        const indices = [];
        for (let i = 0; i < coords.length; i++) {
          indices.push(startVertex + i);
        }
        lines.push(`l ${indices.join(' ')}`);
      });
    });
  }

  return lines.join('\n');
};

export const downloadObjFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
