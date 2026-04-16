// Vercel 프록시 경로 사용 (CORS 해결)
const ADDR_BASE = '/api-addr';
const DATA_BASE = '/api-data';

// API 키 정제
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

/**
 * 주소를 위경도 좌표로 변환 (Geocoding)
 */
export const geocodeAddress = async (address) => {
  if (!API_KEY) throw new Error('API 키가 설정되지 않았습니다.');

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

  const url = `${ADDR_BASE}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.response && data.response.status === 'OK') {
    const { x, y } = data.response.result.point;
    return {
      lat: parseFloat(y),
      lng: parseFloat(x),
      address: address
    };
  } else {
    throw new Error(data.response?.error?.text || '주소 변환 실패');
  }
};

/**
 * 특정 좌표 주변의 3D 건물 데이터 수집
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  // 실제 반경을 약간 더 여유 있게 잡음 (보정치)
  const radiusDegrees = radiusKm / 110; 
  const xmin = lng - radiusDegrees;
  const ymin = lat - radiusDegrees;
  const xmax = lng + radiusDegrees;
  const ymax = lat + radiusDegrees;

  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD', 
    geomFilter: `BOX(${xmin},${ymin},${xmax},${ymax})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
    format: 'json',
    crs: 'EPSG:4326' // 좌표계 명시
  });

  try {
    const url = `${DATA_BASE}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.GMLFeatureCollection && data.GMLFeatureCollection.featureMember) {
      // 데이터가 1개인 경우 배열이 아닐 수 있으므로 처리
      const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
        ? data.GMLFeatureCollection.featureMember 
        : [data.GMLFeatureCollection.featureMember];

      return members.map(fm => {
        const feature = Object.values(fm)[0];
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.properties
        };
      });
    }
  } catch (e) {
    console.error('Data Fetch Error:', e);
  }
  return [];
};
