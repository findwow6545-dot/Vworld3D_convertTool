import axios from 'axios';

// Vercel/Vite Proxy 주소 설정
const VWORLD_ADDR_URL = '/vworld-addr'; 
const VWORLD_DATA_URL = '/vworld-data';

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

  const url = `${VWORLD_ADDR_URL}?${params.toString()}`;
  const response = await axios.get(url);

  if (response.data.response.status === 'OK') {
    const { x, y } = response.data.response.result.point;
    return {
      lat: parseFloat(y),
      lng: parseFloat(x),
      address: address
    };
  } else {
    throw new Error(response.data.response.error?.text || '주소 변환 실패');
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
    data: 'LT_C_AISBLD', // 건물 레이어
    geomFilter: `BOX(${bbox})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
  });

  const url = `${VWORLD_DATA_URL}?${params.toString()}`;
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
