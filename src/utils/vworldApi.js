import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';
const BASE_URL = isLocal ? '/vworld-api' : 'https://api.vworld.kr/req';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

function kmToDegrees(km, lat) {
  const latDeg = km / 111.32;
  const lngDeg = km / (111.32 * Math.cos(lat * (Math.PI / 180)));
  return { latDeg, lngDeg };
}

export async function geocodeAddress(address) {
  const res = await axios.get(`${BASE_URL}/address`, {
    params: { service: 'address', request: 'getcoord', key: API_KEY, address, type: 'road', format: 'json', crs: 'epsg:4326' },
  });
  if (res.data?.response?.status === 'OK') {
    const { x, y } = res.data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  return null;
}

/**
 * 건물 및 도로 데이터를 통합 수집
 */
export async function fetchComplexData(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const bbox = `BOX(${(lng - lngDeg).toFixed(6)},${(lat - latDeg).toFixed(6)},${(lng + lngDeg).toFixed(6)},${(lat + latDeg).toFixed(6)})`;

  const fetchLayer = async (layerName, displayName) => {
    onProgress?.(`${displayName} 수집 시작...`);
    const results = [];
    let page = 1;
    while (true) {
      const res = await axios.get(`${BASE_URL}/data`, {
        params: { 
          service: 'data', request: 'GetFeature', key: API_KEY, 
          data: layerName, geomFilter: bbox, crs: 'epsg:4326', format: 'json', size: 1000, page 
        }
      });
      const features = res.data?.response?.result?.featureCollection?.features ?? [];
      if (features.length === 0) break;
      results.push(...features);
      onProgress?.(`${displayName}: ${results.length}개 확보`);
      if (features.length < 1000 || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  };

  // 1. 건물 레이어 후보 탐색 후 수집
  let buildingLayer = 'LT_C_AISBLD';
  const buildings = await fetchLayer(buildingLayer, '건물');

  // 2. 도로 레이어 수집 (LT_L_SPRD: 도로중심선)
  const roads = await fetchLayer('LT_L_SPRD', '도로');

  return { buildings, roads };
}
