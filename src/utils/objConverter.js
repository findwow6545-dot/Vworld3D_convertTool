/**
 * 3ds Max 최적화 OBJ 변환기 (Final Pro Version)
 * 건물 정점 꼬임 방지 및 도로 교차로 연결(Overlap) 강화
 */

export const generateObjFile = (data, centerCoord) => {
  const { buildings = [], roads = [] } = data;
  if (!centerCoord) return '';

  let obj = "# VWORLD 3D PRO EXTRACTOR\ns off\n";
  let vCount = 1;

  // 광주 노대동 위도(35.1) 기준 정밀 미터 변환
  const latScale = 111000;
  const lngScale = 111000 * Math.cos((centerCoord.lat * Math.PI) / 180);

  const toM = (lng, lat) => ({
    x: (lng - centerCoord.lng) * lngScale,
    z: -(lat - centerCoord.lat) * latScale // Max의 Z축은 North를 반영
  });

  // 1. 건물 (원본 순서 유지 방식)
  buildings.forEach((f, idx) => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

    const coords = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : 
                   f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!coords || coords.length < 3) return;

    // 꼬임 방지를 위해 원본 순서대로 정점 고정
    const pts = coords.slice(0, -1).map(c => toM(c[0], c[1]));
    const n = pts.length;
    
    obj += `g Building_${idx}\n`;
    // 바닥/천장 정점 생성
    pts.forEach(p => { obj += `v ${p.x.toFixed(4)} 0.0000 ${p.z.toFixed(4)}\n`; });
    pts.forEach(p => { obj += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${p.z.toFixed(4)}\n`; });

    // 옆면 (Quads)
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      obj += `f ${vCount + i} ${vCount + next} ${vCount + n + next} ${vCount + n + i}\n`;
    }
    // 지붕
    obj += `f ${Array.from({length: n}, (_, i) => vCount + n + i).join(' ')}\n`;
    // 바닥
    obj += `f ${Array.from({length: n}, (_, i) => vCount + i).reverse().join(' ')}\n`;
    
    vCount += n * 2;
  });

  // 2. 도로 (연장선 Overlap 방식)
  roads.forEach((f, idx) => {
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : 
                  f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    
    lines.forEach((coords, lIdx) => {
      const roadWidth = 8.0; // 8미터 광폭 도로 설정
      obj += `g Road_${idx}_${lIdx}\n`;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = toM(coords[i][0], coords[i][1]);
        const p2 = toM(coords[i+1][0], coords[i+1][1]);
        
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = Math.sqrt(dx*dx + dz*dz);
        if (len < 0.1) continue;

        // 끊김 방지를 위해 양 끝단을 4m씩 더 연장 (Overlap 생성)
        const ex = (dx / len) * 4.0;
        const ez = (dz / len) * 4.0;
        const nx = (-dz / len) * (roadWidth / 2);
        const nz = (dx / len) * (roadWidth / 2);

        const h = 0.05; // 지면 위 5cm
        obj += `v ${(p1.x - ex - nx).toFixed(4)} ${h} ${(p1.z - ez - nz).toFixed(4)}\n`;
        obj += `v ${(p1.x - ex + nx).toFixed(4)} ${h} ${(p1.z - ez + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x + ex + nx).toFixed(4)} ${h} ${(p2.z + ez + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x + ex - nx).toFixed(4)} ${h} ${(p2.z + ez - nz).toFixed(4)}\n`;

        obj += `f ${vCount} ${vCount+1} ${vCount+2} ${vCount+3}\n`;
        vCount += 4;
      }
    });
  });

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
