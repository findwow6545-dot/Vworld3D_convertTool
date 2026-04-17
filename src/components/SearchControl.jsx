import { useRef, useEffect } from 'react';

const RADIUS_MIN = 0.1;
const RADIUS_MAX = 1.0;
const RADIUS_STEP = 0.1;

export default function SearchControl({
  coord,
  radius,
  setRadius,
  onAddressSelect,
  onFetch,
  onDownload,
  onImageDownload,
  isCollecting,
  logs,
  stats,
  geocodeAddress,
  isOpen,
  setIsOpen,
}) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 주소 검색 실행 (Daum Postcode 팝업)
  const handleOpenPostcode = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: async (data) => {
        const fullAddress = data.roadAddress || data.address;
        try {
          const result = await geocodeAddress(fullAddress);
          onAddressSelect(result);
        } catch (err) {
          console.error('주소 변환 오류:', err);
          alert(`주소 정보를 가져오지 못했습니다: ${err.message}`);
        }
      },
    }).open();
  };

  const address = coord?.address || '';
  const sliderPct = ((radius - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100;
  const sliderBg = `linear-gradient(to right, var(--color-accent) ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%)`;

  return (
    <div className="search-control">
      <div className="sidebar-header">
        <div className="badge">VWORLD 3D TOOL</div>
        <h1 className="sidebar-title">3D 건물 DATA 추출 도구</h1>
        <p className="sidebar-subtitle">주소 검색 → 반경 설정 → OBJ 다운로드</p>
        <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
          © 국립목포대학교 조경학과 조경표현연구실
        </div>
      </div>

      {/* ── 주소 설정 ── */}
      <div className="sidebar-section">
        <div className="section-label">■ 주소 설정</div>
        <div
          className={`address-input-box ${address ? 'selected' : ''}`}
          onClick={handleOpenPostcode}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleOpenPostcode()}
        >
          <div className="address-text">
            {address ? (
              <>
                <div className="address-main">{address}</div>
                {coord && (
                  <div className="address-sub">
                    {coord.lat.toFixed(5)}°N &nbsp;{coord.lng.toFixed(5)}°E
                  </div>
                )}
              </>
            ) : (
              <div className="address-placeholder">주소를 입력하세요</div>
            )}
          </div>
        </div>
        <button className="btn-search-address" onClick={handleOpenPostcode}>
          🔍 주소 검색 (다음 API)
        </button>
      </div>

      {/* ── 실행 ── */}
      <div className="sidebar-section">
        <div className="section-label">■ 실행</div>
        <button
          className="btn-primary"
          onClick={onFetch}
          disabled={isCollecting || !coord}
        >
          {isCollecting ? (
            <><div className="spinner" /> 📡 데이터 수집 중...</>
          ) : (
            <>🏗️ 건물 데이터 수집</>
          )}
        </button>
        {stats.total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button className="btn-download" onClick={onDownload} disabled={isCollecting}>
              ⬇️ OBJ 파일 다운로드
            </button>
            <button className="btn-download" onClick={onImageDownload} disabled={isCollecting} style={{ background: 'rgba(16, 185, 129, 0.3)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              📸 위성사진(JPG) 다운로드
            </button>
          </div>
        )}
      </div>

      {/* ── 반경 설정 ── */}
      <div className="sidebar-section">
        <div className="section-label">■ 추출 반경</div>
        <div className="slider-container">
          <div className="slider-header">
            <span className="slider-title">반경 (Radius)</span>
            <div className="slider-value">{radius.toFixed(1)}<span>km</span></div>
          </div>
          <input
            type="range"
            className="range-input"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={RADIUS_STEP}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            style={{ background: sliderBg }}
          />
        </div>
      </div>


      {/* ── 로그 ── */}
      <div className="sidebar-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="section-label">■ 진행 로그</div>
        <div className="log-container">
          {logs.map((log) => (
            <div key={log.id} className={`log-item ${log.type}`}>
              <div className="log-content">
                <span className="log-time" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginRight: '4px' }}>{log.time}</span>
                <span style={{ marginRight: '4px' }}>{log.icon}</span>
                <span className="log-message" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)' }}>{log.message}</span>
              </div>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
