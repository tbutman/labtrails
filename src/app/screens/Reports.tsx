import { FileClock, FilePlus2, FileSearch, Pencil, Plus, ScanText, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import type { DocumentRecord, RecordStore } from '../../core'
import { deleteDocument, pagesOf } from '../../core/documents/documents'
import { DocumentPages } from '../../core/documents/DocumentPages'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import type { StoredDoc } from '../../core/import/duplicates'
import { printedNumber, reportDecimal } from '../../labs/edit'
import { describeTiming } from '../../labs/timeline'
import type { Result } from '../../labs/types'
import { Chip, EmptyState, PageHeader } from '../../core/ui/components'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, plural } from '../format'

const RECENTLY: Record<string, string> = { illness: 'Recent illness', 'hard-exercise': 'Recent hard exercise', alcohol: 'Recent alcohol', 'poor-sleep': 'Poor sleep' }
const FASTING: Record<string, string> = { yes: 'Fasting', no: 'Not fasting', unknown: 'Fasting not known' }

export function Reports() {
  const { reports, results } = useProfileData()
  const { mode, store, changed, core, saveCore, version } = useSession()
  const { profile } = useProfileData()
  const base = useBase()
  // Coming back from correcting a result: reopen that report.
  const openId = useLocation().hash.replace('#report-', '')
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date))
  const [docs, setDocs] = useState<StoredDoc[]>([])
  useEffect(() => {
    if (!store) return
    void store.list<StoredDoc>('documents').then((d) => setDocs(d.filter((x) => x.profileId === profile.id)))
  }, [store, profile.id, version])
  // Files waiting to be read: marked so by the import, or older ones no report points at.
  const linked = new Set(reports.map((r) => r.documentId).filter(Boolean))
  // Photos stored as pages of one report are listed once, by their first page.
  const firsts = docs.filter((d) => !d.group || d.group.page === 1)
  const unread = firsts.filter((d) => d.meta?.importStatus === 'unread' || (!d.meta?.importStatus && !linked.has(d.id)))
  const kept = firsts.filter((d) => d.meta?.importStatus === 'stored')
  const pages = (d: StoredDoc) => pagesOf(d, docs)
  const docLabel = (d: StoredDoc) => (d.group ? `${d.title} · ${plural(pages(d).length, 'page')}` : d.title)
  const readLink = (list: StoredDoc[]) => `${base}/reports/read?documents=${list.flatMap(pages).map((d) => d.id).join(',')}`
  // Without a key, reading means AI the person can't use yet; viewing and typing the results still work (LAB-14).
  const noKey = mode === 'unlocked' && !core.ai.apiKey
  const read = (label: string) => (noKey ? `${label} with AI (needs a key)` : label)
  const fileActions = (d: StoredDoc) => (
    <>
      {store && <Original store={store} pages={pages(d)} label="View" />}
      {mode === 'unlocked' && (
        <Link className="button small" to={`${base}/reports/new?document=${d.id}`}>
          Type the results
        </Link>
      )}
    </>
  )

  async function removeDoc(doc: StoredDoc) {
    const all = pages(doc)
    const what = all.length > 1 ? `"${doc.title}" and its other ${plural(all.length - 1, 'page')}` : `"${doc.title}"`
    if (!store || !window.confirm(`Delete ${what}? This can't be undone, except from a backup.`)) return
    for (const page of all) await deleteDocument(store, page)
    changed()
  }

  async function remove(reportId: string, label: string) {
    if (!store || !window.confirm(`Delete the report from ${label} and its results? This can't be undone, except from a backup.`)) return
    for (const r of results.filter((x: Result) => x.reportId === reportId)) await store.delete('results', r.id)
    await store.delete('reports', reportId)
    await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
  }

  const actions = (
    <>
      <Link className="button primary" to={`${base}/reports/read`}>
        <ScanText size={16} aria-hidden /> Import reports
      </Link>
      {mode === 'unlocked' && (
        <Link className="button" to={`${base}/reports/new`}>
          <FilePlus2 size={16} aria-hidden /> Enter by hand
        </Link>
      )}
    </>
  )

  return (
    <>
      <PageHeader title="Reports" subtitle="Each test, with its results exactly as printed." actions={actions} />
      {unread.length > 0 && (
        <>
          <h2 className="section-title">
            <FileClock size={14} aria-hidden /> Not read yet · {unread.length}
          </h2>
          <div className="card padless">
            <ul className="list">
              {unread.map((d) => (
                <li key={d.id} className="list-row kept-file">
                  <span className="list-row-main">
                    <span className="list-row-title">{docLabel(d)}</span>
                    <span className="list-row-sub">Added {formatDate(d.createdAt.slice(0, 10))}</span>
                  </span>
                  <span className="row kept-file-actions">
                    <Link className="button small" to={readLink([d])}>
                      {read('Read')}
                    </Link>
                    {fileActions(d)}
                    <button className="icon-button" onClick={() => void removeDoc(d)} aria-label={`Delete ${d.title}`}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {unread.length > 1 && (
            <p className="row unread-all">
              <Link className="button small primary" to={readLink(unread)}>
                {read(`Read all ${unread.length}`)}
              </Link>
            </p>
          )}
        </>
      )}
      {kept.length > 0 && (
        <details className="disclosure kept-files">
          <summary>Kept without reading · {kept.length}</summary>
          <div className="disclosure-body">
            <ul className="list">
              {kept.map((d) => (
                <li key={d.id} className="list-row kept-file">
                  <span className="list-row-main">
                    <span className="list-row-title">{docLabel(d)}</span>
                  </span>
                  <span className="row kept-file-actions">
                    <Link className="button small" to={readLink([d])}>
                      {read('Read now')}
                    </Link>
                    {fileActions(d)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {(unread.length > 0 || kept.length > 0) && sorted.length > 0 && <h2 className="section-title">Saved reports</h2>}
      {sorted.length === 0 && (
        <EmptyState icon={FileSearch} title="No reports yet">
          Read a lab report with AI, or enter the results by hand.
        </EmptyState>
      )}
      {sorted.map((r) => {
        const rows = results.filter((x) => x.reportId === r.id)
        const decimal = reportDecimal(rows)
        return (
          <details key={r.id} id={`report-${r.id}`} className="disclosure" open={r.id === openId || undefined}>
            <summary>
              <span className="report-summary">
                <span>{formatDate(r.date)}</span>
                <span className="faint report-meta">
                  {[r.time, r.lab, plural(rows.length, 'result')].filter(Boolean).join(' · ')}
                </span>
              </span>
            </summary>
            <div className="disclosure-body">
              {r.context && (
                <div className="chip-group report-context" aria-label="Test context">
                  {r.context.fasting && <Chip tone="outline">{FASTING[r.context.fasting]}</Chip>}
                  {r.context.recently?.map((x) => (
                    <Chip key={x} tone="outline">
                      {RECENTLY[x]}
                    </Chip>
                  ))}
                  {r.context.medications && <Chip tone="outline">Medications: {r.context.medications}</Chip>}
                  {r.context.doseTiming?.map((t) => (
                    <Chip key={t.entryId} tone="outline">
                      Drawn {describeTiming(t, r.date)}
                    </Chip>
                  ))}
                </div>
              )}
              {r.context?.notes && <p className="small muted">Notes: {r.context.notes}</p>}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">As printed</th>
                      <th scope="col">Value</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Range as printed</th>
                      <th scope="col">
                        <span className="sr-only">Correct</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.id}>
                        <th scope="row">
                          {x.nameAsPrinted}
                          {x.specimen === 'urine' ? <span className="faint"> · urine</span> : x.specimen === 'other' ? <span className="faint"> · not blood</span> : !x.markerId && <span className="faint"> · not mapped</span>}
                        </th>
                        <td>
                          {x.comparator ?? ''}
                          {x.value !== undefined ? printedNumber(x.value, decimal) : x.textValue}
                        </td>
                        <td>{x.unitAsPrinted}</td>
                        <td>{x.range?.text}</td>
                        <td className="cell-action">
                          <Link className="icon-button" to={`${base}/reports/${r.id}/results/${x.id}`} aria-label={`Correct ${x.nameAsPrinted}`} title="Correct this result">
                            <Pencil size={15} aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row report-actions">
                {r.documentId && store && <OriginalOf store={store} documentId={r.documentId} />}
                <Link className="button small" to={`${base}/reports/${r.id}/edit`}>
                  <Pencil size={14} aria-hidden /> Edit details
                </Link>
                <Link className="button small" to={`${base}/reports/${r.id}/results/new`}>
                  <Plus size={14} aria-hidden /> Add a missing result
                </Link>
                {mode === 'unlocked' && (
                  <button className="button small ghost danger" onClick={() => void remove(r.id, formatDate(r.date))}>
                    <Trash2 size={14} aria-hidden /> Delete report
                  </button>
                )}
              </div>
            </div>
          </details>
        )
      })}
    </>
  )
}

/** A report's pages as stored: one document, or every page of a group of photos. */
export function usePages(store: RecordStore | null, documentId: string | null | undefined): DocumentRecord[] {
  const [pages, setPages] = useState<DocumentRecord[]>([])
  useEffect(() => {
    if (!store || !documentId) return
    void (async () => {
      const doc = await store.get<DocumentRecord>('documents', documentId)
      setPages(doc ? (doc.group ? pagesOf(doc, await store.list<DocumentRecord>('documents')) : [doc]) : [])
    })()
  }, [store, documentId])
  return pages
}

/** The report as it was imported, for a saved report. */
export function OriginalOf({ store, documentId }: { store: RecordStore; documentId: string }) {
  const pages = usePages(store, documentId)
  return pages.length ? <Original store={store} pages={pages} /> : null
}

/** A button that shows or hides a document's pages. */
export function Original({ store, pages, label }: { store: RecordStore; pages: DocumentRecord[]; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!pages.length) return null
  const many = pages.length > 1
  return (
    <div className="original">
      <button className="button small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? (label ? 'Hide' : 'Hide the original report') : (label ?? (many ? `Show the original report (${pages.length} pages)` : 'Show the original report'))}
      </button>
      {open && <Pages store={store} pages={pages} />}
    </div>
  )
}

export function Pages({ store, pages }: { store: RecordStore; pages: DocumentRecord[] }) {
  return pages.length > 1 ? <DocumentPages store={store} pages={pages} alt="The original lab report" /> : <DocumentViewer store={store} doc={pages[0]} alt="The original lab report" />
}
