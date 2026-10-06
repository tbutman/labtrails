import { FileClock, FilePlus2, FileSearch, Pencil, Plus, ScanText, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import type { DocumentRecord, RecordStore } from '../../core'
import { deleteDocument } from '../../core/documents/documents'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import type { StoredDoc } from '../../core/import/duplicates'
import { printedNumber, reportDecimal } from '../../labs/edit'
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
  const unread = docs.filter((d) => d.meta?.importStatus === 'unread' || (!d.meta?.importStatus && !linked.has(d.id)))
  const kept = docs.filter((d) => d.meta?.importStatus === 'stored')

  async function removeDoc(doc: StoredDoc) {
    if (!store || !window.confirm(`Delete "${doc.title}"? This can't be undone, except from a backup.`)) return
    await deleteDocument(store, doc)
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
                <li key={d.id} className="list-row">
                  <span className="list-row-main">
                    <span className="list-row-title">{d.title}</span>
                    <span className="list-row-sub">Added {formatDate(d.createdAt.slice(0, 10))}</span>
                  </span>
                  <Link className="button small" to={`${base}/reports/read?documents=${d.id}`}>
                    Read
                  </Link>
                  <button className="icon-button" onClick={() => void removeDoc(d)} aria-label={`Delete ${d.title}`}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {unread.length > 1 && (
            <p className="row unread-all">
              <Link className="button small primary" to={`${base}/reports/read?documents=${unread.map((d) => d.id).join(',')}`}>
                Read all {unread.length}
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
                <li key={d.id} className="list-row">
                  <span className="list-row-main">
                    <span className="list-row-title">{d.title}</span>
                  </span>
                  <Link className="button small" to={`${base}/reports/read?documents=${d.id}`}>
                    Read now
                  </Link>
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
                          {!x.markerId && <span className="faint"> · not mapped</span>}
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
                {r.documentId && store && <Original store={store} documentId={r.documentId} />}
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

export function Original({ store, documentId }: { store: RecordStore; documentId: string }) {
  const [doc, setDoc] = useState<DocumentRecord | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void store.get<DocumentRecord>('documents', documentId).then((d) => setDoc(d ?? null))
  }, [store, documentId])
  if (!doc) return null
  return (
    <div className="original">
      <button className="button small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide the original report' : 'Show the original report'}
      </button>
      {open && <DocumentViewer store={store} doc={doc} alt="The original lab report" />}
    </div>
  )
}
