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

  // 2. 도로 변환
  if (roads.length > 0) {
    lines.push('\ng Roads');
    roads.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom || geom.type !== 'LineString' || !geom.coordinates) return;
      const coords = geom.coordinates;
      const roadWidth = 6.0; // 6미터 폭

      for (let i = 0; i < coords.length - 1; i++) {
        const x1 = (coords[i][0] - originLng) * degToMeterLng;
        const z1 = -(coords[i][1] - originLat) * degToMeterLat;
        const x2 = (coords[i+1][0] - originLng) * degToMeterLng;
        const z2 = -(coords[i+1][1] - originLat) * degToMeterLat;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.sqrt(dx*dx + dz*dz);
        if (len === 0) continue;

        const nx = (-dz / len) * (roadWidth / 2);
        const nz = (dx / len) * (roadWidth / 2);

        const h = 0.05; // 지면 위 5cm
        lines.push(`v ${(x1 - nx).toFixed(4)} ${h} ${(z1 - nz).toFixed(4)}`);
        lines.push(`v ${(x1 + nx).toFixed(4)} ${h} ${(z1 + nz).toFixed(4)}`);
        lines.push(`v ${(x2 + nx).toFixed(4)} ${h} ${(z2 + nz).toFixed(4)}`);
        lines.push(`v ${(x2 - nx).toFixed(4)} ${h} ${(z2 - nz).toFixed(4)}`);

        lines.push(`f ${vertexCount} ${vertexCount+1} ${vertexCount+2} ${vertexCount+3}`);
        vertexCount += 4;
      }
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
