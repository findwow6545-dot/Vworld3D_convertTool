/**
 * 3ds Max 최적화 OBJ 변환기 (Raw Data Version)
 * 건물: 황금 버전 V1 로직으로 복구 (꼬임 없음)
 * 도로: 사각면이 아닌 OBJ Line(선)으로 추출 (맥스에서 Spline으로 인식)
 */

export const generateObjFile = (data, centerCoord) => {
  const { buildings = [], roads = [] } = data;
  if (!centerCoord) return '';

  let obj = "# VWORLD 3D RAW EXTRACTOR\ns off\n";
  let vCount = 1;

  // 35.1도(광주) 기준 정밀 변환
  const latScale = 111000;
  const lngScale = 111000 * Math.cos((centerCoord.lat * Math.PI) / 180);

  const toM = (lng, lat) => ({
    x: (lng - centerCoord.lng) * lngScale,
    z: -(lat - centerCoord.lat) * latScale 
  });

  // 1. 건물 (사용자가 검증했던 황금 버전 V1 방식)
  buildings.forEach((f, idx) => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

    const ring = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : 
                 f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring || ring.length < 3) return;

    // GeoJSON 끝점 제거 (중복 방지)
    const cleanPts = ring.slice(0, -1).map(c => toM(c[0], c[1]));
    const n = cleanPts.length;

    obj += `g Building_${idx}\n`;
    // 정점 생성
    cleanPts.forEach(p => { obj += `v ${p.x.toFixed(4)} 0.0000 ${p.z.toFixed(4)}\n`; });
    cleanPts.forEach(p => { obj += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${p.z.toFixed(4)}\n`; });

    // 옆면 생성
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      obj += `f ${vCount + i} ${vCount + next} ${vCount + n + next} ${vCount + n + i}\n`;
    }
    // 지붕 및 바닥
    obj += `f ${Array.from({length: n}, (_, i) => vCount + n + i).join(' ')}\n`;
    obj += `f ${Array.from({length: n}, (_, i) => vCount + i).reverse().join(' ')}\n`;

    vCount += n * 2;
  });

  // 2. 도로 (사각면이 아닌 Line 방식 - 맥스에서 Spline으로 활용)
  if (roads.length > 0) {
    obj += "\ng Roads_Splines\n";
    roads.forEach((f, idx) => {
      const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : 
                    f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
      
      lines.forEach((coords) => {
        if (!coords || coords.length < 2) return;
        
        const currentLineVertices = [];
        coords.forEach(([lng, lat]) => {
          const p = toM(lng, lat);
          obj += `v ${p.x.toFixed(4)} 0.0500 ${p.z.toFixed(4)}\n`; // 바닥 위 5cm
          currentLineVertices.push(vCount);
          vCount++;
        });

        // OBJ 라인 요소 생성
        obj += `l ${currentLineVertices.join(' ')}\n`;
      });
    });
  }

  return obj;
};

export const downloadObjFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
