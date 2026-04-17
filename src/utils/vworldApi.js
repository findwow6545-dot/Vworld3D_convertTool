import axios from 'axios';

const BASE_URL = '/vworld-api';
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
      domain: window.location.hostname
    },
  });

  if (res.data?.response?.status === 'OK') {
    const { x, y } = res.data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error(res.data?.response?.error?.text || '주소 변환 실패');
}

export async function reverseGeocode(lat, lng) {
  const res = await axios.get(`${BASE_URL}/address`, {
    params: {
      service: 'address',
      request: 'getaddress',
      key: API_KEY,
      point: `${lng},${lat}`,
      type: 'both',
      format: 'json',
      crs: 'epsg:4326',
      domain: window.location.hostname
    },
  });

  if (res.data?.response?.status === 'OK') {
    const address = res.data.response.result[0].text;
    return { lat, lng, address };
  }
  throw new Error(res.data?.response?.error?.text || '주소 정보를 찾을 수 없습니다.');
}

export async function fetchComplexData(lat, lng, radiusKm, onProgress) {
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

  // 1. 빌딩 레이어 선별 및 수집 (사용자가 만족했던 버전의 가장 안정적인 방식)
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
    throw new Error(`데이터 수집 불가: ${lastError || '인증 오류'}`);
  }

  const fetchLayer = async (layerName, displayName, customFormatCb = null) => {
    onProgress?.(`${displayName} 수집 대기 중...`);
    const results = [];
    const PAGE_SIZE = 1000;
    let page = 1;
    while (true) {
      const res = await axios.get(`${BASE_URL}/data`, { params: { ...baseParams, data: layerName, size: PAGE_SIZE, page } });
      const body = res.data?.response;
      if (!body || body.status !== 'OK') break;
      const features = body.result?.featureCollection?.features ?? [];
      if (features.length === 0) break;
      results.push(...features);
      onProgress?.(`${displayName}: ${results.length.toLocaleString()}개 확보`);
      if (features.length < PAGE_SIZE) break;
      page++;
      await new Promise(r => setTimeout(r, 100)); // Rate limit 방지
    }
    
    if (customFormatCb) {
      return results.map(customFormatCb);
    }
    return results;
  };

  // 기존 황금 버전처럼 workingLayer에 있는 건물을 긁어온다.
  const buildings = await fetchLayer(workingLayer, '건물', (f) => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;
    f.properties.bld_hgt = h;
    return f;
  });

  // 도로 중심선 데이터 수집 추가
  const roads = await fetchLayer('LT_L_SPRD', '도로');

  return { buildings, roads };
}
