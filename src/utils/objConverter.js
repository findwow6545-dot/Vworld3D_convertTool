/**
 * Vworld GeoJSON을 3ds Max 호환 OBJ(Y-Up)로 변환
 */
export const generateObjFile = (data, centerCoord) => {
  const { buildings = [], roads = [] } = data;
  let objOutput = "# VWORLD 3D EXTRACTOR\n# Y-UP Coordinate System\ng Buildings\n";
  let vCount = 1;

  // 도 단위 좌표를 미터 단위로 변환 (중심점 기준)
  const toMeter = (lng, lat) => {
    const x = (lng - centerCoord.lng) * 88800; // 대략적인 경도->미터
    const y = (lat - centerCoord.lat) * 111000; // 대략적인 위도->미터
    return { x, y };
  };

  // 1. 건물 변환 (기존 로직 유지)
  buildings.forEach((f) => {
    const height = f.properties.bld_hgt || 12;
    const coords = f.geometry.type === 'Polygon' 
      ? f.geometry.coordinates[0] 
      : f.geometry.coordinates[0][0];

    const vertices = coords.map(c => toMeter(c[0], c[1]));
    
    // 바닥/천장 정점 생성 (Y-Up 적용: Z좌표가 높이가 아닌 Y좌표가 높이가 됨)
    vertices.forEach(v => { objOutput += `v ${v.x.toFixed(4)} 0 ${(-v.y).toFixed(4)}\n`; });
    vertices.forEach(v => { objOutput += `v ${v.x.toFixed(4)} ${height.toFixed(4)} ${(-v.y).toFixed(4)}\n`; });

    const n = vertices.length;
    // N-Gon 면 생성 (Max 호환)
    objOutput += `f ${Array.from({length: n}, (_, i) => vCount + i).join(' ')}\n`; // 바닥
    objOutput += `f ${Array.from({length: n}, (_, i) => vCount + n + i).reverse().join(' ')}\n`; // 천장
    for (let i = 0; i < n - 1; i++) {
      objOutput += `f ${vCount + i} ${vCount + i + 1} ${vCount + n + i + 1} ${vCount + n + i}\n`;
    }
    vCount += n * 2;
  });

  // 2. 도로 변환 (LineString -> Strips)
  if (roads.length > 0) {
    objOutput += "\ng Roads\n";
    roads.forEach((r) => {
      const coords = r.geometry.coordinates; // LineString
      const roadWidth = 6.0; // 기본 도로폭 6m

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = toMeter(coords[i][0], coords[i][1]);
        const p2 = toMeter(coords[i+1][0], coords[i+1][1]);
        
        // 방향 벡터 및 법선 벡터 계산하여 도로폭 확보
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len === 0) continue;
        
        const nx = (-dy / len) * (roadWidth / 2);
        const ny = (dx / len) * (roadWidth / 2);

        // 도로 면 생성 (바닥에 딱 붙게 0.05m 높이)
        const h = 0.05;
        objOutput += `v ${(p1.x - nx).toFixed(4)} ${h} ${(-(p1.y - ny)).toFixed(4)}\n`;
        objOutput += `v ${(p1.x + nx).toFixed(4)} ${h} ${(-(p1.y + ny)).toFixed(4)}\n`;
        objOutput += `v ${(p2.x + nx).toFixed(4)} ${h} ${(-(p2.y + ny)).toFixed(4)}\n`;
        objOutput += `v ${(p2.x - nx).toFixed(4)} ${h} ${(-(p2.y - ny)).toFixed(4)}\n`;
        
        objOutput += `f ${vCount} ${vCount+1} ${vCount+2} ${vCount+3}\n`;
        vCount += 4;
      }
    });
  }

  return objOutput;
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
