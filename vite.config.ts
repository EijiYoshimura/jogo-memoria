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
      // 75b (HUB-81): precache do app-shell completo para abrir offline —
      // JS/CSS/HTML + fontes BB (.woff2), imagens dos cards/logos (.png/.svg),
      // manifest (.webmanifest) e favicon (.ico).
      globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest,ico}'],
      // O bundle principal (~1.5 MB, build com minify:false) excede o limite
      // padrão de 2 MiB; elevar para garantir que o chunk entre no precache.
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      // autoUpdate: descartar precaches de versões anteriores no activate.
      cleanupOutdatedCaches: true,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/remoteEntry\.js$/, /\/api\//],
      runtimeCaching: [
        {
          // config.json é buscado em runtime pelo ConfigLoader e guarda os
          // paths das cartas. NetworkFirst: online pega a versão fresca
          // (operador pode editar por evento); offline cai no último cache.
          urlPattern: /\/config\.json$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'config-json',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 1 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Supabase (sync de leads): nunca cachear chamadas de dados —
          // o leadsSync decide online/offline e o idb persiste localmente.
          urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
          handler: 'NetworkOnly',
        },
      ],
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
