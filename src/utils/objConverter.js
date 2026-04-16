/**
 * Vworld 3D Extractor - Rock Solid OBJ Converter
 * 안전하고 가장 확실했던 방식(단순 1:1 매칭)으로 
 * 건물과 도로 데이터를 변환합니다.
 */

export const generateObjFile = (data, centerCoord) => {
  const buildings = data.buildings || [];
  const roads = data.roads || [];

  if (!centerCoord) return '';

  let objOutput = "# VWORLD 3D EXTRACTOR - Precision N-Gon Version\n";
  objOutput += "s off\n"; // 3ds Max 스무딩 그룹 자동적용 방지 (검은 그림자 제거)
  
  let vCount = 1;

  const toMeter = (lng, lat) => {
    const x = (lng - centerCoord.lng) * 88800; 
    const y = (lat - centerCoord.lat) * 111000; 
    return { x, y };
  };

  // 1. 건물 변환 (N-Gon 로직)
  if (buildings.length > 0) {
    objOutput += "\ng Buildings\n";
    buildings.forEach((f, idx) => {
      let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
      if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;

      let rings = [];
      if (f.geometry && f.geometry.type === 'Polygon') {
        rings = f.geometry.coordinates;
      } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
        rings = f.geometry.coordinates.map(poly => poly[0]);
      }
      
      if (!rings || rings.length === 0) return;

      objOutput += `g Building_${idx}\n`;

      rings.forEach((ring) => {
        // 중복 정점 제거
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

        const baseStart = vCount;
        const topStart = vCount + count;

        // 바닥 및 천장 점 생성
        cleanRing.forEach(([lng, lat]) => {
          const p = toMeter(lng, lat);
          objOutput += `v ${p.x.toFixed(4)} 0.0000 ${(-p.y).toFixed(4)}\n`;
        });
        cleanRing.forEach(([lng, lat]) => {
          const p = toMeter(lng, lat);
          objOutput += `v ${p.x.toFixed(4)} ${h.toFixed(4)} ${(-p.y).toFixed(4)}\n`;
        });

        // 옆면 (Quads)
        for (let i = 0; i < count; i++) {
          const next = (i + 1) % count;
          objOutput += `f ${baseStart + i} ${baseStart + next} ${topStart + next} ${topStart + i}\n`;
        }

        // 지붕 (N-Gon)
        const topFace = [];
        for (let i = 0; i < count; i++) topFace.push(topStart + i);
        objOutput += `f ${topFace.join(' ')}\n`;

        // 바닥 (N-Gon - 법선 방향을 위해 역순)
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
          
          const nx = (-dy / len) * (roadWidth / 2);
          const ny = (dx / len) * (roadWidth / 2);

          const h = 0.05; 
          objOutput += `v ${(p1.x - nx).toFixed(4)} ${h} ${(-(p1.y - ny)).toFixed(4)}\n`;
          objOutput += `v ${(p1.x + nx).toFixed(4)} ${h} ${(-(p1.y + ny)).toFixed(4)}\n`;
          objOutput += `v ${(p2.x + nx).toFixed(4)} ${h} ${(-(p2.y + ny)).toFixed(4)}\n`;
          objOutput += `v ${(p2.x - nx).toFixed(4)} ${h} ${(-(p2.y - ny)).toFixed(4)}\n`;
          
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
