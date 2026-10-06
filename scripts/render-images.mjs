// Renders the app's images with the locally installed Google Chrome, as on tbutman-site and
// BabyTrails: the app icons, the Open Graph image for link previews, and the fictional sample report
// used by the demo. The results are committed; run this only to change them.
//
//   node scripts/render-images.mjs
//
// Every name and value in these images is made up.

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (p) => join(root, 'public', p)
const inter = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64')
const fontFace = `@font-face{font-family:Q;font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format('woff2')}`
const page0 = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}html,body{margin:0;background:transparent}svg{display:block}${css}</style></head><body>${body}</body></html>`

// The trail mark: three teal dots rising on ink. Maskable icons keep the mark inside the safe zone.
function icon(size, maskable) {
  const s = maskable ? 0.62 : 0.8
  const o = (1 - s) / 2
  const p = (x, y) => [size * (o + x * s), size * (o + y * s)]
  const [a, b, c] = [p(0.18, 0.72), p(0.5, 0.5), p(0.82, 0.28)]
  const r = size * s * 0.1
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" ${maskable ? '' : `rx="${size * 0.22}"`} fill="#1D2340"/>
  <path d="M${a} Q${b[0] - size * 0.08},${b[1] + size * 0.02} ${b} T${c}" fill="none" stroke="#4FC6AE" stroke-width="${size * 0.035}" stroke-linecap="round" opacity="0.7"/>
  ${[a, b, c].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#4FC6AE"/>`).join('')}
</svg>`
}

function ogImage() {
  const pts = [88, 92, 95, 97, 104, 112]
  const ranges = [[65, 99], [65, 99], [70, 110], [70, 110], [70, 110], [70, 110]]
  const W = 460, H = 250, lo = 50, hi = 125
  const x = (i) => 30 + i * ((W - 60) / 5)
  const y = (v) => H - 20 - ((v - lo) / (hi - lo)) * (H - 40)
  const chart = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${ranges.map(([a, b], i) => `<rect x="${x(i) - 9}" y="${y(b)}" width="18" height="${y(a) - y(b)}" rx="9" fill="#1F4640" stroke="#4FC6AE" stroke-opacity=".5"/>`).join('')}
<polyline points="${pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="#7FD8C5" stroke-width="4"/>
${pts.map((v, i) => (i === 5 ? `<circle cx="${x(i)}" cy="${y(v)}" r="13" fill="#3B1C33" stroke="#F2A7D3" stroke-width="4"/><text x="${x(i)}" y="${y(v) + 6}" text-anchor="middle" font-size="17" font-weight="700" fill="#F2A7D3" font-family="system-ui">!</text>` : `<circle cx="${x(i)}" cy="${y(v)}" r="8" fill="#4FC6AE"/>`)).join('')}
</svg>`
  return page0(
    `<main><div>
<div class="w"><svg width="70" height="50" viewBox="0 0 28 20"><path d="M4 15 C 9 14, 12 10, 14 9 S 20 5, 24 4" fill="none" stroke="#7FD8C5" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="15" r="3" fill="#4FC6AE"/><circle cx="14" cy="9" r="3" fill="#4FC6AE"/><circle cx="24" cy="4" r="3" fill="#4FC6AE"/></svg><div>lab<span>trails</span></div></div>
<h1>Every blood test, one clear timeline.</h1>
<p>Each marker over time, against each lab's own range. Encrypted on your device. Free and open source.</p>
</div>${chart}</main>`,
    `main{width:1200px;height:630px;background:#12162B;color:#F1EFE6;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 80px;box-sizing:border-box}
.w{font-family:Q,system-ui;font-size:60px;font-weight:650;letter-spacing:-.03em;display:flex;align-items:center;gap:20px}.w span{color:#7FD8C5}
h1{font-family:Q,system-ui;font-size:50px;font-weight:750;letter-spacing:-.035em;line-height:1.06;margin:36px 0 18px;max-width:580px}
p{font-family:Q,system-ui;font-size:24px;color:#A9ACC2;margin:0;max-width:560px;line-height:1.4}`,
  )
}

// Matches DEMO_EXTRACTION in src/app/demo.ts.
function sampleReport() {
  const rows = [
    ['Glicose', '108', 'mg/dL', '70 - 110', ''],
    ['Glic. hemoglobina A1c', '5,7', '%', '4,0 - 6,0', ''],
    ['Colesterol total', '214', 'mg/dL', '&lt; 190', 'H'],
    ['Colesterol HDL', '55', 'mg/dL', '&gt; 40', ''],
    ['Colesterol LDL', '133', 'mg/dL', '&lt; 116', 'H'],
    ['Triglicéridos', '112', 'mg/dL', '&lt; 150', ''],
    ['TGP/ALT', '24', 'U/L', '&lt; 41', ''],
    ['Creatinina', '0,98', 'mg/dL', '0,70 - 1,20', ''],
    ['Ferritina', '41', 'ng/mL', '30 - 400', ''],
    ['25-OH Vitamina D', '36', 'ng/mL', '30 - 100', ''],
    ['Proteína C reactiva', '&lt;0,5', 'mg/L', '&lt; 5,0', ''],
    ['Cistatina C', '0,80', 'mg/L', '0,61 - 0,95', ''],
  ]
  return page0(
    `<div class="page"><div class="wm">EXEMPLO · FICTÍCIO</div>
<h1>Laboratório Exemplo</h1><div class="sub">Análises Clínicas · Lisboa · documento fictício para demonstração</div>
<div class="meta"><span><b>Utente:</b> Sam (demo)</span><span><b>Data da colheita:</b> 15/09/2026</span><span><b>N.º de processo:</b> 000000</span><span><b>Jejum:</b> sim</span></div>
<table><thead><tr><th>Análise</th><th>Resultado</th><th>Unidade</th><th>Valores de referência</th><th></th></tr></thead><tbody>
${rows.map(([a, v, u, r, f]) => `<tr><td>${a}</td><td class="v">${v}</td><td>${u}</td><td>${r}</td><td class="f">${f}</td></tr>`).join('')}
</tbody></table>
<div class="foot">Todos os nomes e valores deste documento são fictícios. Gerado para a demonstração do LabTrails.</div></div>`,
    `body{font-family:Georgia,serif;color:#222;background:#fff}
.page{width:794px;padding:48px 56px;box-sizing:border-box;position:relative;background:#fff}
h1{font-size:22px;margin:0}.sub{font-size:12px;color:#555;margin:4px 0 20px}
.meta{display:grid;grid-template-columns:1fr 1fr;font-size:13px;border:1px solid #bbb;padding:10px 14px;margin-bottom:20px;gap:4px}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;border-bottom:2px solid #333;padding:6px 4px}
td{padding:6px 4px;border-bottom:1px solid #ddd}td.v{font-weight:bold}td.f{font-weight:bold}
.wm{position:absolute;top:360px;left:80px;transform:rotate(-24deg);font:bold 64px Arial,sans-serif;color:rgba(200,0,0,.13);letter-spacing:4px}
.foot{font-size:11px;color:#666;margin-top:24px}`,
  )
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
for (const [name, size, maskable] of [['icons/icon-192.png', 192, false], ['icons/icon-512.png', 512, false], ['icons/maskable-512.png', 512, true], ['icons/apple-touch-icon.png', 180, true]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(page0(icon(size, maskable)))
  await page.screenshot({ path: out(name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(ogImage(), { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out('og.png') })

const sample = await browser.newPage({ viewport: { width: 794, height: 800 }, deviceScaleFactor: 1.5 })
await sample.setContent(sampleReport())
await sample.locator('.page').screenshot({ path: out('demo/sample-report.png') })
await browser.close()
console.log('Rendered icons, og.png and demo/sample-report.png')
