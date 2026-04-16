/**
 * 3ds Max 최적화 OBJ 변환기 (Solid Data Version)
 * 건물: 검증된 황금 버전 V1 로직 (최적화)
 * 도로: 맥스에서 안보이는 Line 대신, 10cm 두께의 얇은 3D 판(Face)으로 추출
 */

export const generateObjFile = (data, centerCoord) => {
  const { buildings = [], roads = [] } = data;
  if (!centerCoord) return '';

  let obj = "# VWORLD 3D SOLID EXTRACTOR\ns off\n";
  let vCount = 1;

  // 광주 지점 정밀 계수
  const latScale = 111000;
  const lngScale = 111000 * Math.cos((centerCoord.lat * Math.PI) / 180);

  const toM = (lng, lat) => ({
    x: (lng - centerCoord.lng) * lngScale,
    z: -(lat - centerCoord.lat) * latScale 
  });

  // 1. 건물 (검증된 방식)
  buildings.forEach((f, idx) => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

    const ring = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : 
                 f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring || ring.length < 3) return;

    const cleanPts = ring.slice(0, -1).map(c => toM(c[0], c[1]));
    const n = cleanPts.length;

    obj += `g Building_${idx}\n`;
    cleanPts.forEach(p => { obj += `v ${p.x.toFixed(4)} 0.0000 ${p.z.toFixed(4)}\n`; });
    cleanPts.forEach(p => { obj += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${p.z.toFixed(4)}\n`; });

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      obj += `f ${vCount + i} ${vCount + next} ${vCount + n + next} ${vCount + n + i}\n`;
    }
    obj += `f ${Array.from({length: n}, (_, i) => vCount + n + i).join(' ')}\n`;
    obj += `f ${Array.from({length: n}, (_, i) => vCount + i).reverse().join(' ')}\n`;
    vCount += n * 2;
  });

  // 2. 도로 (맥스에서 확실히 보이는 3D 메쉬 방식)
  roads.forEach((f, idx) => {
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : 
                  f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    
    lines.forEach((coords, lIdx) => {
      if (!coords || coords.length < 2) return;
      
      const roadWidth = 8.0; 
      const roadHeight = 0.1; // 10cm 두께 (맥스 가독성 확보)
      obj += `g Road_${idx}_${lIdx}\n`;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = toM(coords[i][0], coords[i][1]);
        const p2 = toM(coords[i+1][0], coords[i+1][1]);
        
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = Math.sqrt(dx*dx + dz*dz);
        if (len < 0.1) continue;

        const nx = (-dz / len) * (roadWidth / 2);
        const nz = (dx / len) * (roadWidth / 2);

        // 도로 마디 하나당 상하좌우 8개의 정점으로 박스 생성
        const h = 0.02; // 지면에서 살짝 띄움
        // 바닥 4점
        obj += `v ${(p1.x - nx).toFixed(4)} ${h} ${(p1.z - nz).toFixed(4)}\n`;
        obj += `v ${(p1.x + nx).toFixed(4)} ${h} ${(p1.z + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x + nx).toFixed(4)} ${h} ${(p2.z + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x - nx).toFixed(4)} ${h} ${(p2.z - nz).toFixed(4)}\n`;
        // 천장 4점
        obj += `v ${(p1.x - nx).toFixed(4)} ${h + roadHeight} ${(p1.z - nz).toFixed(4)}\n`;
        obj += `v ${(p1.x + nx).toFixed(4)} ${h + roadHeight} ${(p1.z + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x + nx).toFixed(4)} ${h + roadHeight} ${(p2.z + nz).toFixed(4)}\n`;
        obj += `v ${(p2.x - nx).toFixed(4)} ${h + roadHeight} ${(p2.z - nz).toFixed(4)}\n`;

        // 옆면 4개
        obj += `f ${vCount} ${vCount+1} ${vCount+5} ${vCount+4}\n`;
        obj += `f ${vCount+1} ${vCount+2} ${vCount+6} ${vCount+5}\n`;
        obj += `f ${vCount+2} ${vCount+3} ${vCount+7} ${vCount+6}\n`;
        obj += `f ${vCount+3} ${vCount} ${vCount+4} ${vCount+7}\n`;
        // 천장면 및 바닥면
        obj += `f ${vCount+4} ${vCount+5} ${vCount+6} ${vCount+7}\n`;
        obj += `f ${vCount+3} ${vCount+2} ${vCount+1} ${vCount}\n`;

        vCount += 8;
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
