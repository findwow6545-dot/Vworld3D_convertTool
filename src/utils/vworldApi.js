import axios from 'axios';

// 초기 로컬 개발 환경과 동일한 프록시 경로 사용
const API_BASE = '/vworld-api';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

/**
 * 주소 -> 좌표 변환
 */
export const geocodeAddress = async (address) => {
  const url = `${API_BASE}/address?service=address&request=getcoord&crs=epsg:4326&address=${encodeURIComponent(address)}&format=json&key=${API_KEY}&type=road`;
  
  const response = await axios.get(url);
  if (response.data.response?.status === 'OK') {
    const { x, y } = response.data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error('주소 변환에 실패했습니다.');
};

/**
 * 건물 데이터 수집 (초기 방식)
 */
export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = radiusKm / 111;
  const bbox = `${lng - radiusDegrees},${lat - radiusDegrees},${lng + radiusDegrees},${lat + radiusDegrees}`;

  const url = `${API_BASE}/data?service=data&request=GetFeature&data=LT_C_AISBLD&geomFilter=BOX(${bbox})&geometry=true&size=1000&format=json&key=${API_KEY}`;

  try {
    const response = await axios.get(url);
    if (response.data.GMLFeatureCollection?.featureMember) {
      const members = Array.isArray(response.data.GMLFeatureCollection.featureMember)
        ? response.data.GMLFeatureCollection.featureMember
        : [response.data.GMLFeatureCollection.featureMember];

      return members.map(fm => {
        const feature = Object.values(fm)[0];
        // 최소 높이 보정
        if (!feature.properties.bld_hgt || feature.properties.bld_hgt <= 0) {
          feature.properties.bld_hgt = feature.properties.gro_flo_co ? feature.properties.gro_flo_co * 3.5 : 12;
        }
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.properties
        };
      });
    }
  } catch (err) {
    console.error('건물 데이터 수집 에러:', err);
  }
  return [];
};
