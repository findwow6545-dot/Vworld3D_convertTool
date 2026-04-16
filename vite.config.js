import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [],
    },
  },
  // 브이월드 CORS 우회 프록시 (개발 서버)
  server: {
    port: 3000,
    open: true,
    proxy: {
      // /vworld-api/* → https://api.vworld.kr/req/*  (Data/Geocoder API)
      '/vworld-api': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vworld-api/, '/req'),
        secure: true,
      },
      // /vworld-wmts/* → https://api.vworld.kr/req/wmts/* (Cesium 타일 CORS 우회)
      '/vworld-wmts': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vworld-wmts/, '/req/wmts'),
        secure: true,
      },
    },
  },
})
