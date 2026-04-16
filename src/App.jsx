import { useState, useCallback, useMemo, useEffect } from 'react';
import SearchControl from './components/SearchControl';
import MapContainer from './components/MapContainer';
import { generateObjFile, downloadObjFile } from './utils/objConverter';
import { geocodeAddress, fetchBuildingData } from './utils/vworldApi'; // fetchBuildingsInRadius 추가

function App() {
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null); 
  const [radius, setRadius] = useState(0.5);
  const [features, setFeatures] = useState([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [objCache, setObjCache] = useState(null);

  const pushLog = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const newLog = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      icon,
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  const handleAddressSelect = useCallback((data) => {
    if (!data || !data.address) return;
    setCoord(data);
    setAddress(data.address);
    setFeatures([]);
    setObjCache(null);
    pushLog(`위치 설정 완료: ${data.address}`, 'success', '📍');
  }, [pushLog]);

  // ── 데이터 수집 실행 함수 ──
  const handleFetch = useCallback(async () => {
    if (!coord) {
      pushLog('먼저 주소를 검색해주세요.', 'error', '❌');
      return;
    }

    setIsCollecting(true);
    setFeatures([]);
    setObjCache(null);
    pushLog(`수집 시작: 반경 ${radius} km`, 'info', '🚀');

    try {
      const buildings = await fetchBuildingData(
        coord.lat,
        coord.lng,
        radius,
        (msg) => pushLog(msg, 'info', '📡') // 진행 상황 벌레 로그
      );
      
      setFeatures(buildings);
      pushLog(`수집 완료: 총 ${buildings.length.toLocaleString()}개 건물`, 'success', '✅');
    } catch (err) {
      console.error(err);
      pushLog(`수집 오류: ${err.message}`, 'error', '❌');
    } finally {
      setIsCollecting(false);
    }
  }, [coord, radius, pushLog]);

  const handleDownload = useCallback(() => {
    if (!features || features.length === 0 || !coord) {
      pushLog('다운로드할 데이터가 없습니다.', 'error', '❌');
      return;
    }
    pushLog('OBJ 변환 중...', 'info', '⚙️');
    const objStr = generateObjFile(features, coord);
    setObjCache(objStr);
    const safeName = (address || 'vworld').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20).trim();
    const filename = `${safeName}_${radius.toFixed(1)}km.obj`;
    downloadObjFile(objStr, filename);
    pushLog(`다운로드 완료: ${filename}`, 'success', '⬇️');
  }, [features, coord, address, radius, pushLog]);

  const stats = useMemo(() => {
    const safeFeatures = Array.isArray(features) ? features : [];
    if (safeFeatures.length === 0) return { total: 0, withHeight: 0, vertices: 0, fileSize: 0 };
    const withHeightCount = safeFeatures.filter((f) => {
      const p = f?.properties || {};
      return p.bld_hgt || p.height || p.HGT || p.hgt || p.A18 || p.height_m;
    }).length;
    const totalVertices = safeFeatures.reduce((acc, f) => {
      const geom = f?.geometry;
      if (!geom) return acc;
      let ringLen = 0;
      if (geom.type === 'Polygon') ringLen = geom.coordinates?.[0]?.length ?? 0;
      else if (geom.type === 'MultiPolygon') ringLen = geom.coordinates?.[0]?.[0]?.length ?? 0;
      return acc + (ringLen * 2);
    }, 0);
    return {
      total: safeFeatures.length,
      withHeight: withHeightCount,
      vertices: totalVertices,
      fileSize: objCache ? objCache.length : totalVertices * 40
    };
  }, [features, objCache]);

  return (
    <div className="app-container">
      <div className="content-layout">
        <aside className="sidebar">
          <SearchControl 
            coord={coord}
            radius={radius}
            setRadius={setRadius}
            onAddressSelect={handleAddressSelect}
            onFetch={handleFetch} // 함수 전달 추가
            onDownload={handleDownload}
            isCollecting={isCollecting}
            logs={logs}
            setLogs={setLogs}
            stats={stats}
            geocodeAddress={geocodeAddress}
          />
        </aside>
        <main className="map-area">
          <MapContainer 
            coord={coord}
            radius={radius}
            features={features}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
