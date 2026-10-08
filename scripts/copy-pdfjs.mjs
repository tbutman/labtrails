// Copies pdf.js's support files (WebAssembly image decoders, standard fonts, character maps, color
// profiles) into public/vendor/pdfjs/, so the PDF viewer loads them from the app's own origin and
// the Content-Security-Policy can stay strict. The copy is git-ignored; pdf.js is Apache-2.0 and the
// decoders carry their own licenses (copied alongside).

import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'node_modules/pdfjs-dist')
const to = join(root, 'public/vendor/pdfjs')
mkdirSync(to, { recursive: true })
for (const dir of ['wasm', 'standard_fonts', 'cmaps', 'iccs']) cpSync(join(from, dir), join(to, dir), { recursive: true })
cpSync(join(from, 'LICENSE'), join(to, 'LICENSE'))
console.log('pdf.js assets ready')
