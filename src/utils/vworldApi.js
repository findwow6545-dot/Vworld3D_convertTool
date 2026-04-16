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
  console.log('Sending request via Proxy:', url);

  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) throw new Error('서버 경로(404) 에러. 배포가 완료될 때까지 잠시만 기다려주세요.');
    throw new Error(`서버 요청 실패 (상태코드: ${response.status})`);
  }

  const data = await response.json();

  if (data.response && data.response.status === 'OK') {
    const { x, y } = data.response.result.point;
    return {
      lat: parseFloat(y),
      lng: parseFloat(x),
      address: address
    };
  } else {
    const msg = data.response?.error?.text || '인증 실패: 브이월드 도메인 설정을 확인하세요.';
    throw new Error(msg);
  }
};

/**
 * 특정 좌표 주변의 3D 건물 데이터 수집
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = radiusKm / 111;
  const bbox = [
    lng - radiusDegrees,
    lat - radiusDegrees,
    lng + radiusDegrees,
    lat + radiusDegrees
  ].join(',');

  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD', 
    geomFilter: `BOX(${bbox})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
    format: 'json', // JSON 포맷 명시 추가
  });

  const url = `${DATA_BASE}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.GMLFeatureCollection) {
    return data.GMLFeatureCollection.featureMember.map(fm => {
      const feature = Object.values(fm)[0];
      return {
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties
      };
    });
  }
  return [];
};
