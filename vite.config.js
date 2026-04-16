import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_KEY = env.VITE_VWORLD_API_KEY;

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 2000,
    },
    // 빌드 시 Cesium을 외부 전역 변수로 인식하도록 설정 (중요: 빌드 중단 방지)
    optimizeDeps: {
      exclude: ['cesium']
    },
    server: {
      port: 3000,
      proxy: {
        '/vworld-addr': {
          target: 'https://api.vworld.kr/req/address',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-addr/, ''),
        },
        '/vworld-data': {
          target: 'https://api.vworld.kr/req/data',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-data/, ''),
        },
        '/vworld-wmts': {
          target: `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vworld-wmts/, ''),
        },
      },
    },
  };
});
