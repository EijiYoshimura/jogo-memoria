import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#0333BD'

export default defineConfig({
  plugins: [react(), tailwindcss(), federation({
    name: 'jogo-memoria',
    filename: 'remoteEntry.js',
    exposes: {
      './MemoryGame': './src/game/index.tsx',
    },
    shared: ['react', 'react-dom'],
  }), cloudflare(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/apple-touch-icon.png'],
    manifest: {
      name: 'Jogo da Memória — BB Seguros',
      short_name: 'BB Jogo',
      lang: 'pt-BR',
      description: 'Jogo da Memória BB Seguros — ativação em totem.',
      start_url: '/',
      scope: '/',
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'portrait',
      background_color: THEME_COLOR,
      theme_color: THEME_COLOR,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // 75a: app-shell mínimo para "installable". Precache agressivo de
      // fontes/imagens e runtime caching ficam para a HUB-81 (75b).
      globPatterns: ['**/*.{js,css,html}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/remoteEntry\.js$/, /\/api\//],
    },
  })],
  build: {
    target: 'esnext',
    minify: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
