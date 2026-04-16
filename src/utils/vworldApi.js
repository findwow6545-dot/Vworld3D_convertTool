import axios from 'axios';

const BASE_URL = '/vworld-api';
const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();
const REGISTERED_DOMAIN = window.location.hostname; // 현재 접속 도메인 자동 감지

/**
 * 0. 거리(km)를 위경도 도(degree) 단위로 대략 변환
 */
function kmToDegrees(km, lat) {
  const latDeg = km / 111.32;
  const lngDeg = km / (111.32 * Math.cos(lat * (Math.PI / 180)));
  return { latDeg, lngDeg };
}

/**
 * 1. 주소 -> 위경도 좌표 변환 (Geocoder API 2.0)
 */
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

  const body = res.data?.response;
  if (body?.status === 'OK') {
    const { x, y } = body.result.point;
    return {
      lat: parseFloat(y),
      lng: parseFloat(x),
      address: address,
    };
  }
  throw new Error(body?.error?.text || '주소 변환에 실패했습니다.');
}

/**
 * 2. 특정 반경 내 건물 데이터 수집 (Data API 2.0 - WFS)
 */
export async function fetchBuildingsInRadius(lat, lng, radiusKm, onProgress) {
  const { latDeg, lngDeg } = kmToDegrees(radiusKm, lat);
  const minX = (lng - lngDeg).toFixed(6);
  const minY = (lat - latDeg).toFixed(6);
  const maxX = (lng + lngDeg).toFixed(6);
  const maxY = (lat + latDeg).toFixed(6);
  const bbox = `BOX(${minX},${minY},${maxX},${maxY})`;

  const baseParams = {
    service:    'data',
    request:    'GetFeature',
    key:        API_KEY,
    domain:     REGISTERED_DOMAIN,
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

  if (!workingLayer) throw new Error('사용 가능한 건물 레이어를 찾을 수 없습니다.');

  const ALL_FEATURES = [];
  const PAGE_SIZE = 1000;
  let page = 1;
  let totalCount = null;

  while (true) {
    const res = await axios.get(`${BASE_URL}/data`, {
      params: { ...baseParams, data: workingLayer, size: PAGE_SIZE, page },
    });
    const body = res.data?.response;
    if (!body || body.status !== 'OK') break;

    const featureCollection = body.result?.featureCollection;
    if (!featureCollection) break;

    if (totalCount === null) {
      totalCount = parseInt(featureCollection.totalCount ?? 0, 10);
      onProgress?.(`총 ${totalCount.toLocaleString()}개 수집 중...`);
    }

    const features = featureCollection.features ?? [];
    if (features.length === 0) break;

    ALL_FEATURES.push(...features);
    onProgress?.(`${ALL_FEATURES.length.toLocaleString()}개 수집됨`);

    if (ALL_FEATURES.length >= totalCount || features.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 100));
  }

  // 높이 보정
  return ALL_FEATURES.map(f => {
    let h = parseFloat(f.properties.bld_hgt || f.properties.A18 || 0);
    if (h <= 0) h = f.properties.gro_flo_co ? f.properties.gro_flo_co * 3.5 : 12;
    f.properties.bld_hgt = h;
    return f;
  });
}
