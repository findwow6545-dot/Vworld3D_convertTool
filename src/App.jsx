import { useState, useCallback, useMemo } from 'react';
import SearchControl from './components/SearchControl';
import MapContainer from './components/MapContainer';
import { generateObjFile, downloadObjFile } from './utils/objConverter';
import { geocodeAddress, fetchBuildingData } from './utils/vworldApi';

function App() {
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null); 
  const [radius, setRadius] = useState(0.5);
  const [features, setFeatures] = useState([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [objCache, setObjCache] = useState(null);

  const pushLog = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const newLog = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), icon, message, type };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  const handleAddressSelect = useCallback((data) => {
    if (!data) return;
    setCoord(data);
    setAddress(data.address);
    setFeatures([]);
    setObjCache(null);
    pushLog(`위치 설정 완료: ${data.address}`, 'success', '📍');
  }, [pushLog]);

  const handleFetch = useCallback(async () => {
    if (!coord) {
      pushLog('먼저 주소를 검색해주세요.', 'error', '❌');
      return;
    }
    setIsCollecting(true);
    setFeatures([]);
    pushLog(`수집 시작: 반경 ${radius} km`, 'info', '🚀');

    try {
      const buildings = await fetchBuildingData(coord.lat, coord.lng, radius);
      setFeatures(buildings);
      pushLog(`수집 완료: 총 ${buildings.length.toLocaleString()}개 건물`, 'success', '✅');
    } catch (err) {
      pushLog(`수집 오류: ${err.message}`, 'error', '❌');
    } finally {
      setIsCollecting(false);
    }
  }, [coord, radius, pushLog]);

  const handleDownload = useCallback(() => {
    if (!features.length || !coord) return;
    const objStr = generateObjFile(features, coord);
    const safeName = (address || 'vworld').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
    downloadObjFile(objStr, `${safeName}_${radius.toFixed(1)}km.obj`);
    pushLog(`다운로드 완료`, 'success', '⬇️');
  }, [features, coord, address, radius, pushLog]);

  const stats = useMemo(() => ({
    total: features.length,
    withHeight: features.filter(f => f.properties?.A18 || f.properties?.height).length,
    vertices: features.length * 24 // Approximate
  }), [features]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <SearchControl 
          coord={coord}
          radius={radius}
          setRadius={setRadius}
          onAddressSelect={handleAddressSelect}
          onFetch={handleFetch}
          onDownload={handleDownload}
          isCollecting={isCollecting}
          logs={logs}
          stats={stats}
          geocodeAddress={geocodeAddress}
        />
      </aside>
      
      <main className="map-area">
        <MapContainer coord={coord} radius={radius} features={features} />
      </main>

      {/* 🔴 고정형 카피라이트 (좌측 하단) */}
      <div className="fixed-copyright">
        © 국립목포대학교 조경학과 조경표현연구실 (Landscape Expression Lab)
      </div>
    </div>
  );
}

export default App;
