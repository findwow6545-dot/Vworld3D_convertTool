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
 * 건물 데이터 수집 (가급적 많은 데이터를 긁어오도록 반경 보정)
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  // 위도/경도 1도는 약 111km. 반경 Km를 도로 환산
  const radiusDegrees = (radiusKm * 1.5) / 111; // 1.5배 보정하여 더 넓게 검색
  
  const xmin = lng - radiusDegrees;
  const ymin = lat - radiusDegrees;
  const xmax = lng + radiusDegrees;
  const ymax = lat + radiusDegrees;

  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD', // 건축물대장 건물 레이어 (3D)
    geomFilter: `BOX(${xmin},${ymin},${xmax},${ymax})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
    format: 'json',
    crs: 'EPSG:4326',
    attrFilter: 'bld_hgt:>:0' // 높이가 있는 건물 우선 (필터 완화 가능)
  });

  try {
    const response = await fetch(`${DATA_BASE}?${params.toString()}`);
    const data = await response.json();

    // 응답 결과 디버깅 로그 (브라우저 콘솔에서 확인 가능)
    console.log('Vworld Raw Data:', data);

    if (data.GMLFeatureCollection?.featureMember) {
      const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
        ? data.GMLFeatureCollection.featureMember : [data.GMLFeatureCollection.featureMember];
      
      const results = members.map(fm => {
        const feature = Object.values(fm)[0];
        return { 
          type: 'Feature', 
          geometry: feature.geometry, 
          properties: feature.properties 
        };
      });
      
      // 높이가 0으로 수집된 경우 층수 기반 보정
      return results.map(res => {
        const p = res.properties;
        let h = parseFloat(p.bld_hgt || p.height_m || p.A18 || 0);
        if (h <= 0 && p.gro_flo_co) h = parseInt(p.gro_flo_co) * 3;
        if (h <= 0) h = 10; // 최소 높이 보장
        res.properties.bld_hgt = h;
        return res;
      });
    }

    // 대체 API 응답 구조 (V2 특성)
    if (data.response?.result?.featureCollection?.features) {
      return data.response.result.featureCollection.features;
    }
  } catch (err) {
    console.error('Fetch Building Error:', err);
  }
  return [];
};
