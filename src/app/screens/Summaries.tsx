// AI summaries (SPEC.md section 11): grounded in facts the code computes, sent only after the user
// agrees on the send sheet, saved encrypted, and marked out of date when the results change.

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AiError, askText } from '../../core/ai/client'
import { Markdown } from '../../core/ai/Markdown'
import { AiOutput, SendSheet } from '../../core/ai/SendSheet'
import { afterReportFacts, overallFacts, type SummaryFacts } from '../../labs/ai/facts'
import { AFTER_REPORT_SYSTEM, OVERALL_SYSTEM, summaryMessage } from '../../labs/ai/prompts'
import { digest } from '../../labs/ai/digest'
import type { Summary } from '../../labs/types'
import { DISCLAIMER } from '../components/Flags'
import { useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate } from '../format'

type Request = { kind: Summary['kind']; reportId?: string; facts: SummaryFacts }

export function Summaries() {
  const { profile, reports, results, summaries } = useProfileData()
  const { mode, store, core, app, changed } = useSession()
  const [params] = useSearchParams()
  const [request, setRequest] = useState<Request | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted.find((r) => r.id === params.get('report')) ?? sorted[0]
  const factsFor = (kind: Summary['kind'], reportId?: string) =>
    kind === 'after-report' && reportId ? afterReportFacts(profile, reports, results, reportId, app.preferredUnit) : overallFacts(profile, reports, results, app.preferredUnit)
  const current = (s: Summary) => digest(summaryMessage(factsFor(s.kind, s.reportId))) === s.inputsDigest
  const ordered = [...summaries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const canAsk = mode === 'unlocked' && !!core.ai.apiKey && reports.length > 0

  async function send() {
    if (!request || !store || !core.ai.apiKey) return
    setBusy(true)
    setError('')
    try {
      const message = summaryMessage(request.facts)
      const { text } = await askText({
        apiKey: core.ai.apiKey,
        model: core.ai.model,
        system: request.kind === 'after-report' ? AFTER_REPORT_SYSTEM : OVERALL_SYSTEM,
        content: [{ type: 'text', text: message }],
        maxTokens: 1500,
      })
      const summary: Summary = {
        id: crypto.randomUUID(),
        profileId: profile.id,
        kind: request.kind,
        ...(request.reportId ? { reportId: request.reportId } : {}),
        model: core.ai.model,
        createdAt: new Date().toISOString(),
        text,
        inputsDigest: digest(message),
      }
      await store.put('summaries', summary)
      setRequest(null)
      changed()
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong. Nothing was saved.')
    } finally {
      setBusy(false)
    }
  }

  if (request) {
    const n = request.facts.markers.length
    const context = request.facts.report?.context
    return (
      <>
        <h1>{request.kind === 'after-report' ? 'Summarise this report' : 'Overall summary'}</h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <SendSheet
          appName="LabTrails"
          sending={[
            `${n} marker${n === 1 ? '' : 's'}: values, units, each lab's range and the flags LabTrails computed`,
            ...(request.facts.person.ageYears !== undefined || request.facts.person.sex ? ['Age in years and sex, if set (some ranges depend on them)'] : []),
            ...(context ? [`The test's context${context.medications ? ', including medications and supplements' : ''}${context.notes ? ' and your notes' : ''}`] : []),
          ]}
          notSending={['Your name (replaced with "the person") and date of birth', 'Uploaded reports', "Other people's records"]}
          model={core.ai.model}
          estimate={{ inputTokens: 1200 + n * 120, outputTokens: request.kind === 'overall' ? 700 : 400 }}
          busy={busy}
          onSend={() => void send()}
          onCancel={() => setRequest(null)}
        />
      </>
    )
  }

  return (
    <>
      <h1>Summaries</h1>
      <p className="muted">
        With your own API key, LabTrails can ask an AI to explain what changed. It only explains what the code flagged; it doesn't add flags,
        diagnose or suggest treatment.{mode === 'demo' && ' In the demo these are pre-written examples.'}
      </p>
      {canAsk && latest && (
        <p className="row">
          <button className="button primary" onClick={() => setRequest({ kind: 'after-report', reportId: latest.id, facts: factsFor('after-report', latest.id) })}>
            Summarise the {formatDate(latest.date)} report
          </button>
          <button className="button" onClick={() => setRequest({ kind: 'overall', facts: factsFor('overall') })}>
            Write an overall summary
          </button>
        </p>
      )}
      {mode === 'unlocked' && !core.ai.apiKey && (
        <p className="callout">
          Summaries use AI with your own Anthropic API key. <Link to="/settings">Add one in Settings</Link>.
        </p>
      )}
      {ordered.length === 0 && <p className="muted">No summaries yet.</p>}
      {ordered.map((s) => {
        const report = s.reportId ? reports.find((r) => r.id === s.reportId) : undefined
        const label = s.kind === 'after-report' ? `Summary of the ${report ? formatDate(report.date) : ''} report` : 'Overall summary'
        return (
          <AiOutput
            key={s.id}
            label={mode === 'demo' ? `${label} (pre-written example)` : label}
            footer={
              <p className="hint">
                {formatDate(s.createdAt.slice(0, 10))}
                {mode !== 'demo' && ` · ${s.model}`}
                {mode !== 'demo' && !current(s) && ' · Your results have changed since this was written, so it may be out of date.'}
              </p>
            }
          >
            <Markdown text={s.text} />
          </AiOutput>
        )
      })}
      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  )
}
