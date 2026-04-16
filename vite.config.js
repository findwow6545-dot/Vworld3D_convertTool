import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_KEY = env.VITE_VWORLD_API_KEY;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api-addr': {
          target: 'https://api.vworld.kr/req/address',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-addr/, ''),
        },
        '/api-data': {
          target: 'https://api.vworld.kr/req/data',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-data/, ''),
        },
        '/api-wmts': {
          target: `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-wmts/, ''),
        },
      },
    },
  };
});
