import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/eonet': {
        target: 'https://eonet.gsfc.nasa.gov',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/eonet/, '')
      }
    }
  }
})
