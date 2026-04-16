const ADDR_BASE = '/api-addr';
const DATA_BASE = '/api-data';

const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

export const geocodeAddress = async (address) => {
  const params = new URLSearchParams({
    key: API_KEY,
    service: 'address',
    request: 'getcoord',
    type: 'ROAD',
    address: address,
    domain: window.location.hostname,
    format: 'json',
    crs: 'epsg:4326',
  });
  const response = await fetch(`${ADDR_BASE}?${params.toString()}`);
  const data = await response.json();
  if (data.response?.status === 'OK') {
    const { x, y } = data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error('주소 변환 실패');
};

/**
 * 건물 데이터 수집 (최종 병기: 레이어 교차 검색)
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = (radiusKm * 1.5) / 111; 
  const xmin = lng - radiusDegrees;
  const ymin = lat - radiusDegrees;
  const xmax = lng + radiusDegrees;
  const ymax = lat + radiusDegrees;

  // 두 가지 레이어를 시도합니다. (LT_C_AISBLD, LT_C_SPBD)
  const layers = ['LT_C_AISBLD', 'LT_C_SPBD'];
  let allFeatures = [];

  for (const layer of layers) {
    const params = new URLSearchParams({
      key: API_KEY,
      service: 'data',
      request: 'GetFeature',
      data: layer, 
      geomFilter: `box(${xmin},${ymin},${xmax},${ymax})`, // 소문자 box 시도
      geometry: 'true',
      size: '1000',
      format: 'json',
      crs: 'EPSG:4326'
    });

    try {
      const response = await fetch(`${DATA_BASE}?${params.toString()}`);
      const data = await response.json();

      if (data.GMLFeatureCollection?.featureMember) {
        const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
          ? data.GMLFeatureCollection.featureMember : [data.GMLFeatureCollection.featureMember];
        
        const mapped = members.map(fm => {
          const feature = Object.values(fm)[0];
          const p = feature.properties;
          
          // 높이 보정 로직 (무조건 10m 이상 보장)
          let h = parseFloat(p.bld_hgt || p.height_m || p.A18 || p.height || 0);
          if (h <= 1 && p.gro_flo_co) h = parseInt(p.gro_flo_co) * 3.5;
          if (h <= 1) h = 12.0; // 높이 정보 없으면 기본 4층 높이 부여
          
          feature.properties.bld_hgt = h;
          return { type: 'Feature', geometry: feature.geometry, properties: feature.properties };
        });
        
        allFeatures = [...allFeatures, ...mapped];
        if (allFeatures.length > 0) break; // 하나라도 찾으면 중단
      }
    } catch (err) {
      console.error(`Layer ${layer} fetch error:`, err);
    }
  }

  // 중복 제거 (레이어 겹침 방지)
  const uniqueFeatures = [];
  const seen = new Set();
  for (const f of allFeatures) {
    const id = f.properties.ag_id || JSON.stringify(f.geometry.coordinates);
    if (!seen.has(id)) {
      seen.add(id);
      uniqueFeatures.push(f);
    }
  }

  return uniqueFeatures;
};
