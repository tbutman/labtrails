// Propose → review → confirm. The AI's proposals are shown as editable rows next to the source page;
// the user accepts, edits, removes or adds rows. Only accepted rows that pass every check are handed
// to the app, through onConfirm. The app never sees anything else.

import { useMemo, useState, type ReactNode } from 'react'
import {
  blankRow,
  confirmedRows,
  detectDateOrder,
  initRows,
  needsDateOrder,
  rawDates,
  rowErrors,
  rowWarnings,
  type Column,
  type ConfirmedRow,
  type DateOrder,
  type ProposedRow,
  type ReviewRow,
} from './model'

type Props = {
  columns: Column[]
  proposed: ProposedRow[]
  // The source: usually a DocumentViewer showing one page. Receives the page to show, and a way for its
  // own previous/next buttons to change it (so "Show page" and the buttons move the same page).
  source?: (page: number | undefined, onPageChange: (page: number) => void) => ReactNode
  onConfirm: (rows: ConfirmedRow[]) => Promise<void> | void
  onCancel: () => void
  confirmLabel?: (count: number) => string
  // Other rows from the same document that aren't being reviewed (already saved, say). Only used to
  // tell whether its dates are day first or month first.
  context?: ProposedRow[]
}

const CONFIDENCE_LABEL = { high: 'Clear in the document', medium: 'Check this', low: 'Unsure: check carefully' }
// Told apart by words and outline, not color.
const CHIP_TONE = { high: '', medium: ' outline', low: ' strong' }

export function ReviewPanel({ columns, proposed, source, onConfirm, onCancel, confirmLabel, context = [] }: Props) {
  const [rows, setRows] = useState<ReviewRow[]>(() => initRows(proposed, columns))
  const [order, setOrder] = useState<DateOrder | undefined>(() => detectDateOrder(rawDates(initRows([...proposed, ...context], columns), columns)))
  const [page, setPage] = useState<number | undefined>(proposed.find((p) => p.page)?.page)
  const [saving, setSaving] = useState(false)
  const askOrder = useMemo(() => !order && needsDateOrder(rawDates(rows, columns)), [order, rows, columns])
  const confirmed = confirmedRows(rows, columns, order)
  const pending = rows.filter((r) => r.status === 'pending').length

  const update = (id: string, change: Partial<ReviewRow>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...change } : r)))
  const setValue = (row: ReviewRow, key: string, value: string) => update(row.id, { values: { ...row.values, [key]: value } })

  async function save() {
    setSaving(true)
    try {
      await onConfirm(confirmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="review">
      {source && <div className="review-source">{source(page, setPage)}</div>}
      <div className="review-rows stack">
        {askOrder && (
          <div className="callout" role="group" aria-label="Date order">
            <p>
              <strong>How are dates written in this document?</strong> Some could be read either way.
            </p>
            <div className="row">
              <button type="button" className="button small" onClick={() => setOrder('dmy')}>
                Day first (31/12/2026)
              </button>
              <button type="button" className="button small" onClick={() => setOrder('mdy')}>
                Month first (12/31/2026)
              </button>
            </div>
          </div>
        )}
        {rows.length === 0 && <p className="muted">Nothing was found. You can add values yourself.</p>}
        {rows.map((row, i) => {
          const errors = rowErrors(row, columns, order)
          const warnings = rowWarnings(row, columns, order)
          return (
            <fieldset key={row.id} className={`review-row card status-${row.status} confidence-${row.confidence}`}>
              <legend className="legend">
                {row.added ? 'Added by you' : `Found ${i + 1}`}
                {!row.added && <span className={`chip${CHIP_TONE[row.confidence]}`}>{CONFIDENCE_LABEL[row.confidence]}</span>}
              </legend>
              {row.sourceText && (
                <p className="hint">
                  In the document{row.page ? ` (page ${row.page}` : ''}
                  {row.page ? ')' : ''}: “{row.sourceText}”
                  {row.page && source && (
                    <>
                      {' '}
                      <button type="button" className="link-button" onClick={() => setPage(row.page)}>
                        Show page
                      </button>
                    </>
                  )}
                </p>
              )}
              <div className="review-fields">
                {columns.map((c) => {
                  const id = `${row.id}-${c.key}`
                  return (
                    <div key={c.key} className={`field${errors[c.key] ? ' has-error' : ''}`}>
                      <label htmlFor={id}>
                        {c.label}
                        {c.unit ? ` (${c.unit})` : ''}
                      </label>
                      {c.type === 'choice' ? (
                        <select id={id} value={row.values[c.key] ?? ''} disabled={row.status === 'rejected'} onChange={(e) => setValue(row, c.key, e.target.value)}>
                          <option value="">—</option>
                          {c.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          inputMode={c.type === 'number' ? 'decimal' : undefined}
                          value={row.values[c.key] ?? ''}
                          disabled={row.status === 'rejected'}
                          onChange={(e) => setValue(row, c.key, e.target.value)}
                        />
                      )}
                      {errors[c.key] && row.status !== 'rejected' && <p className="error">{errors[c.key]}</p>}
                      {!errors[c.key] && warnings[c.key] && row.status !== 'rejected' && <p className="field-warning">{warnings[c.key]}</p>}
                    </div>
                  )
                })}
              </div>
              <div className="row">
                {row.status === 'rejected' ? (
                  <button type="button" className="button small" onClick={() => update(row.id, { status: 'pending' })}>
                    Undo remove
                  </button>
                ) : (
                  <>
                    <label className="checkbox accept">
                      <input
                        type="checkbox"
                        checked={row.status === 'accepted'}
                        onChange={(e) => update(row.id, { status: e.target.checked ? 'accepted' : 'pending' })}
                      />
                      <span>This matches the document</span>
                    </label>
                    <button type="button" className="button small ghost" onClick={() => update(row.id, { status: 'rejected' })}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            </fieldset>
          )
        })}
        <button type="button" className="button" onClick={() => setRows((all) => [...all, blankRow(columns)])}>
          Add a row
        </button>
        <p className="hint" role="status">
          {confirmed.length} confirmed{pending ? `, ${pending} not confirmed yet (they won't be saved)` : ''}.
        </p>
        <div className="row">
          <button type="button" className="button primary" onClick={() => void save()} disabled={saving || confirmed.length === 0}>
            {confirmLabel ? confirmLabel(confirmed.length) : `Save ${confirmed.length} confirmed`}
          </button>
          <button type="button" className="button ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
