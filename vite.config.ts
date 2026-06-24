import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'jogo-memoria',
      filename: 'remoteEntry.js',
      exposes: {
        './MemoryGame': './src/game/index.tsx',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
  },
})
