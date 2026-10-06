import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The Content-Security-Policy, the same as BabyTrails' and also sent by the server. The <meta> copy
// protects the built app wherever it's served; it's left out in development because Vite's dev
// server injects inline scripts.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  }
}

// Installable and offline (SPEC.md feature 10). Installing also protects stored data on iPhone. The
// core's UpdatePrompt registers the service worker and offers a Reload banner when a new version has
// downloaded, as BabyTrails does: switching mid-task would lock the vault and drop anything being typed.
// It precaches the app's files, caches pdf.js's larger support files the first time a PDF needs them,
// and never caches anything else, so AI requests always go to the network.
const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'LabTrails',
    short_name: 'LabTrails',
    description: 'Your blood test results, private and in one place.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFBF2',
    theme_color: '#12162B',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
    // Not up front: pdf.js's support files (cached on first use, below), the landing page's images
    // and link preview, and Inter's non-Latin subsets (the UI is English).
    globIgnores: ['vendor/**', 'landing/**', 'og.png', 'assets/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/vendor/pdfjs/'),
        handler: 'CacheFirst',
        options: { cacheName: 'pdfjs-assets', expiration: { maxEntries: 300 } },
      },
    ],
  },
})

export default defineConfig({
  plugins: [react(), cspMeta(), pwa],
  build: { assetsInlineLimit: 0 },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
