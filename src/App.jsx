import { useState, useCallback, useMemo } from 'react';
import SearchControl from './components/SearchControl';
import MapContainer from './components/MapContainer';
import { generateObjFile, downloadObjFile } from './utils/objConverter';
import { geocodeAddress, fetchComplexData } from './utils/vworldApi'; // 이름 변경

function App() {
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null); 
  const [radius, setRadius] = useState(0.5);
  const [data, setData] = useState({ buildings: [], roads: [] }); // 통합 데이터 구조
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState([]);

  const pushLog = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const newLog = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), icon, message, type };
    setLogs(prev => [...prev.slice(-19), newLog]);
  }, []);

  const handleAddressSelect = useCallback((data) => {
    setCoord(data);
    setAddress(data.address);
    setData({ buildings: [], roads: [] });
    pushLog(`위치 설정: ${data.address}`, 'success', '📍');
  }, [pushLog]);

  const handleFetch = useCallback(async () => {
    if (!coord) return;
    setIsCollecting(true);
    setData({ buildings: [], roads: [] });
    pushLog(`복합 데이터(건물+도로) 수집 시작...`, 'info', '🚀');

    try {
      const complexResult = await fetchComplexData(coord.lat, coord.lng, radius, (msg) => pushLog(msg, 'info', '📡'));
      setData(complexResult);
      pushLog(`수집 성공! 건물 ${complexResult.buildings.length}개, 도로 ${complexResult.roads.length}개`, 'success', '✅');
    } catch (err) {
      pushLog(`수집 오류: ${err.message}`, 'error', '❌');
    } finally {
      setIsCollecting(false);
    }
  }, [coord, radius, pushLog]);

  const handleDownload = useCallback(() => {
    if (!data.buildings.length && !data.roads.length) return;
    pushLog('OBJ 파일 생성 중...', 'info', '⚙️');
    const objStr = generateObjFile(data, coord);
    const safeName = (address || 'vworld').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
    downloadObjFile(objStr, `${safeName}_3D_Full.obj`);
    pushLog(`다운로드 완료`, 'success', '⬇️');
  }, [data, coord, address, pushLog]);

  const stats = useMemo(() => ({
    total: data.buildings.length + data.roads.length,
    buildings: data.buildings.length,
    roads: data.roads.length
  }), [data]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-text">VWORLD 3D</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '5px' }}>
            Advanced 3D Geometry Extractor
          </div>
        </div>

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

        <div style={{ padding: '20px', fontSize: '11px', color: 'var(--color-text-dim)', textAlign: 'center', borderTop: '1px solid var(--color-glass-border)', marginTop: 'auto' }}>
          © 국립목포대학교 조경학과 조경표현연구실<br/>
          Landscape Representation Lab. MNU
        </div>
      </aside>
      <main className="map-area">
        <MapContainer coord={coord} radius={radius} features={data.buildings} />
      </main>
    </div>
  );
}

export default App;
