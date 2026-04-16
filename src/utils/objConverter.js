/**
 * Vworld 3D Extractor - Rock Solid OBJ Converter
 * 안전하고 가장 확실했던 방식(단순 1:1 매칭)으로 
 * 건물과 도로 데이터를 변환합니다.
 */

export const generateObjFile = (data, centerCoord) => {
  const buildings = data.buildings || [];
  const roads = data.roads || [];

  if (!centerCoord) return '';

  let objOutput = "# VWORLD 3D EXTRACTOR - Pro Version\n";
  objOutput += "s off\n"; // 스무딩 제거
  
  let vCount = 1;

  const toMeter = (lng, lat) => {
    const x = (lng - centerCoord.lng) * 88800; 
    const y = (lat - centerCoord.lat) * 111000; 
    return { x, y };
  };

  // 1. 건물 변환
  if (buildings.length > 0) {
    objOutput += "\ng Buildings\n";
    buildings.forEach((f, idx) => {
      let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
      if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

      let rings = [];
      if (f.geometry && f.geometry.type === 'Polygon') {
        rings = [f.geometry.coordinates[0]]; // 가장 바깥쪽 링만 사용 (오목/볼록 버그 최소화)
      } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
        rings = [f.geometry.coordinates[0][0]];
      }
      
      if (!rings || rings.length === 0) return;

      objOutput += `g Building_${idx}\n`;

      rings.forEach((ring) => {
        // GeoJSON 폴리곤은 첫점과 끝점이 일치함. 끝점 1개를 제거하여 루프 형성.
        // Set을 쓰면 중간에 교차하는 정점 순서까지 파괴되어 "꼬임"이 발생하므로 절대 사용금지.
        let cleanRing = [...ring];
        const first = cleanRing[0];
        const last = cleanRing[cleanRing.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          cleanRing.pop(); // 끝점 제거 (n-1개로 만듦)
        }

        const count = cleanRing.length;
        if (count < 3) return;

        const baseStart = vCount;
        const topStart = vCount + count;

        cleanRing.forEach(([lng, lat]) => {
          const p = toMeter(lng, lat);
          objOutput += `v ${p.x.toFixed(4)} 0.0000 ${(-p.y).toFixed(4)}\n`;
        });
        cleanRing.forEach(([lng, lat]) => {
          const p = toMeter(lng, lat);
          objOutput += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${(-p.y).toFixed(4)}\n`;
        });

        // 옆면 
        for (let i = 0; i < count; i++) {
          const next = (i + 1) % count;
          objOutput += `f ${baseStart + i} ${baseStart + next} ${topStart + next} ${topStart + i}\n`;
        }

        // 지붕/바닥 (N-Gon)
        const topFace = [];
        for (let i = 0; i < count; i++) topFace.push(topStart + i);
        objOutput += `f ${topFace.join(' ')}\n`;

        const bottomFace = [];
        for (let i = count - 1; i >= 0; i--) bottomFace.push(baseStart + i);
        objOutput += `f ${bottomFace.join(' ')}\n`;

        vCount += count * 2;
      });
    });
  }

  // 2. 도로 변환
  if (roads.length > 0) {
    objOutput += "\ng Roads\n";
    roads.forEach((f, idx) => {
      let linesArray = [];
      if (f.geometry && f.geometry.type === 'LineString') {
        linesArray = [f.geometry.coordinates];
      } else if (f.geometry && f.geometry.type === 'MultiLineString') {
        linesArray = f.geometry.coordinates; 
      }
      
      linesArray.forEach((coords, lIdx) => {
        if (!coords || coords.length < 2) return;
        
        objOutput += `g Road_${idx}_${lIdx}\n`;
        const roadWidth = 6.0; 

        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = toMeter(coords[i][0], coords[i][1]);
          const p2 = toMeter(coords[i+1][0], coords[i+1][1]);
          
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len === 0) continue;
          
          // 노드(교차로)에서 끊어져 보이는 현상을 막기 위해 양 끝을 폭의 절반만큼 연장 (Overlap)
          const ex = (dx / len) * (roadWidth / 2.0);
          const ey = (dy / len) * (roadWidth / 2.0);
          
          const extP1 = { x: p1.x - ex, y: p1.y - ey };
          const extP2 = { x: p2.x + ex, y: p2.y + ey };

          const nx = (-dy / len) * (roadWidth / 2.0);
          const ny = (dx / len) * (roadWidth / 2.0);

          const h = 0.05; 
          objOutput += `v ${(extP1.x - nx).toFixed(4)} ${h} ${(-(extP1.y - ny)).toFixed(4)}\n`;
          objOutput += `v ${(extP1.x + nx).toFixed(4)} ${h} ${(-(extP1.y + ny)).toFixed(4)}\n`;
          objOutput += `v ${(extP2.x + nx).toFixed(4)} ${h} ${(-(extP2.y + ny)).toFixed(4)}\n`;
          objOutput += `v ${(extP2.x - nx).toFixed(4)} ${h} ${(-(extP2.y - ny)).toFixed(4)}\n`;
          
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
