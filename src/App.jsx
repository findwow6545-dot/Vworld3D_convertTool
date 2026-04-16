import { useState, useCallback, useMemo } from 'react';
import SearchControl from './components/SearchControl';
import MapContainer from './components/MapContainer';
import { generateObjFile, downloadObjFile } from './utils/objConverter';
import { geocodeAddress, fetchBuildingsInRadius } from './utils/vworldApi';

function App() {
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null); 
  const [radius, setRadius] = useState(0.5);
  const [features, setFeatures] = useState([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState([]);

  const pushLog = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const newLog = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), icon, message, type };
    setLogs(prev => [...prev.slice(-29), newLog]);
  }, []);

  const handleAddressSelect = useCallback((data) => {
    setCoord(data);
    setAddress(data.address);
    setFeatures([]);
    pushLog(`위치 설정: ${data.address}`, 'success', '📍');
  }, [pushLog]);

  const handleFetch = useCallback(async () => {
    if (!coord) return;
    setIsCollecting(true);
    setFeatures([]);
    pushLog(`데이터 수집 시작...`, 'info', '🚀');

    try {
      const buildings = await fetchBuildingsInRadius(
        coord.lat, coord.lng, radius, 
        (msg) => pushLog(msg, 'info', '📡')
      );
      setFeatures(buildings);
      pushLog(`수집 완료: ${buildings.length}개 건물`, 'success', '✅');
    } catch (err) {
      pushLog(`오류: ${err.message}`, 'error', '❌');
    } finally {
      setIsCollecting(false);
    }
  }, [coord, radius, pushLog]);

  const handleDownload = useCallback(() => {
    if (!features.length) return;
    const objStr = generateObjFile(features, coord);
    const safeName = (address || 'vworld').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
    downloadObjFile(objStr, `${safeName}.obj`);
  }, [features, coord, address]);

  const stats = useMemo(() => ({
    total: features.length,
    withHeight: features.length,
    vertices: features.length * 24
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
        {/* 진단 정보 (검색창 바로 밑으로 이동) */}
        <div style={{ padding: '15px 30px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', margin: '0 30px 20px' }}>
          <div style={{ fontSize: '11px', color: '#00d2ff', fontWeight: 'bold', marginBottom: '5px' }}>🚨 배포 환경 진단 도구</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>도메인: {window.location.hostname}</div>
          <div style={{ fontSize: '10px', color: import.meta.env.VITE_VWORLD_API_KEY ? '#00ff00' : '#ff4444', fontWeight: 'bold' }}>
            API 키 상태: {import.meta.env.VITE_VWORLD_API_KEY ? '✅ 설정됨' : '❌ 미설정 (Vercel 확인 필요)'}
          </div>
        </div>
        {/* 키 및 도메인 진단 정보 */}
        <div style={{ padding: '10px 20px', fontSize: '10px', color: 'rgba(255,255,255,0.2)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div>도메인: {window.location.hostname}</div>
          <div>API 키: {import.meta.env.VITE_VWORLD_API_KEY ? '설정됨' : '미설정(확인필요)'}</div>
        </div>
        {/* 국립목포대학교 카피라이트 */}
        <div style={{ padding: '15px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0' }}>
          © 국립목포대학교 조경학과 조경표현연구실
        </div>
      </aside>
      <main className="map-area">
        <MapContainer coord={coord} radius={radius} features={features} />
      </main>
    </div>
  );
}

export default App;
