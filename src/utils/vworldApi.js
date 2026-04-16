/**
 * vworldApi.js
 * 브이월드 API 호출 유틸리티
 */

import axios from 'axios';

const API_KEY = import.meta.env.VITE_VWORLD_API_KEY;

// Vite 프록시를 통한 베이스 URL (CORS 우회)
const BASE_URL = '/vworld-api';

/**
 * 브이월드 설정 센터에 등록된 실제 도메인
 * 스크린샷 확인 결과: la-intranet.vercel.app
 */
const REGISTERED_DOMAIN = 'la-intranet.vercel.app';

/**
 * API 키 유효성 검사
 */
function checkApiKey() {
  if (!API_KEY || API_KEY === 'YOUR_VWORLD_API_KEY_HERE' || API_KEY.trim() === '') {
    throw new Error(
      '.env 파일에 VITE_VWORLD_API_KEY를 설정해주세요.\n' +
      'https://www.vworld.kr → 개발자센터 → 인증키 신청'
    );
  }
}

/**
 * 주소 문자열 → { lat, lng, address } 변환
 */
export async function geocodeAddress(address) {
  checkApiKey();

  const baseParams = {
    service:  'address',
    request:  'getcoord',
    crs:      'epsg:4326',
    address,
    format:   'json',
    key:      API_KEY,
    domain:   REGISTERED_DOMAIN, // 등록된 도메인으로 강제 지정
  };

  try {
    const response = await axios.get(`${BASE_URL}/address`, {
      params: { ...baseParams, type: 'road' },
    });
    const result = response.data?.response;

    if (result?.status === 'OK') {
      const { x, y } = result.result.point;
      return { lng: parseFloat(x), lat: parseFloat(y), address };
    }

    const response2 = await axios.get(`${BASE_URL}/address`, {
      params: { ...baseParams, type: 'parcel' },
    });
    const result2 = response2.data?.response;

    if (result2?.status === 'OK') {
      const { x, y } = result2.result.point;
      return { lng: parseFloat(x), lat: parseFloat(y), address };
    }

    throw new Error(`주소를 찾을 수 없습니다: "${address}"`);
  } catch (err) {
    throw err;
  }
}

/**
 * 경위도 → 도 단위 거리 변환
 */
function kmToDegrees(km, lat) {
  const latDeg = km / 111.32;
  const lngDeg = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { latDeg, lngDeg };
}

/**
 * 반경(km) 내 브이월드 건물 Feature 수집
 */
export async function fetchBuildingsInRadius(lat, lng, radiusKm, onProgress) {
  checkApiKey();

  onProgress?.('브이월드 건물 데이터 요청 중...');

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
    domain:     REGISTERED_DOMAIN, // 등록된 도메인으로 강제 지정
    format:     'json',
    geometry:   true,
    attribute:  true,
    crs:        'epsg:4326',
    geomfilter: bbox,
  };

  // 브이월드 2.0에서 유효한 건물 관련 레이어 후보
  const LAYER_CANDIDATES = [
    'LT_C_AISBLD',    // 건축물연령 (표준 레이어)
    'LT_C_SPBD',      // 실내지도 건물
    'LT_C_ARSIBLD',   // 건물통합정보
  ];

  let workingLayer = null;
  for (const layer of LAYER_CANDIDATES) {
    try {
      const res = await axios.get(`${BASE_URL}/data`, {
        params: { ...baseParams, data: layer, size: 1 },
      });
      const body = res.data?.response;
      
      if (body?.status === 'OK' || body?.status === 'NOT_FOUND') {
        workingLayer = layer;
        onProgress?.(`연결 성공 레이어: ${layer}`);
        break;
      } else {
          onProgress?.(`${layer} 시도 실패: ${body?.error?.text || '권한 없음'}`);
      }
    } catch (e) {
      continue;
    }
  }

  if (!workingLayer) {
    throw new Error(
      '사용 가능한 건물 레이어를 찾을 수 없습니다.\n' +
      '브이월드 인증키 설정에서 [2D 데이터 API]가 체크되어 있는지 다시 확인해주세요.'
    );
  }

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
      onProgress?.(`총 ${totalCount.toLocaleString()}개 건물 데이터 수집 시작...`);
    }

    const features = featureCollection.features ?? [];
    if (features.length === 0) break;

    ALL_FEATURES.push(...features);
    onProgress?.(`${ALL_FEATURES.length.toLocaleString()} / ${totalCount.toLocaleString()} 수집됨`);

    if (ALL_FEATURES.length >= totalCount || features.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 100));
  }

  return ALL_FEATURES;
}
