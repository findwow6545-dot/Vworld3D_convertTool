/**
 * 3ds Max 최적화 OBJ 변환기 (Precision Spline Version)
 * 건물: 입증된 황금 버전 V1 로직 (최적화)
 * 도로: 박스가 아닌, 원본 "폴리라인(Line)" 날것 그대로 추출
 */

export const generateObjFile = (data, centerCoord) => {
  const { buildings = [], roads = [] } = data;
  if (!centerCoord) return '';

  let obj = "# VWORLD 3D PRECISION EXTRACTOR\ns off\n";
  let vCount = 1;

  const latScale = 111000;
  const lngScale = 111000 * Math.cos((centerCoord.lat * Math.PI) / 180);

  const toM = (lng, lat) => ({
    x: (lng - centerCoord.lng) * lngScale,
    z: -(lat - centerCoord.lat) * latScale 
  });

  // 1. 건물 (기존 성공적인 로직 유지)
  buildings.forEach((f, idx) => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

    const ring = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : 
                 f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring || ring.length < 3) return;

    const pts = ring.slice(0, -1).map(c => toM(c[0], c[1]));
    const n = pts.length;

    obj += `g Building_${idx}\n`;
    pts.forEach(p => { obj += `v ${p.x.toFixed(4)} 0.0000 ${p.z.toFixed(4)}\n`; });
    pts.forEach(p => { obj += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${p.z.toFixed(4)}\n`; });

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      obj += `f ${vCount + i} ${vCount + next} ${vCount + n + next} ${vCount + n + i}\n`;
    }
    obj += `f ${Array.from({length: n}, (_, i) => vCount + n + i).join(' ')}\n`;
    obj += `f ${Array.from({length: n}, (_, i) => vCount + i).reverse().join(' ')}\n`;
    vCount += n * 2;
  });

  // 2. 도로 (순수 폴리라인 - 맥스에서 Spline으로 임포트됨)
  if (roads.length > 0) {
    obj += "\ng Road_Polylines\n";
    roads.forEach((f, idx) => {
      const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : 
                    f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
      
      lines.forEach((coords) => {
        if (!coords || coords.length < 2) return;
        
        const lineIndices = [];
        // 각 노드를 정점으로 기록
        coords.forEach(([lng, lat]) => {
          const p = toM(lng, lat);
          obj += `v ${p.x.toFixed(4)} 0.0100 ${p.z.toFixed(4)}\n`; // 바닥에 붙여서 생성
          lineIndices.push(vCount);
          vCount++;
        });

        // 'l' 명령어로 정점들을 하나의 폴리라인으로 연결
        obj += `l ${lineIndices.join(' ')}\n`;
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
