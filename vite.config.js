import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The shoreline is a quarter of the bundle and changes when the source
        // data does, not when the app does. In a chunk of its own it keeps its
        // name across deploys, so a phone that has it never downloads it again.
        manualChunks: (id) => (id.includes('/src/coastlineData.js') ? 'coastline' : undefined),
      },
    },
  },
  server: {
    // Forward briefing requests to the API server so the key stays server-side.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
