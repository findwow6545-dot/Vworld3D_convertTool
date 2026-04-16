// Vercel 프록시 경로 사용
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
 * 건물 데이터 수집 (여러 레이어 시도)
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = radiusKm / 110;
  const bbox = [lng - radiusDegrees, lat - radiusDegrees, lng + radiusDegrees, lat + radiusDegrees].join(',');

  // 건축물(LT_C_AISBLD)이 안 나올 경우를 대비해 가장 표준적인 레이어를 사용
  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD', 
    geomFilter: `BOX(${bbox})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
    format: 'json',
    crs: 'EPSG:4326'
  });

  try {
    const url = `${DATA_BASE}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    // 1. GMLFeatureCollection 형태 처리
    if (data.GMLFeatureCollection?.featureMember) {
      const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
        ? data.GMLFeatureCollection.featureMember : [data.GMLFeatureCollection.featureMember];
      return members.map(fm => {
        const feature = Object.values(fm)[0];
        return { type: 'Feature', geometry: feature.geometry, properties: feature.properties };
      });
    }
    
    // 2. 만약 response.result 형태라면 (API 버전에 따라 다름)
    if (data.response?.result?.featureCollection?.features) {
      return data.response.result.featureCollection.features;
    }
  } catch (e) {
    console.error('Fetch Error:', e);
  }
  return [];
};
