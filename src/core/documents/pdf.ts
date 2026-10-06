// pdf.js, loaded only when a PDF is opened. Its worker, WebAssembly decoders, fonts and character
// maps all come from the app's own origin (scripts/copy-pdfjs.mjs), so the CSP can stay strict.

import type { PDFDocumentProxy } from 'pdfjs-dist'

const ASSETS = '/vendor/pdfjs'

let pdfjs: Promise<typeof import('pdfjs-dist')> | undefined

function load() {
  pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjs
}

// Opens a PDF. Call close() when done, to stop its worker.
export async function openPdf(bytes: Uint8Array<ArrayBuffer>): Promise<{ pdf: PDFDocumentProxy; close: () => Promise<void> }> {
  const lib = await load()
  // pdf.js takes ownership of the buffer, so give it a copy.
  const task = lib.getDocument({
    data: bytes.slice(),
    wasmUrl: `${ASSETS}/wasm/`,
    standardFontDataUrl: `${ASSETS}/standard_fonts/`,
    cMapUrl: `${ASSETS}/cmaps/`,
    iccUrl: `${ASSETS}/iccs/`,
    enableXfa: false,
  })
  return { pdf: await task.promise, close: () => task.destroy() }
}

// Renders one page (1-based) into a canvas, sized to the given CSS width.
export async function renderPage(pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const ratio = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
  await page.render({ canvas, viewport }).promise
  page.cleanup()
}
