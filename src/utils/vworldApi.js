import axios from 'axios';

// 배포 환경에서도 로컬과 동일하게 프록시 경로 사용
const BASE_URL = '/vworld-api';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

export const getMaskedKey = () => {
  if (!API_KEY) return '키 없음';
  return `${API_KEY.slice(0, 5)}...${API_KEY.slice(-5)}`;
};

function kmToDegrees(km, lat) {
  const latDeg = km / 111.32;
  const lngDeg = km / (111.32 * Math.cos(lat * (Math.PI / 180)));
  return { latDeg, lngDeg };
}

export async function geocodeAddress(address) {
  const res = await axios.get(`${BASE_URL}/address`, {
    params: {
      service: 'address',
      request: 'getcoord',
      key: API_KEY,
      address: address,
      type: 'road',
      format: 'json',
      crs: 'epsg:4326',
      domain: window.location.hostname // 도메인 명시
    },
  });

  if (res.data?.response?.status === 'OK') {
    const { x, y } = res.data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error(res.data?.response?.error?.text || '주소 변환 실패');
}

export async function fetchBuildingsInRadius(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const bbox = `BOX(${(lng - lngDeg).toFixed(6)},${(lat - latDeg).toFixed(6)},${(lng + lngDeg).toFixed(6)},${(lat + latDeg).toFixed(6)})`;

  const baseParams = {
    service:    'data',
    request:    'GetFeature',
    key:        API_KEY,
    domain:     window.location.hostname,
    format:     'json',
    geometry:   true,
    attribute:  true,
    crs:        'epsg:4326',
    geomfilter: bbox,
  };

  const LAYER_CANDIDATES = ['LT_C_AISBLD', 'LT_C_SPBD', 'LT_C_ARSIBLD'];
  let workingLayer = null;
  let lastError = '';

  for (const layer of LAYER_CANDIDATES) {
    try {
      const res = await axios.get(`${BASE_URL}/data`, { params: { ...baseParams, data: layer, size: 1 } });
      const body = res.data?.response;
      if (body?.status === 'OK' || body?.status === 'NOT_FOUND') {
        workingLayer = layer;
        break;
      } else {
        lastError = body?.error?.text || '인증 오류';
      }
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  if (!workingLayer) {
    alert(`인증 실패 사유: ${lastError}`);
    throw new Error('인증 실패');
  }

  const ALL_FEATURES = [];
  const PAGE_SIZE = 1000;
  let page = 1;

  while (true) {
    const res = await axios.get(`${BASE_URL}/data`, { params: { ...baseParams, data: workingLayer, size: PAGE_SIZE, page } });
    const body = res.data?.response;
    if (!body || body.status !== 'OK') break;
    const features = body.result?.featureCollection?.features ?? [];
    if (features.length === 0) break;
    ALL_FEATURES.push(...features);
    onProgress?.(`${ALL_FEATURES.length.toLocaleString()}개 수집됨`);
    if (features.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 100));
  }

  return ALL_FEATURES.map(f => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;
    f.properties.bld_hgt = h;
    return f;
  });
}
