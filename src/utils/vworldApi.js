import axios from 'axios';

// 로컬 환경인지 확인
const isLocal = window.location.hostname === 'localhost';

// 로컬이면 프록시(/vworld-api)를 쓰고, 배포 환경이면 브이월드 서버로 직접 요청
const BASE_URL = isLocal ? '/vworld-api' : 'https://api.vworld.kr/req';

const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').replace(/["']/g, '').trim();

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
    },
  });

  if (res.data?.response?.status === 'OK') {
    const { x, y } = res.data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error('주소 변환 실패');
}

export async function fetchBuildingsInRadius(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const bbox = `BOX(${(lng - lngDeg).toFixed(6)},${(lat - latDeg).toFixed(6)},${(lng + lngDeg).toFixed(6)},${(lat + latDeg).toFixed(6)})`;

  const baseParams = {
    service:    'data',
    request:    'GetFeature',
    key:        API_KEY,
    format:     'json',
    geometry:   true,
    attribute:  true,
    crs:        'epsg:4326',
    geomfilter: bbox,
  };

  const LAYER_CANDIDATES = ['LT_C_AISBLD', 'LT_C_SPBD', 'LT_C_ARSIBLD'];
  let workingLayer = null;

  for (const layer of LAYER_CANDIDATES) {
    try {
      const res = await axios.get(`${BASE_URL}/data`, {
        params: { ...baseParams, data: layer, size: 1 },
      });
      if (res.data?.response?.status === 'OK' || res.data?.response?.status === 'NOT_FOUND') {
        workingLayer = layer;
        break;
      }
    } catch (e) { continue; }
  }

  if (!workingLayer) throw new Error('건물 데이터를 가져올 수 없습니다. 브이월드 키의 도메인 설정을 확인해주세요.');

  const ALL_FEATURES = [];
  const PAGE_SIZE = 100; // 배포 속를 위해 단위를 줄임
  let page = 1;
  while (true) {
    const res = await axios.get(`${BASE_URL}/data`, {
      params: { ...baseParams, data: workingLayer, size: PAGE_SIZE, page },
    });
    const body = res.data?.response;
    if (!body || body.status !== 'OK') break;
    const features = body.result?.featureCollection?.features ?? [];
    if (features.length === 0) break;
    ALL_FEATURES.push(...features);
    onProgress?.(`${ALL_FEATURES.length.toLocaleString()}개 수집됨`);
    if (features.length < PAGE_SIZE) break;
    page++;
    if (page > 30) break; // 최대 3000개 제한
  }
  return ALL_FEATURES.map(f => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;
    f.properties.bld_hgt = h;
    return f;
  });
}
