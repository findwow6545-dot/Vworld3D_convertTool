// Vworld API 실제 엔드포인트
const ADDR_ENDPOINT = 'https://api.vworld.kr/req/address';
const DATA_ENDPOINT = 'https://api.vworld.kr/req/data';

// 현재 환경 확인
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 로컬일 때만 프록시 경로 사용, 배포 환경에서는 직접 호출
const ADDR_BASE = isLocal ? '/vworld-addr' : ADDR_ENDPOINT;
const DATA_BASE = isLocal ? '/vworld-data' : DATA_ENDPOINT;

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
  console.log('Fetching:', url);

  // Axios 대신 표준 Fetch API 사용 (배포 환경 안정성 확보)
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP 에러! 상태코드: ${response.status} (브이월드 도메인 인증 오류일 가능성이 높습니다)`);
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
    const msg = data.response?.error?.text || '인증 실패: 브이월드에 등록한 주소와 현재 접속 주소가 일치하는지 확인하세요.';
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
