import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward briefing requests to the API server so the key stays server-side.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
