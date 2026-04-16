import axios from 'axios';

// 현재 환경 확인 (Vercel 배포 환경인지 로컬환경인지)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 배포 환경에서는 Vworld 서버를 직접 호출 (도메인 인증 필요)
// 로컬 환경에서는 개발 서버의 프록시(/vworld-addr 등)를 사용하여 CORS 우회
const ADDR_BASE = isLocal ? '/vworld-addr' : 'https://api.vworld.kr/req/address';
const DATA_BASE = isLocal ? '/vworld-data' : 'https://api.vworld.kr/req/data';

// API 키 (앞뒤 공백/줄바꿈 방지 처리)
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

/**
 * 주소를 위경도 좌표로 변환 (Geocoding)
 */
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

  const url = `${ADDR_BASE}?${params.toString()}`;
  const response = await axios.get(url);

  // Vworld는 에러 시에도 200 OK를 주고 내부 결과값에 에러를 담는 경우가 많음
  if (response.data.response && response.data.response.status === 'OK') {
    const { x, y } = response.data.response.result.point;
    return {
      lat: parseFloat(y),
      lng: parseFloat(x),
      address: address
    };
  } else {
    const errorText = response.data.response?.error?.text || '주소 변환에 실패했습니다. (API 키와 도메인 설정을 확인해주세요)';
    throw new Error(errorText);
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
  const response = await axios.get(url);

  if (response.data.GMLFeatureCollection) {
    return response.data.GMLFeatureCollection.featureMember.map(fm => {
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
