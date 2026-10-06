import { FilePlus2, FileSearch, ScanText, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { DocumentRecord, RecordStore } from '../../core'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import type { Result } from '../../labs/types'
import { Chip, EmptyState, PageHeader } from '../../trails-ui/components'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, plural } from '../format'

const RECENTLY: Record<string, string> = { illness: 'Recent illness', 'hard-exercise': 'Recent hard exercise', alcohol: 'Recent alcohol', 'poor-sleep': 'Poor sleep' }
const FASTING: Record<string, string> = { yes: 'Fasting', no: 'Not fasting', unknown: 'Fasting not known' }

export function Reports() {
  const { reports, results } = useProfileData()
  const { mode, store, changed, core, saveCore } = useSession()
  const base = useBase()
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date))

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
        <ScanText size={16} aria-hidden /> Read a report
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
      {sorted.length === 0 && (
        <EmptyState icon={FileSearch} title="No reports yet">
          Read a lab report with AI, or enter the results by hand.
        </EmptyState>
      )}
      {sorted.map((r) => {
        const rows = results.filter((x) => x.reportId === r.id)
        return (
          <details key={r.id} className="disclosure">
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
                          {x.value ?? x.textValue}
                        </td>
                        <td>{x.unitAsPrinted}</td>
                        <td>{x.range?.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row report-actions">
                {r.documentId && store && <Original store={store} documentId={r.documentId} />}
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

function Original({ store, documentId }: { store: RecordStore; documentId: string }) {
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
