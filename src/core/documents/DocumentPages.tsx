// Pages of one document (photos stored as a group, request 17): one page at a time with previous and
// next buttons, as the review screen shows a PDF; or every page in order, for reading it in full.

import type { RecordStore } from '../store/types'
import type { DocumentRecord } from './documents'
import { DocumentViewer } from './DocumentViewer'

export function DocumentPages({
  store,
  pages,
  page,
  onPageChange,
  alt,
}: {
  store: RecordStore
  pages: DocumentRecord[]
  /** Show only this page (1-based), with previous/next buttons. Without it, every page in order. */
  page?: number
  onPageChange?: (page: number) => void
  alt?: string
}) {
  const label = (n: number) => `${alt ?? pages[0]?.title ?? 'Document'}, page ${n} of ${pages.length}`
  if (page === undefined) {
    return (
      <div className="doc-pages">
        {pages.map((p, i) => (
          <figure key={p.id} className="doc-group-page">
            <DocumentViewer store={store} doc={p} alt={label(i + 1)} />
            <figcaption className="muted small">
              Page {i + 1} of {pages.length}
            </figcaption>
          </figure>
        ))}
      </div>
    )
  }
  const current = Math.min(Math.max(1, page), pages.length)
  return (
    <div className="doc-pages">
      <DocumentViewer key={pages[current - 1].id} store={store} doc={pages[current - 1]} alt={label(current)} />
      {pages.length > 1 && onPageChange && (
        <div className="row doc-pager">
          <button type="button" className="button small" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
            Previous page
          </button>
          <span className="muted">
            Page {current} of {pages.length}
          </span>
          <button type="button" className="button small" disabled={current >= pages.length} onClick={() => onPageChange(current + 1)}>
            Next page
          </button>
        </div>
      )}
    </div>
  )
}
