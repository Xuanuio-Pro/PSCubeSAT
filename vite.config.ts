import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'window',
    'process.env': {},
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 5175,
    host: true,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8005',
        ws: true,
      },
    },
    watch: {
      // Bỏ qua các thư mục backend để PlatformIO ghi firmware
      // không trigger Vite HMR reload trang
      ignored: [
        '**/build_cache/**',
        '**/fastapi-backend/**',
        '**/compiler-backend/**',
        '**/mosquitto/**',
        '**/node_modules/**',
        '**/.pio/**',
      ],
    },
  },
})
