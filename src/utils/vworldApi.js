const ADDR_BASE = '/api-addr';
const DATA_BASE = '/api-data';

// 환경 변수에서 키를 가져오고, 혹시 모를 따옴표나 공백을 완전히 제거
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

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
 * 건물 데이터 수집 (검색 API 활용 - 가장 안정적)
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = radiusKm / 111;
  const xmin = lng - radiusDegrees;
  const ymin = lat - radiusDegrees;
  const xmax = lng + radiusDegrees;
  const ymax = lat + radiusDegrees;

  // 데이터 API (WFS) 시도
  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD',
    geomFilter: `BOX(${xmin},${ymin},${xmax},${ymax})`,
    geometry: 'true',
    size: '1000',
    format: 'json',
    crs: 'EPSG:4326',
    domain: window.location.hostname
  });

  try {
    const response = await fetch(`${DATA_BASE}?${params.toString()}`);
    const data = await response.json();

    console.log('Vworld RAW Response:', data);

    // 성공한 경우
    if (data.GMLFeatureCollection?.featureMember) {
      const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
        ? data.GMLFeatureCollection.featureMember : [data.GMLFeatureCollection.featureMember];
      
      return members.map(fm => {
        const feature = Object.values(fm)[0];
        const p = feature.properties;
        let h = parseFloat(p.bld_hgt || p.height_m || p.A18 || 0);
        if (h <= 1 && p.gro_flo_co) h = parseInt(p.gro_flo_co) * 3.5;
        if (h <= 1) h = 12;
        feature.properties.bld_hgt = h;
        return { type: 'Feature', geometry: feature.geometry, properties: feature.properties };
      });
    }

    // 에러가 났을 경우 사용자 로그를 위해 에러 메시지 반환
    if (data.response?.status === 'NOT_FOUND' || data.response?.status === 'ERROR') {
      console.warn('Vworld API Error:', data.response.error?.text);
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }

  return [];
};
