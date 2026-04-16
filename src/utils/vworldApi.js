import axios from 'axios';

const isLocal = window.location.hostname === 'localhost';
const BASE_URL = isLocal ? '/vworld-api' : 'https://api.vworld.kr/req';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

// 디버그용: 키의 일부만 반환
export const getMaskedKey = () => {
  if (!API_KEY) return '키 없음 (Vercel 설정 확인 필요)';
  return `${API_KEY.slice(0, 5)}...${API_KEY.slice(-5)}`;
};

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
  throw new Error(res.data?.response?.error?.text || '주소 변환 실패');
}

export async function fetchBuildingsInRadius(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const bbox = `BOX(${(lng - lngDeg).toFixed(6)},${(lat - latDeg).toFixed(6)},${(lng + lngDeg).toFixed(6)},${(lat + latDeg).toFixed(6)})`;

  const baseParams = {
    service: 'data', request: 'GetFeature', key: API_KEY, format: 'json', geometry: 'true', attribute: 'true', crs: 'epsg:4326', geomfilter: bbox,
    domain: window.location.hostname // 다시 도메인 포함 (직접 호출 시 필요할 수 있음)
  };

  const LAYER_CANDIDATES = ['LT_C_AISBLD', 'LT_C_SPBD', 'LT_C_ARSIBLD'];
  let workingLayer = null;
  let errorDetail = '';

  for (const layer of LAYER_CANDIDATES) {
    try {
      const res = await axios.get(`${BASE_URL}/data`, { params: { ...baseParams, data: layer, size: 1 } });
      const body = res.data?.response;
      if (body?.status === 'OK' || body?.status === 'NOT_FOUND') {
        workingLayer = layer;
        break;
      } else {
        errorDetail = body?.error?.text || '인증 오류';
      }
    } catch (e) { 
      errorDetail = e.message;
      continue; 
    }
  }

  if (!workingLayer) {
    // 팝업으로 상세 에러 표시
    alert(`브이월드 인증 실패!\n사유: ${errorDetail}\n현재 접속 도메인: ${window.location.hostname}\n설정된 키: ${getMaskedKey()}`);
    throw new Error('인증 실패');
  }

  const ALL_FEATURES = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${BASE_URL}/data`, { params: { ...baseParams, data: workingLayer, size: 100, page } });
    const features = res.data?.response?.result?.featureCollection?.features ?? [];
    if (features.length === 0) break;
    ALL_FEATURES.push(...features);
    onProgress?.(`${ALL_FEATURES.length}개 수집됨`);
    if (features.length < 100 || page >= 20) break;
    page++;
  }
  return ALL_FEATURES.map(f => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;
    f.properties.bld_hgt = h;
    return f;
  });
}
