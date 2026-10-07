// The shared import flow: add files (several at once, or zips) → see the queue, with duplicates set
// aside → agree once to send the batch → files are stored, then read one after another → check each
// one in turn → a summary. Apps plug in through an ImportAdapter.
//
// Nothing is sent before the user agrees; nothing is saved before they've checked it; and files are
// stored before reading, so anything not read yet stays listed in the app ("Not read yet").

import { ArrowDown, ArrowUp, CircleAlert, Copy, Files, FileText, FileUp, Image, Loader2, RotateCcw, Trash2, Ungroup, X } from 'lucide-react'
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { RecordStore } from '../store/types'
import { PHOTO_NOTE } from '../ai/client'
import { SendSheet } from '../ai/SendSheet'
import { formatDate } from '../format'
import { addDocument, documentBytes } from '../documents/documents'
import { DocumentPages } from '../documents/DocumentPages'
import { DocumentViewer } from '../documents/DocumentViewer'
import { ReviewPanel } from '../review/ReviewPanel'
import type { ConfirmedRow, ProposedRow } from '../review/model'
import { Callout, Chip } from '../ui/components'
import type { CheckResult, DocumentKindOption, ImportAdapter, ReadResult } from './adapter'
import { storedFingerprints, type ImportMeta, type StoredDoc } from './duplicates'
import { intake, type Skipped } from './intake'
import './import.css'
import { canBePage, counts, queueReducer, unitBytes, unitName, unitPages, unitsFromDocuments, unitsFromFiles, unitType, type Unit } from './queue'

type Proposal<M> = ReadResult<M>
type Checked = CheckResult & { fresh: ProposedRow[] }
type Phase = 'queue' | 'consent' | 'working'

const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
// Today where the user is, as YYYY-MM-DD (not UTC, which can be a day off).
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sameRow = (a: ProposedRow, b: ProposedRow) => JSON.stringify(a.values) === JSON.stringify(b.values) && a.page === b.page

export function ImportWizard<M>({
  adapter,
  store,
  profileId,
  model,
  initialDocuments = [],
  demo = false,
  onFinish,
  header,
}: {
  adapter: ImportAdapter<M>
  store: RecordStore
  profileId: string
  model: string
  initialDocuments?: StoredDoc[]
  demo?: boolean
  onFinish: () => void
  header: (title: string) => ReactNode
}) {
  const [units, dispatch] = useReducer(queueReducer<Proposal<M>>, initialDocuments, (docs) => unitsFromDocuments<Proposal<M>>(docs))
  const [skipped, setSkipped] = useState<Skipped[]>([])
  const [phase, setPhase] = useState<Phase>('queue')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [metaEdits, setMetaEdits] = useState<Record<string, M>>({})
  const [checks, setChecks] = useState<Record<string, Checked>>({})
  const running = useRef(false)

  const c = counts(units)
  const toRead = units.filter((u) => u.status === 'ready' && !u.storeOnly)
  const toStore = units.filter((u) => u.status === 'ready' && u.storeOnly)
  const reviewing = units.find((u) => u.status === 'review')
  const finished = phase === 'working' && c.ready === 0 && c.reading === 0 && c.review === 0

  async function addFiles(list: File[]) {
    if (list.length === 0) return
    setBusy(true)
    setError('')
    try {
      const { files, skipped: s } = await intake(list)
      const stored = await storedFingerprints(store)
      // Files already queued in this session count as "earlier in this batch" too.
      const queued = units.filter((u) => u.file).map((u) => u.file!)
      const fresh = unitsFromFiles<Proposal<M>>([...queued, ...files], stored, adapter.storeOnlyByDefault, adapter.kindFor).slice(queued.length)
      dispatch({ type: 'add', units: fresh })
      setSkipped((prev) => [...prev, ...s])
    } catch {
      setError("Those files couldn't be read.")
    } finally {
      setBusy(false)
    }
  }

  async function addSample() {
    if (!adapter.sample) return
    const blob = await (await fetch(adapter.sample.url)).blob()
    await addFiles([new File([blob], adapter.sample.title, { type: blob.type })])
  }

  // A new unit's file (or, for pages of one document, each page) stored as a document.
  async function storeUnit(u: Unit<Proposal<M>>, importStatus: ImportMeta['importStatus']) {
    const files = u.pages ?? (u.file ? [u.file] : [])
    const group = u.pages ? crypto.randomUUID() : undefined
    const docs: StoredDoc[] = []
    for (const [i, f] of files.entries()) {
      docs.push(
        (await addDocument(store, new Blob([f.bytes], { type: f.mimeType }), {
          profileId,
          date: today(),
          kind: u.kind ?? adapter.documentKind,
          title: f.name.split('/').pop() ?? f.name,
          meta: { sha256: f.sha256, importStatus } satisfies ImportMeta,
          ...(group ? { group: { id: group, page: i + 1 } } : {}),
        })) as StoredDoc,
      )
    }
    if (u.pages) dispatch({ type: 'stored-pages', id: u.id, documents: docs })
    else if (docs[0]) dispatch({ type: 'stored-document', id: u.id, document: docs[0] })
  }

  const docsOf = (u: Unit<Proposal<M>>) => u.pageDocuments ?? (u.document ? [u.document] : [])

  // Store every waiting file as a document first, so nothing is lost if the user leaves mid-way.
  async function begin() {
    setBusy(true)
    for (const u of units.filter((x) => x.status === 'ready')) {
      if (!u.document && u.file) await storeUnit(u, u.storeOnly ? 'stored' : 'unread')
      else if (u.document && u.storeOnly) {
        for (const d of docsOf(u)) await store.put('documents', { ...d, meta: { ...d.meta, importStatus: 'stored' } })
      }
      if (u.storeOnly) dispatch({ type: 'stored', id: u.id })
    }
    setBusy(false)
    setPhase('working')
  }

  // Read the waiting documents one after another. One failure doesn't stop the rest.
  useEffect(() => {
    if (phase !== 'working' || running.current) return
    const next = units.find((u) => u.status === 'ready' && !u.storeOnly && u.document)
    if (!next) return
    running.current = true
    dispatch({ type: 'reading', id: next.id })
    void (async () => {
      try {
        const pages = docsOf(next)
        // Pages of one document are read together, when the app can (request 17).
        const result =
          pages.length > 1 && adapter.readPages
            ? await adapter.readPages(await Promise.all(pages.map(async (doc) => ({ doc, bytes: await documentBytes(store, doc) }))))
            : await adapter.read(next.document!, await documentBytes(store, next.document!))
        dispatch({ type: 'read', id: next.id, proposal: result })
      } catch (err) {
        dispatch({ type: 'failed', id: next.id, error: err instanceof Error ? err.message : 'Something went wrong.' })
      } finally {
        running.current = false
      }
    })()
  }, [phase, units, adapter, store])

  // Compare with what's saved only when a document comes up for review, after the ones before it were
  // saved, so a second copy of a report in the same batch is caught too.
  useEffect(() => {
    if (!reviewing || checks[reviewing.id]) return
    const result = reviewing.proposal!
    let live = true
    void (async () => {
      const check: CheckResult = adapter.check ? await adapter.check(result).catch(() => ({ alreadySaved: [] })) : { alreadySaved: [] }
      const fresh = result.rows.filter((r) => !check.alreadySaved.some((s) => sameRow(s, r)))
      if (live) setChecks((c) => ({ ...c, [reviewing.id]: { ...check, fresh } }))
    })()
    return () => {
      live = false
    }
  }, [reviewing, checks, adapter])

  async function markDoc(doc: StoredDoc | undefined, importStatus: ImportMeta['importStatus']) {
    if (doc) await store.put('documents', { ...doc, meta: { ...doc.meta, importStatus } })
  }
  // Every page of a unit, from the store (the adapter may have updated the first one while saving).
  async function markUnit(unit: Unit<Proposal<M>>, importStatus: ImportMeta['importStatus']) {
    for (const d of docsOf(unit)) await markDoc((await store.get<StoredDoc>('documents', d.id)) ?? d, importStatus)
  }

  async function save(unit: Unit<Proposal<M>>, rows: ConfirmedRow[]) {
    const meta = metaEdits[unit.id] ?? unit.proposal!.meta
    const outcome = await adapter.save(unit.document!, rows, meta)
    await markUnit(unit, 'read')
    dispatch({ type: 'saved', id: unit.id, outcome })
  }

  // ---------- Screens ----------

  if (phase === 'consent') {
    const pdfs = toRead.filter((u) => unitType(u) === 'application/pdf').length
    const images = toRead.filter((u) => unitType(u) !== 'application/pdf').reduce((n, u) => n + unitPages(u), 0)
    const size = toRead.reduce((n, u) => n + unitBytes(u), 0)
    const per = adapter.estimate({ pdfs: 1, images: 0 })
    const perImage = adapter.estimate({ pdfs: 0, images: 1 })
    const parts = [pdfs && `${pdfs} PDF${pdfs > 1 ? 's' : ''}`, images && `${images} photo${images > 1 ? 's' : ''}`].filter(Boolean).join(' and ')
    return (
      <>
        {header(`Read ${toRead.length} ${toRead.length === 1 ? adapter.noun.one : adapter.noun.many}`)}
        <SendSheet
          appName={adapter.appName}
          sending={[`${parts} (${mb(size)} in total), one request per ${adapter.noun.one}`, `Instructions to copy what's printed in them`]}
          notSending={adapter.sendSheet.notSending}
          notes={[
            ...adapter.sendSheet.notes,
            ...(images ? [PHOTO_NOTE] : []),
            ...(toStore.length ? [`${toStore.length} file${toStore.length > 1 ? 's' : ''} marked "keep without reading" won't be sent.`] : []),
          ]}
          model={model}
          estimate={{ inputTokens: per.inputTokens * pdfs + perImage.inputTokens * images, outputTokens: per.outputTokens * pdfs + perImage.outputTokens * images }}
          busy={busy}
          onSend={() => void begin()}
          onCancel={() => setPhase('queue')}
        />
      </>
    )
  }

  if (phase === 'working' && reviewing && !checks[reviewing.id]) {
    return (
      <>
        {header("Checking against what's already saved…")}
        <div className="skeleton loading-card" />
      </>
    )
  }

  if (phase === 'working' && reviewing) {
    const p = { ...reviewing.proposal!, ...checks[reviewing.id] }
    const doc = reviewing.document!
    const position = units.filter((u) => ['review', 'saved', 'skipped'].includes(u.status) || (u.status === 'failed' && !u.storeOnly)).indexOf(reviewing) + 1
    const total = units.filter((u) => !u.storeOnly && u.status !== 'duplicate').length
    const meta = metaEdits[reviewing.id] ?? p.meta
    const Editor = adapter.MetaEditor
    return (
      <>
        {header(`Check ${adapter.noun.one} ${position} of ${total}`)}
        <p className="muted import-file">
          <FileText size={15} aria-hidden /> {doc.title}
          {unitPages(reviewing) > 1 && ` and ${unitPages(reviewing) - 1} more page${unitPages(reviewing) > 2 ? 's' : ''}`}
          {c.reading > 0 && (
            <span className="faint">
              {' '}
              · reading the next one…
            </span>
          )}
        </p>
        {p.similar && (
          <Callout icon={Copy}>
            <strong>This looks like {p.similar.label}.</strong> {p.similar.detail}{' '}
            <button className="link-button" onClick={() => void markUnit(reviewing, 'read').then(() => dispatch({ type: 'skipped', id: reviewing.id }))}>
              Skip this one
            </button>
          </Callout>
        )}
        {p.alreadySaved.length > 0 && (
          <details className="disclosure already-saved">
            <summary>
              {p.alreadySaved.length} row{p.alreadySaved.length > 1 ? 's' : ''} already saved, left out
            </summary>
            <div className="disclosure-body">
              <ul className="plain-list small muted">
                {p.alreadySaved.map((r, i) => (
                  <li key={i}>{r.sourceText ?? Object.values(r.values).filter(Boolean).join(' ')}</li>
                ))}
              </ul>
            </div>
          </details>
        )}
        {p.dropped > 0 && (
          <Callout icon={CircleAlert} tone="warning">
            {p.dropped} row{p.dropped > 1 ? 's' : ''} in the AI's answer couldn't be read and {p.dropped > 1 ? 'were' : 'was'} left out. Add them yourself if they're on the{' '}
            {adapter.noun.one}.
          </Callout>
        )}
        {Editor && p.fresh.length > 0 && (
          <div className="card import-meta">
            <Editor meta={meta} onChange={(m) => setMetaEdits((e) => ({ ...e, [reviewing.id]: m }))} />
          </div>
        )}
        {p.fresh.length === 0 ? (
          <div className="card">
            <p>Everything in this {adapter.noun.one} is already saved.</p>
            <button className="button primary" onClick={() => void markUnit(reviewing, 'read').then(() => dispatch({ type: 'skipped', id: reviewing.id }))}>
              Mark as read and continue
            </button>
          </div>
        ) : (
          <ReviewPanel
            key={reviewing.id}
            columns={adapter.columns}
            proposed={p.fresh}
            context={p.alreadySaved}
            source={(pg, onPage) =>
              reviewing.pageDocuments && reviewing.pageDocuments.length > 1 ? (
                <DocumentPages store={store} pages={reviewing.pageDocuments} page={pg ?? 1} onPageChange={onPage} alt={`The ${adapter.noun.one}`} />
              ) : (
                <DocumentViewer store={store} doc={doc} page={pg ?? 1} onPageChange={onPage} alt={`The ${adapter.noun.one}`} />
              )
            }
            onConfirm={(rows) => save(reviewing, rows)}
            onCancel={() => dispatch({ type: 'skipped', id: reviewing.id })}
            confirmLabel={(n) => `Save ${n} row${n === 1 ? '' : 's'}${units.some((u) => u.id !== reviewing.id && ['ready', 'reading', 'review'].includes(u.status) && !u.storeOnly) ? ' and continue' : ''}`}
          />
        )}
      </>
    )
  }

  if (phase === 'working') {
    return (
      <>
        {header(finished ? 'Import finished' : `Reading ${c.reading + c.ready} of ${toRead.length + c.reading + c.saved + c.failed + c.skipped}…`)}
        {finished && (
          <Callout tone="accent">
            {[c.saved && `${c.saved} saved`, c.stored && `${c.stored} kept without reading`, c.skipped && `${c.skipped} skipped`, c.failed && `${c.failed} couldn't be read`, c.duplicate && `${c.duplicate} duplicate${c.duplicate > 1 ? 's' : ''} left out`]
              .filter(Boolean)
              .join(' · ')}
            .{(c.skipped > 0 || c.failed > 0) && ' Skipped and failed files stay listed as "Not read yet".'}
          </Callout>
        )}
        <QueueList units={units} dispatch={dispatch} kinds={adapter.kinds} working />
        {finished && (
          <div className="row import-actions">
            <button className="button primary" onClick={onFinish}>
              Done
            </button>
          </div>
        )}
      </>
    )
  }

  // The queue
  const ready = c.ready
  return (
    <>
      {header(`Import ${adapter.noun.many}`)}
      <MultiFileDrop busy={busy} onFiles={(f) => void addFiles(f)} />
      {demo && adapter.sample && (
        <Callout tone="accent">
          In the demo, try it with a made-up sample {adapter.noun.one}; add it twice to see duplicates caught. Nothing is sent anywhere.{' '}
          <button className="button small" onClick={() => void addSample()}>
            Add the sample {adapter.noun.one}
          </button>
        </Callout>
      )}
      {error && (
        <p className="error form-error" role="alert">
          {error}
        </p>
      )}
      {units.length > 0 && <QueueList units={units} dispatch={dispatch} kinds={adapter.kinds} pages={adapter.readPages ? adapter.noun.one : undefined} />}
      {skipped.length > 0 && (
        <details className="disclosure import-skipped">
          <summary>
            {skipped.length} file{skipped.length > 1 ? 's' : ''} couldn't be added
          </summary>
          <div className="disclosure-body">
            <ul className="plain-list small muted">
              {skipped.map((s, i) => (
                <li key={i}>
                  <strong>{s.name}</strong>: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {units.length > 0 && (
        <div className="import-actions">
          {!adapter.canRead && toRead.length > 0 && (
            <p className="hint">
              Reading uses AI with your own API key; {adapter.settingsPath ? <Link to={adapter.settingsPath}>add one in Settings</Link> : 'add one in Settings'}. You
              can keep the files now and read them later.
            </p>
          )}
          <div className="row">
            {toRead.length > 0 && adapter.canRead && (
              <button className="button primary large" onClick={() => (demo ? void begin() : setPhase('consent'))} disabled={busy}>
                Read {toRead.length} {toRead.length === 1 ? adapter.noun.one : adapter.noun.many}
              </button>
            )}
            {ready > 0 && (
              <button
                className="button large"
                disabled={busy}
                onClick={() => {
                  for (const u of toRead) dispatch({ type: 'store-only', id: u.id, value: true })
                  setPhase('working')
                  void (async () => {
                    // Store everything without reading; it stays listed as "Not read yet".
                    for (const u of units.filter((x) => x.status === 'ready')) {
                      if (u.file && !u.document) await storeUnit(u, u.storeOnly ? 'stored' : 'unread')
                      dispatch({ type: 'stored', id: u.id })
                    }
                  })()
                }}
              >
                {toRead.length > 0 ? 'Keep without reading for now' : `Keep ${ready} file${ready > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MultiFileDrop({ busy, onFiles }: { busy: boolean; onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onFiles([...e.dataTransfer.files])
      }}
    >
      <input
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.zip,application/zip"
        aria-label="Add PDFs, photos or zip files"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <span className="drop-zone-icon">{busy ? <Loader2 size={22} className="spin" aria-hidden /> : <FileUp size={22} aria-hidden />}</span>
      <span className="drop-zone-title">{busy ? 'Checking files…' : 'Drop PDFs, photos or zip files, or choose files'}</span>
      <span className="hint">Several at once is fine. Zips are opened on this device; nothing is sent until you agree.</span>
    </div>
  )
}

const STATUS: Record<Unit<unknown>['status'], { label: string; tone?: 'flag' | 'accent' | 'outline' }> = {
  ready: { label: 'Ready', tone: 'outline' },
  duplicate: { label: 'Already imported', tone: 'outline' },
  reading: { label: 'Reading…', tone: 'accent' },
  review: { label: 'Ready to check', tone: 'accent' },
  saved: { label: 'Saved', tone: 'accent' },
  stored: { label: 'Kept, not read', tone: 'outline' },
  skipped: { label: 'Skipped', tone: 'outline' },
  failed: { label: "Couldn't read", tone: 'outline' },
}

function QueueList<M>({
  units,
  dispatch,
  kinds,
  working = false,
  pages,
}: {
  units: Unit<M>[]
  dispatch: (a: Parameters<typeof queueReducer<M>>[1]) => void
  kinds?: DocumentKindOption[]
  working?: boolean
  /** The adapter's noun when it can read pages of one document together; grouping is offered then. */
  pages?: string
}) {
  // Picking photos to group, in the order they're ticked.
  const [picking, setPicking] = useState<string[] | null>(null)
  const groupable = units.filter(canBePage)
  const offerGroup = !!pages && !working && groupable.length >= 2
  return (
    <>
      <div className="card padless import-queue">
        <ul className="list">
          {units.map((u) => {
            const s = u.status === 'ready' && u.storeOnly ? { label: 'Keep without reading', tone: 'outline' as const } : STATUS[u.status]
            const n = unitPages(u)
            const picked = picking?.indexOf(u.id) ?? -1
            return (
              <li key={u.id} className="list-row">
                <span className="import-icon" aria-hidden="true">
                  {n > 1 ? <Files size={18} /> : unitType(u) === 'application/pdf' ? <FileText size={18} /> : <Image size={18} />}
                </span>
                <span className="list-row-main">
                  <span className="list-row-title import-name">
                    {unitName(u)}
                    {n > 1 && ` and ${n - 1} more page${n > 2 ? 's' : ''}`}
                  </span>
                  <span className="list-row-sub">
                    {n > 1 && `${n} pages of one ${pages ?? 'document'} · `}
                    {mb(unitBytes(u))}
                    {u.duplicateOf && ` · same file as ${u.duplicateOf.inBatch ? `${u.duplicateOf.title}, above` : `"${u.duplicateOf.title}"${u.duplicateOf.date ? `, added ${formatDate(u.duplicateOf.date)}` : ''}`}`}
                    {u.error && ` · ${u.error}`}
                    {u.outcome && ` · ${u.outcome}`}
                  </span>
                  {u.pages && !working && u.status === 'ready' && (
                    <ol className="import-pages" aria-label={`Pages of ${unitName(u)}`}>
                      {u.pages.map((f, i) => (
                        <li key={f.id}>
                          <span className="page-number">Page {i + 1}</span>
                          <span className="import-name">{f.name}</span>
                          <button type="button" className="icon-button" disabled={i === 0} onClick={() => dispatch({ type: 'move-page', id: u.id, from: i, to: i - 1 })} aria-label={`Move ${f.name} up`}>
                            <ArrowUp size={14} aria-hidden />
                          </button>
                          <button type="button" className="icon-button" disabled={i === u.pages!.length - 1} onClick={() => dispatch({ type: 'move-page', id: u.id, from: i, to: i + 1 })} aria-label={`Move ${f.name} down`}>
                            <ArrowDown size={14} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </span>
                {picking && canBePage(u) ? (
                  <label className="import-pick">
                    <input
                      type="checkbox"
                      checked={picked >= 0}
                      onChange={(e) => setPicking((p) => (e.target.checked ? [...(p ?? []), u.id] : (p ?? []).filter((id) => id !== u.id)))}
                    />
                    {picked >= 0 ? `Page ${picked + 1}` : 'Add as a page'}
                  </label>
                ) : (
                  <Chip tone={s.tone}>{s.label}</Chip>
                )}
                {!working && kinds && ['ready', 'duplicate'].includes(u.status) && (
                  <select
                    className="import-kind"
                    aria-label={`What is ${unitName(u)}?`}
                    value={u.kind}
                    onChange={(e) => {
                      const kind = kinds.find((k) => k.value === e.target.value)!
                      dispatch({ type: 'kind', id: u.id, kind: kind.value, storeOnly: !kind.read })
                    }}
                  >
                    {kinds.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                )}
                {!working && u.status === 'ready' && !u.pages && (!kinds || kinds.find((k) => k.value === u.kind)?.read !== false) && (
                  <label className="import-toggle small">
                    <input type="checkbox" checked={u.storeOnly} onChange={(e) => dispatch({ type: 'store-only', id: u.id, value: e.target.checked })} /> Keep without reading
                  </label>
                )}
                {!working && u.pages && u.status === 'ready' && (
                  <button className="button small ghost" onClick={() => dispatch({ type: 'ungroup', id: u.id })}>
                    <Ungroup size={14} aria-hidden /> Separate pages
                  </button>
                )}
                {!working && u.status === 'duplicate' && (
                  <button className="button small ghost" onClick={() => dispatch({ type: 'import-anyway', id: u.id })}>
                    Import anyway
                  </button>
                )}
                {u.status === 'failed' && (
                  <button className="button small ghost" onClick={() => dispatch({ type: 'retry', id: u.id })} aria-label={`Try ${unitName(u)} again`}>
                    <RotateCcw size={14} aria-hidden /> Retry
                  </button>
                )}
                {!working && ['ready', 'duplicate', 'failed'].includes(u.status) && (
                  <button className="icon-button" onClick={() => dispatch({ type: 'remove', id: u.id })} aria-label={`Remove ${unitName(u)}`}>
                    {u.status === 'failed' ? <Trash2 size={16} aria-hidden /> : <X size={16} aria-hidden />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {offerGroup && (
        <div className="row import-group-bar">
          {picking ? (
            <>
              <button
                type="button"
                className="button primary small"
                disabled={picking.length < 2}
                onClick={() => {
                  dispatch({ type: 'group', ids: picking })
                  setPicking(null)
                }}
              >
                <Files size={14} aria-hidden /> Make {picking.length >= 2 ? `these ${picking.length} photos` : 'them'} one {pages}
              </button>
              <button type="button" className="button ghost small" onClick={() => setPicking(null)}>
                Cancel
              </button>
              <span className="hint">Tick the photos in page order.</span>
            </>
          ) : (
            <>
              <button type="button" className="button small" onClick={() => setPicking([])}>
                <Files size={14} aria-hidden /> Pages of one {pages}?
              </button>
              <span className="hint">If several photos show the pages of one {pages}, group them so they're read and checked together.</span>
            </>
          )}
        </div>
      )}
    </>
  )
}
