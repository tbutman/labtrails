// Shows a stored document: a photo, every page of a PDF, or just one page (for the review screen,
// where the source sits next to the extracted values).

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { RecordStore } from '../store/types'
import { documentBytes, type DocumentRecord } from './documents'
import { openPdf, renderPage } from './pdf'

type Props = {
  store: RecordStore
  doc: DocumentRecord
  // Show only this page of a PDF (1-based), with previous/next buttons.
  page?: number
  onPageChange?: (page: number) => void
  alt?: string
}

export function DocumentViewer({ store, doc, page, onPageChange, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    let objectUrl: string | null = null
    let close: (() => Promise<void>) | null = null
    documentBytes(store, doc)
      .then(async (bytes) => {
        if (!live) return
        if (doc.mimeType === 'application/pdf') {
          const opened = await openPdf(bytes)
          close = opened.close
          if (live) setPdf(opened.pdf)
          else void close()
        } else {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType }))
          setUrl(objectUrl)
        }
      })
      .catch(() => live && setError("This document couldn't be opened."))
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      void close?.()
    }
  }, [store, doc])

  if (error) return <p className="error">{error}</p>
  if (url) return <img className="doc-image" src={url} alt={alt ?? doc.title} />
  if (!pdf) return <p className="muted">Opening…</p>

  if (page !== undefined) {
    const current = Math.min(Math.max(1, page), pdf.numPages)
    return (
      <div className="doc-pdf">
        <PdfPage pdf={pdf} pageNumber={current} label={`${doc.title}, page ${current} of ${pdf.numPages}`} />
        {pdf.numPages > 1 && onPageChange && (
          <div className="row doc-pager">
            <button type="button" className="button small" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
              Previous page
            </button>
            <span className="muted">
              Page {current} of {pdf.numPages}
            </span>
            <button type="button" className="button small" disabled={current >= pdf.numPages} onClick={() => onPageChange(current + 1)}>
              Next page
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="doc-pdf">
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <PdfPage key={i} pdf={pdf} pageNumber={i + 1} label={`${doc.title}, page ${i + 1} of ${pdf.numPages}`} />
      ))}
    </div>
  )
}

function PdfPage({ pdf, pageNumber, label }: { pdf: PDFDocumentProxy; pageNumber: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const width = Math.min(canvas.parentElement?.clientWidth ?? 600, 900)
    void renderPage(pdf, pageNumber, canvas, width)
  }, [pdf, pageNumber])
  return <canvas ref={ref} role="img" aria-label={label} className="doc-page" />
}
