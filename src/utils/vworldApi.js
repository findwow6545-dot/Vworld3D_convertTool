const ADDR_BASE = '/api-addr';
const DATA_BASE = '/api-data';

const API_KEY = (import.meta.env.VITE_VWORLD_API_KEY || '').trim();

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
  const response = await fetch(`${ADDR_BASE}?${params.toString()}`);
  const data = await response.json();
  if (data.response?.status === 'OK') {
    const { x, y } = data.response.result.point;
    return { lat: parseFloat(y), lng: parseFloat(x), address };
  }
  throw new Error('주소 변환 실패');
};

export const fetchBuildingData = async (lat, lng, radiusKm = 0.5) => {
  const radiusDegrees = (radiusKm * 1.5) / 111; 
  const xmin = lng - radiusDegrees;
  const ymin = lat - radiusDegrees;
  const xmax = lng + radiusDegrees;
  const ymax = lat + radiusDegrees;

  const params = new URLSearchParams({
    key: API_KEY,
    service: 'data',
    request: 'GetFeature',
    data: 'LT_C_AISBLD', 
    geomFilter: `BOX(${xmin},${ymin},${xmax},${ymax})`,
    geometry: 'true',
    domain: window.location.hostname,
    size: '1000',
    format: 'json',
    crs: 'EPSG:4326'
    // attrFilter 제거 (데이터 수집률 극대화)
  });

  try {
    const response = await fetch(`${DATA_BASE}?${params.toString()}`);
    const data = await response.json();

    if (data.GMLFeatureCollection?.featureMember) {
      const members = Array.isArray(data.GMLFeatureCollection.featureMember) 
        ? data.GMLFeatureCollection.featureMember : [data.GMLFeatureCollection.featureMember];
      
      return members.map(fm => {
        const feature = Object.values(fm)[0];
        const p = feature.properties;
        
        // 높이 정보 보정 (높이가 없으면 층수 * 3.5m, 그것도 없으면 기본 10m)
        let h = parseFloat(p.bld_hgt || p.height_m || p.A18 || 0);
        if (h <= 0 && p.gro_flo_co) h = parseInt(p.gro_flo_co) * 3.5;
        if (h <= 1) h = 10; 
        
        feature.properties.bld_hgt = h;
        return { type: 'Feature', geometry: feature.geometry, properties: feature.properties };
      });
    }
  } catch (err) {
    console.error('Fetch Building Error:', err);
  }
  return [];
};
