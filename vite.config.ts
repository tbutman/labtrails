import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), cspMeta()],
  build: { assetsInlineLimit: 0 },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
