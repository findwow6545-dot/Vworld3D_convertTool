/**
 * Vworld 3D Extractor - Rock Solid OBJ Converter
 * 안전하고 가장 확실했던 방식(단순 1:1 매칭)으로 
 * 건물과 도로 데이터를 변환합니다.
 */

export const generateObjFile = (data, centerCoord) => {
  const buildings = data.buildings || [];
  const roads = data.roads || [];

  if (!centerCoord) return '';

  let objOutput = "# VWORLD 3D EXTRACTOR - Rock Solid Version\n# Y-UP Coordinate System\n";
  let vCount = 1;

  // 도 단위 좌표를 미터 단위로 변환 (중심점 기준)
  const toMeter = (lng, lat) => {
    const x = (lng - centerCoord.lng) * 88800; // 대략적인 경도->미터
    const y = (lat - centerCoord.lat) * 111000; // 대략적인 위도->미터
    return { x, y };
  };

  // 1. 건물 변환 (가장 안정적이었던 초기 버전 로직)
  if (buildings.length > 0) {
    objOutput += "\ng Buildings\n";
    buildings.forEach((f, idx) => {
      let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
      if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

      // 항상 첫 번째 링만 사용 (오류 방지)
      let coords = null;
      if (f.geometry && f.geometry.type === 'Polygon') {
        coords = f.geometry.coordinates[0];
      } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
        coords = f.geometry.coordinates[0][0];
      }
      
      if (!coords || coords.length < 3) return;

      const vertices = coords.map(c => toMeter(c[0], c[1]));
      
      objOutput += `g Building_${idx}\n`;
      
      // 바닥/천장 정점 생성
      vertices.forEach(v => { objOutput += `v ${v.x.toFixed(4)} 0.0000 ${(-v.y).toFixed(4)}\n`; });
      vertices.forEach(v => { objOutput += `v ${v.x.toFixed(4)} ${h.toFixed(4)} ${(-v.y).toFixed(4)}\n`; });

      const n = vertices.length;
      
      // 바닥면 
      objOutput += `f ${Array.from({length: n}, (_, i) => vCount + i).join(' ')}\n`;
      // 천장면 (뒤집어서)
      objOutput += `f ${Array.from({length: n}, (_, i) => vCount + n + i).reverse().join(' ')}\n`;
      
      // 옆면 루프 (GeoJSON은 끝점과 첫점이 같으므로 n-1까지만 이어줌)
      for (let i = 0; i < n - 1; i++) {
        objOutput += `f ${vCount + i} ${vCount + i + 1} ${vCount + n + i + 1} ${vCount + n + i}\n`;
      }
      vCount += n * 2;
    });
  }

  // 2. 도로 변환 (안정성 극대화)
  if (roads.length > 0) {
    objOutput += "\ng Roads\n";
    roads.forEach((f, idx) => {
      if (!f.geometry) return;
      
      let linesArray = [];
      if (f.geometry.type === 'LineString') {
        linesArray = [f.geometry.coordinates];
      } else if (f.geometry.type === 'MultiLineString') {
        linesArray = f.geometry.coordinates; // 여러 라인이 들어있음
      }
      
      linesArray.forEach((coords, lIdx) => {
        if (!coords || coords.length < 2) return;
        
        objOutput += `g Road_${idx}_${lIdx}\n`;
        const roadWidth = 6.0; // 기본 도로폭

        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = toMeter(coords[i][0], coords[i][1]);
          const p2 = toMeter(coords[i+1][0], coords[i+1][1]);
          
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len === 0) continue;
          
          const nx = (-dy / len) * (roadWidth / 2);
          const ny = (dx / len) * (roadWidth / 2);

          const h = 0.05; // 바닥 위 5cm
          // 반시계 방향으로 꼭지점 4개 정렬
          objOutput += `v ${(p1.x - nx).toFixed(4)} ${h} ${(-(p1.y - ny)).toFixed(4)}\n`; // 꼭지점 1
          objOutput += `v ${(p1.x + nx).toFixed(4)} ${h} ${(-(p1.y + ny)).toFixed(4)}\n`; // 꼭지점 2
          objOutput += `v ${(p2.x + nx).toFixed(4)} ${h} ${(-(p2.y + ny)).toFixed(4)}\n`; // 꼭지점 3
          objOutput += `v ${(p2.x - nx).toFixed(4)} ${h} ${(-(p2.y - ny)).toFixed(4)}\n`; // 꼭지점 4
          
          objOutput += `f ${vCount} ${vCount+1} ${vCount+2} ${vCount+3}\n`;
          vCount += 4;
        }
      });
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
