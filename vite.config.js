import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://172.20.32.91',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://172.20.32.91',
        ws: true,
      },
    },
  },
})
