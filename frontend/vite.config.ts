import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000'
  const isHttps = /^https:\/\//.test(proxyTarget)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // xlsx-js-style brauzerda kerak bo'lmagan Node 'stream' modulini import qiladi.
        // Bo'sh stub bilan almashtirish konsoldagi ogohlantirishni jim qiladi.
        stream: path.resolve(__dirname, 'src/utils/empty-stream-stub.js'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttps,
          ws: true,
        },
      },
    },
  }
})
