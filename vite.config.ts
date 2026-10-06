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
// service worker registers from its own file (no inline script, which the CSP forbids), precaches the
// app's files and never caches anything else, so AI requests always go to the network.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'script',
  includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'LabTrails',
    short_name: 'LabTrails',
    description: 'Your blood test results, private and in one place.',
    start_url: '/',
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
    navigateFallback: '/index.html',
    runtimeCaching: [],
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
