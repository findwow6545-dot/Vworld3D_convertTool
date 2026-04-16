import axios from 'axios';

// 현재 환경 확인
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Vworld API 실제 엔드포인트
const ADDR_ENDPOINT = 'https://api.vworld.kr/req/address';
const DATA_ENDPOINT = 'https://api.vworld.kr/req/data';

// 로컬일 때만 프록시 경로 사용, 배포 환경에서는 직접 호출
const ADDR_BASE = isLocal ? '/vworld-addr' : ADDR_ENDPOINT;
const DATA_BASE = isLocal ? '/vworld-data' : DATA_ENDPOINT;

// API 키 정제
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

/**
 * 주소를 위경도 좌표로 변환 (Geocoding)
 */
export const geocodeAddress = async (address) => {
  if (!API_KEY) throw new Error('Vworld API 키가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.');

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

  try {
    const url = `${ADDR_BASE}?${params.toString()}`;
    console.log('Requesting URL:', url); // 디버깅용
    
    const response = await axios.get(url);

    if (response.data.response && response.data.response.status === 'OK') {
      const { x, y } = response.data.response.result.point;
      return {
        lat: parseFloat(y),
        lng: parseFloat(x),
        address: address
      };
    } else {
      const errorMsg = response.data.response?.error?.text || '인증 오류가 발생했습니다. 브이월드 센터에 등록한 도메인과 현재 접속 주소가 일치하는지 확인하세요.';
      throw new Error(errorMsg);
    }
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error('404 에러: API 경로를 찾을 수 없습니다. (브이월드 도메인 제한 또는 Vercel 설정 문제)');
    }
    throw err;
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
