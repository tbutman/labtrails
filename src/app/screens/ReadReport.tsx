// Reading a lab report with AI (SPEC.md section 10): store the file encrypted, send it only after the
// user agrees on the send sheet, review every row next to the original page, and save only confirmed
// rows. In the demo no AI is called: a prepared answer for the fictional sample report goes through the
// same matching and review code.

import { useEffect, useState } from 'react'
import { FileUp, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Callout, FileDrop, PageHeader } from '../../core/ui/components'
import { addDocument, deleteDocument, documentBytes, DocumentError, type DocumentRecord } from '../../core'
import { AiError, askJson, imageBlock, pdfBlock, shrinkImage, type ContentBlock } from '../../core/ai/client'
import { SendSheet } from '../../core/ai/SendSheet'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import { ReviewPanel } from '../../core/review/ReviewPanel'
import type { ConfirmedRow } from '../../core/review/model'
import { EXTRACTION_SYSTEM } from '../../labs/ai/prompts'
import { extractionPrompt, recordsFromConfirmed, toProposedRows, type ConfirmedResultRow, type ProposedResultRow } from '../../labs/extraction/proposals'
import { EXTRACTION_SCHEMA, validateExtraction, type Extraction } from '../../labs/extraction/schema'
import type { Alias } from '../../labs/types'
import { DEMO_EXTRACTION } from '../demo'
import { EXTRACTION_COLUMNS } from '../extractionColumns'
import { DISCLAIMER } from '../components/Flags'
import { useBase, useProfileData } from '../profileContext'
import { useSession, useStore } from '../sessionContext'

type LabDoc = DocumentRecord<'lab-report', { lab?: string }>
type Step = 'pick' | 'ask' | 'sending' | 'review'

function validated(value: unknown): { extraction: Extraction; dropped: number } {
  const v = validateExtraction(value)
  if (!v) throw new AiError('output', "The AI's answer wasn't in the expected format. Try again, or enter the results by hand.")
  if (v.extraction.rows.length === 0) throw new AiError('output', "No results could be read from this report. If it's a photo, try a sharper one.")
  return v
}

export function ReadReport() {
  const store = useStore()
  const { core, mode, changed, saveCore } = useSession()
  const { profile } = useProfileData()
  const base = useBase()
  const navigate = useNavigate()
  const demo = mode === 'demo'
  const [step, setStep] = useState<Step>('pick')
  const [doc, setDoc] = useState<LabDoc | null>(null)
  const [proposed, setProposed] = useState<ProposedResultRow[]>([])
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [dropped, setDropped] = useState(0)
  const [aliases, setAliases] = useState<Alias[]>([])
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    void store.list<Alias>('aliases').then(setAliases)
  }, [store])

  async function keep(file: Blob, title: string) {
    setError('')
    try {
      const d = await addDocument<'lab-report', { lab?: string }>(store, file, { profileId: profile.id, date: new Date().toISOString().slice(0, 10), kind: 'lab-report', title, meta: {} })
      setDoc(d)
      setStep('ask')
    } catch (err) {
      setError(err instanceof DocumentError ? err.message : 'That file could not be added.')
    }
  }

  async function discard() {
    if (doc) await deleteDocument(store, doc)
    navigate(`${base}/reports`)
  }

  function review(ex: Extraction, droppedRows: number) {
    setExtraction(ex)
    setDropped(droppedRows)
    setProposed(toProposedRows(ex, aliases))
    setStep('review')
  }

  async function send() {
    if (!doc || !core.ai.apiKey) return
    setStep('sending')
    setError('')
    try {
      const bytes = await documentBytes(store, doc)
      let block: ContentBlock
      if (doc.mimeType === 'application/pdf') block = pdfBlock(bytes)
      else {
        const small = await shrinkImage(bytes, doc.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
        block = imageBlock(small.bytes, small.mediaType)
      }
      const { value } = await askJson(
        { apiKey: core.ai.apiKey, model: core.ai.model, system: EXTRACTION_SYSTEM, content: [block, { type: 'text', text: extractionPrompt() }], maxTokens: 8000 },
        EXTRACTION_SCHEMA,
        validated,
      )
      review(value.extraction, value.dropped)
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong. Nothing was saved.')
      setStep('ask')
    }
  }

  async function save(rows: ConfirmedRow[]) {
    if (!doc) return
    const confirmed = rows.map((r) => ({ ...r, value: String(r.value ?? '') })) as unknown as ConfirmedResultRow[]
    const lab = extraction?.lab ?? null
    const { reports, results } = recordsFromConfirmed(confirmed, { profileId: profile.id, documentId: doc.id, lab, now: new Date().toISOString(), newId: () => crypto.randomUUID() })
    for (const r of reports) await store.put('reports', r)
    for (const r of results) await store.put('results', r)
    const date = reports[0]?.date ?? doc.date
    await store.put('documents', { ...doc, date, meta: { ...(lab ? { lab } : {}) } })
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(mode === 'unlocked' && reports.length === 1 ? `${base}/summaries?report=${reports[0].id}` : base)
  }

  if (step === 'pick') {
    return (
      <>
        <PageHeader
          title="Read a lab report"
          subtitle="The AI copies out the results; you check every row before anything is saved."
          back={{ to: `${base}/reports`, label: 'Reports' }}
        />
        <div className="read-steps">
          <div className="card">
            {demo ? (
              <>
                <Callout icon={Sparkles} tone="accent">
                  In the demo, try this with a made-up sample report. No AI is called.
                </Callout>
                <button
                  className="button primary large"
                  onClick={async () => {
                    const blob = await (await fetch('/demo/sample-report.png')).blob()
                    await keep(blob, 'Sample report (fictional)')
                  }}
                >
                  Use the sample report
                </button>
              </>
            ) : (
              <FileDrop
                label="Drop a PDF or photo, or choose a file"
                hint="Stored encrypted on this device. Nothing is sent until you agree."
                accept="application/pdf,image/jpeg,image/png,image/webp"
                icon={FileUp}
                onFile={(f) => void keep(f, f.name)}
              />
            )}
            {error && (
              <p className="error form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <ol className="mini-steps">
            <li>
              <strong>Add the report.</strong> It's stored encrypted on this device.
            </li>
            <li>
              <strong>Agree to send it.</strong> You see exactly what goes to Anthropic first.
            </li>
            <li>
              <strong>Check every row</strong> next to the original page. Only ticked rows are saved.
            </li>
          </ol>
        </div>
        <p className="hint">
          Prefer not to use AI? <Link to={`${base}/reports/new`}>Enter the results by hand</Link>.
        </p>
      </>
    )
  }

  if (step === 'review' && doc) {
    return (
      <>
        <PageHeader title="Check the results" back={{ to: `${base}/reports`, label: 'Reports' }} />
        <p className="muted">
          Compare each row with the report. Tick the ones that match, fix any that don't, and remove anything wrong. Rows marked "Unsure" need a
          careful look: either the AI wasn't sure, or LabTrails matched the name using the AI's guess. Only ticked rows are saved.
        </p>
        {demo && (
          <Callout icon={Sparkles} tone="accent">
            This answer was prepared in advance from the sample report. No AI was called.
          </Callout>
        )}
        {dropped > 0 && (
          <Callout tone="warning">
            {dropped} row{dropped > 1 ? 's' : ''} in the AI's answer couldn't be read and {dropped > 1 ? 'were' : 'was'} left out. Add them yourself if they're on the report.
          </Callout>
        )}
        <ReviewPanel
          columns={EXTRACTION_COLUMNS}
          proposed={proposed}
          source={(p) => <DocumentViewer store={store} doc={doc} page={p ?? page} onPageChange={setPage} alt="The lab report" />}
          onConfirm={save}
          onCancel={() => void discard()}
          confirmLabel={(n) => `Save ${n} confirmed result${n === 1 ? '' : 's'}`}
        />
        <p className="hint disclaimer">{DISCLAIMER}</p>
      </>
    )
  }

  if (demo) {
    return (
      <>
        <PageHeader title="Read a lab report" back={{ to: `${base}/reports`, label: 'Reports' }} />
        <p className="muted">With your own Anthropic API key, LabTrails sends the report to Anthropic, which copies out the results. You check every row before anything is saved.</p>
        <div className="row">
          <button className="button primary" onClick={() => review(DEMO_EXTRACTION, 0)}>
            Show the review step
          </button>
          <button className="button" onClick={() => void discard()}>
            Cancel
          </button>
        </div>
      </>
    )
  }

  if (!core.ai.apiKey) {
    return (
      <>
        <PageHeader title="Read a lab report" back={{ to: `${base}/reports`, label: 'Reports' }} />
        <p className="muted">The report is saved. Reading it uses AI with your own Anthropic API key; add one in Settings, or enter the results by hand.</p>
        <p className="row">
          <Link to="/app/settings#ai" className="button primary">
            Go to Settings
          </Link>
          <Link to={`${base}/reports/new`} className="button">
            Enter by hand
          </Link>
        </p>
      </>
    )
  }

  const kb = doc ? Math.max(1, Math.round(doc.bytes / 1024)) : 0
  return (
    <>
      <PageHeader title="Read a lab report" back={{ to: `${base}/reports`, label: 'Reports' }} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <SendSheet
        appName="LabTrails"
        sending={[`This report: "${doc?.title}" (${doc?.mimeType === 'application/pdf' ? 'PDF' : 'photo'}, ${kb} kB)`, 'Instructions to copy the results printed in it, and the list of markers LabTrails knows']}
        notSending={['Your other results, notes and medications', "Other people's records"]}
        notes={["The report itself probably shows your name and date of birth, and sometimes a health number. LabTrails can't remove text from a PDF or photo."]}
        model={core.ai.model}
        estimate={{ inputTokens: doc?.mimeType === 'application/pdf' ? 9000 : 4000, outputTokens: 1500 }}
        busy={step === 'sending'}
        onSend={() => void send()}
        onCancel={() => void discard()}
      />
    </>
  )
}
