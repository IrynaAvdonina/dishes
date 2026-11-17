import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // відносні шляхи: працює і на GitHub Pages (адреса /назва-репозиторію/), і локально
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180.png'],
      workbox: {
        // усе потрібне для роботи без інтернету; шрифти — лише кирилиця й латиниця
        // (іконки додаються окремо через includeAssets і manifest)
        globPatterns: ['**/*.{js,css,html}', '**/*-cyrillic-[0-9]*.woff2', '**/*-latin-[0-9]*.woff2'],
        navigateFallback: 'index.html'
      },
      manifest: {
        id: './',
        name: 'Страви',
        short_name: 'Страви',
        description: 'Мій каталог страв',
        lang: 'uk',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#ffffff',
        theme_color: '#3149B8',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // повна квадратна версія: Android сам обрізає її під форму значків телефона
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ]
})
