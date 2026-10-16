import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cert = env.DEV_HTTPS_CERT
  const key = env.DEV_HTTPS_KEY
  if (Boolean(cert) !== Boolean(key)) throw new Error('Set both DEV_HTTPS_CERT and DEV_HTTPS_KEY')
  return {
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
    https: cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined,
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
  }
})
