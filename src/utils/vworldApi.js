import axios from 'axios';

// 배포 환경에서도 안전하게 프록시(/vworld-api) 사용
const BASE_URL = '/vworld-api';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

function kmToDegrees(km, lat) {
  const latDeg = km / 111.32;
  const lngDeg = km / (111.32 * Math.cos(lat * (Math.PI / 180)));
  return { latDeg, lngDeg };
}

export async function geocodeAddress(address) {
  try {
    const res = await axios.get(`${BASE_URL}/address`, {
      params: { service: 'address', request: 'getcoord', key: API_KEY, address, type: 'road', format: 'json', crs: 'epsg:4326', domain: window.location.hostname },
    });
    if (res.data?.response?.status === 'OK') {
      const { x, y } = res.data.response.result.point;
      return { lat: parseFloat(y), lng: parseFloat(x), address };
    }
  } catch (e) { console.error(e); }
  return null;
}

/**
 * 건물과 도로 데이터를 모두 수집 (프록시 기반)
 */
export async function fetchComplexData(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const bbox = `BOX(${(lng - lngDeg).toFixed(6)},${(lat - latDeg).toFixed(6)},${(lng + lngDeg).toFixed(6)},${(lat + latDeg).toFixed(6)})`;

  const fetchLayer = async (layer, label) => {
    onProgress?.(`${label} 수집 대기 중...`);
    const results = [];
    let page = 1;
    while (true) {
      const res = await axios.get(`${BASE_URL}/data`, {
        params: { 
          service: 'data', request: 'GetFeature', key: API_KEY, data: layer, 
          geomFilter: bbox, crs: 'epsg:4326', format: 'json', size: 1000, page, domain: window.location.hostname 
        }
      });
      const features = res.data?.response?.result?.featureCollection?.features ?? [];
      if (features.length === 0) break;
      results.push(...features);
      onProgress?.(`${label}: ${results.length}개 확보`);
      if (features.length < 1000 || page >= 10) break;
      page++;
    }
    return results;
  };

  const buildings = await fetchLayer('LT_C_AISBLD', '건물');
  const roads = await fetchLayer('LT_L_SPRD', '도로');

  return { buildings, roads };
}
