import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/AIChess/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    host: 'localhost',
    port: 5173,
  },
  preview: {
    host: 'localhost',
    port: 4173,
  },
})
