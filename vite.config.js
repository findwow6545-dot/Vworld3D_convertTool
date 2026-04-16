import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_KEY = env.VITE_VWORLD_API_KEY;

  return {
    plugins: [react()],
    css: {
      devSourcemap: true,
    },
    server: {
      port: 3000,
      proxy: {
        // 주소 검색 프록시
        '/vworld-addr': {
          target: 'https://api.vworld.kr/req/address',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-addr/, ''),
        },
        // 데이터 수집 프록시
        '/vworld-data': {
          target: 'https://api.vworld.kr/req/data',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-data/, ''),
        },
        // WMTS 지도 프록시
        '/vworld-wmts': {
          target: `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-wmts/, ''),
        },
      },
    },
  };
});
