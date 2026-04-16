# 브이월드 3D 건물 데이터 추출 도구

브이월드 Open API 기반으로 주소 검색 → 반경 내 3D 건물 데이터 수집 → OBJ 파일 다운로드를 수행하는 독립 React 웹 앱입니다.

---

## 📁 폴더 구조

```
Vworld3Dtool/
├── .env                           ← API 키 (Git 미업로드)
├── .gitignore
├── index.html                     ← Cesium.js CDN, Google Fonts
├── vite.config.js                 ← Vite 설정 + CORS 프록시
├── package.json
└── src/
    ├── main.jsx                   ← React 진입점
    ├── index.css                  ← 글로벌 디자인 시스템 (다크 테마)
    ├── App.jsx                    ← 메인 앱 (상태 관리, 오케스트레이션)
    ├── components/
    │   ├── SearchControl.jsx      ← 사이드바 컨트롤 패널
    │   └── MapContainer.jsx       ← Cesium.js 3D 지도 렌더러
    └── utils/
        ├── vworldApi.js           ← 브이월드 Geocoder + Data API
        └── objConverter.js        ← GeoJSON → OBJ 변환기
```

---

## ⚙️ 설치 및 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev
```

---

## 🔑 API 키 설정

`.env` 파일에 브이월드 API 키를 입력합니다.

```env
VITE_VWORLD_API_KEY=발급받은_키_여기에_입력
```

> **브이월드 API 키 발급**: https://www.vworld.kr → 개발자 센터 → 인증키 신청

---

## 🚀 사용 방법

1. **주소 검색**: `주소 검색 (다음 API)` 버튼 클릭 → 주소 입력 → 선택
2. **반경 설정**: 슬라이더로 0.1 ~ 3.0 km 조절
3. **건물 수집**: `건물 데이터 수집` 버튼 클릭 → 진행 로그 확인
4. **다운로드**: `OBJ 파일 다운로드` 버튼 클릭

파일명: `[주소]_[반경]km_3d.obj`

---

## 🏗️ 3ds Max에서 OBJ 가져오기

1. **File → Import → Import...** → `.obj` 파일 선택
2. Import 옵션:
   - **Coordinate System**: Z-up (OBJ 기본값, 3ds Max 자동 인식)
   - **Scale**: 1 Unit = 1 Meter 설정 권장
3. 로컬 좌표계로 자동 원점 보정되어 있으므로 별도 이동 불필요

---

## 🔧 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 프레임워크 |
| Vite | 8 | 빌드/개발 서버 |
| Cesium.js | 1.120 (CDN) | 3D 지구/지도 렌더링 |
| react-daum-postcode | Latest | 한국 주소 검색 |
| Axios | Latest | HTTP 요청 |
| Vworld Open API | 2.0 | 지도 타일 + 건물 데이터 |

---

## ⚠️ 주의사항

- 브이월드 API는 **하루 요청 횟수 제한**이 있습니다 (무료: 3,000회/일)
- 반경이 클수록 데이터 양이 많아 **수집 시간이 오래** 걸릴 수 있습니다
- CORS 정책으로 인해 브이월드 API 직접 호출 시 제한이 있을 수 있습니다. 필요 시 백엔드 프록시 구성을 권장합니다
- `.env` 파일은 절대 Git에 커밋하지 마세요 (`.gitignore`에 포함됨)
