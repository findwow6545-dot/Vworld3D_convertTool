import { useState, useCallback, useMemo } from 'react';
import SearchControl from './components/SearchControl';
import MapContainer from './components/MapContainer';
import { generateObjFile, downloadObjFile } from './utils/objConverter';
import { geocodeAddress, fetchComplexData } from './utils/vworldApi';

function App() {
  const [address, setAddress] = useState('');
  const [coord, setCoord] = useState(null); 
  const [radius, setRadius] = useState(0.5);
  const [data, setData] = useState({ buildings: [], roads: [] });
  const [lod, setLod] = useState('auto'); // 'auto', 'lod1', 'lod2', 'lod3'
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState([]);

  const pushLog = useCallback((message, type = 'info', icon = 'ℹ️') => {
    const newLog = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), icon, message, type };
    setLogs(prev => [...prev.slice(-29), newLog]);
  }, []);

  const handleAddressSelect = useCallback((data) => {
    setCoord(data);
    setAddress(data.address);
    setData({ buildings: [], roads: [] });
    pushLog(`위치 선택: ${data.address}`, 'success', '📍');
  }, [pushLog]);

  const handleFetch = useCallback(async () => {
    if (!coord) return;
    setIsCollecting(true);
    setData({ buildings: [], roads: [] });
    pushLog(`복합 데이터(건물+도로) 수집 시작...`, 'info', '🚀');

    try {
      const result = await fetchComplexData(
        coord.lat, coord.lng, radius, 
        lod,
        (msg) => pushLog(msg, 'info', '📡')
      );
      setData(result);
      pushLog(`수집 완료: 건물 ${result.buildings.length}개, 도로 ${result.roads.length}개`, 'success', '✅');
    } catch (err) {
      pushLog(`오류: ${err.message}`, 'error', '❌');
    } finally {
      setIsCollecting(false);
    }
  }, [coord, radius, pushLog]);

  const handleDownload = useCallback(() => {
    if (!data.buildings.length && !data.roads.length) return;
    const objStr = generateObjFile(data, coord);
    const safeName = (address || 'vworld').replace(/[\\/:*?"<>|]/g, '_').slice(0, 20);
    downloadObjFile(objStr, `${safeName}_3D_Full.obj`);
  }, [data, coord, address]);

  const stats = useMemo(() => ({
    total: (data?.buildings?.length || 0) + (data?.roads?.length || 0),
    withHeight: data?.buildings?.length || 0,
    vertices: ((data?.buildings?.length || 0) * 24) + ((data?.roads?.length || 0) * 4)
  }), [data]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <SearchControl 
          coord={coord}
          radius={radius}
          setRadius={setRadius}
          lod={lod}
          setLod={setLod}
          onAddressSelect={handleAddressSelect}
          onFetch={handleFetch}
          onDownload={handleDownload}
          isCollecting={isCollecting}
          logs={logs}
          stats={stats}
          geocodeAddress={geocodeAddress}
        />

        <div style={{ padding: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
          © 국립목포대학교 조경학과 조경표현연구실
        </div>
      </aside>
      <main className="map-area">
        <MapContainer coord={coord} radius={radius} features={data.buildings} />
      </main>
    </div>
  );
}

export default App;
