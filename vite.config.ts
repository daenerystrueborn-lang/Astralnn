import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    // Sandbox preview serves the app under a generated *.e2b.app host.
    allowedHosts: true,
  },
})
