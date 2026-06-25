import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), federation({
    name: 'jogo-memoria',
    filename: 'remoteEntry.js',
    exposes: {
      './MemoryGame': './src/game/index.tsx',
    },
    shared: ['react', 'react-dom'],
  }), cloudflare()],
  build: {
    target: 'esnext',
    minify: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
