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
import { MessageCircleQuestion, Sparkles } from 'lucide-react'
import { Callout, EmptyState, PageHeader } from '../../core/ui/components'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { bannedPhrase, summaryWordingError, UNCHECKED_NUMBERS_NOTE } from '../../core/ask/wording'
import { demoNote } from '../../core/ui/copy'
import { formatDate } from '../format'

type Request = { kind: Summary['kind']; reportId?: string; facts: SummaryFacts }

export function Summaries() {
  const { profile, reports, results, summaries, timeline, lines } = useProfileData()
  const base = useBase()
  const { mode, store, core, app, changed } = useSession()
  const [params] = useSearchParams()
  const [request, setRequest] = useState<Request | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted.find((r) => r.id === params.get('report')) ?? sorted[0]
  const factsFor = (kind: Summary['kind'], reportId?: string) =>
    kind === 'after-report' && reportId ? afterReportFacts(profile, reports, results, reportId, app.preferredUnit, timeline, lines) : overallFacts(profile, reports, results, app.preferredUnit, timeline, lines)
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
      // The same banned wording as Ask (CORE-04): a summary that uses it isn't saved.
      if (bannedPhrase(text)) {
        setError(summaryWordingError('LabTrails'))
        return
      }
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
        <PageHeader title={request.kind === 'after-report' ? 'Summarize this report' : 'Overall summary'} />
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
            ...(context ? [`The test's context${context.medications ? ', including medications and supplements' : ''}${context.doseTiming ? ', when it was drawn relative to a dose' : ''}${context.notes ? ' and your notes' : ''}`] : []),
            ...(request.facts.timeline?.length ? [`Your timeline during these results: ${request.facts.timeline.map((t) => t.name).join(', ')}, with dates and doses`] : []),
            ...(request.facts.markers.some((m) => m.knownInfluences) ? ['Documented influences LabTrails matched to your timeline or notes, with their sources'] : []),
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
      <PageHeader
        title="Summaries"
        subtitle={`Plain-language explanations of what the code flagged. No new flags, no diagnosis, no treatment advice.${mode === 'demo' ? ' In the demo these are pre-written examples.' : ''}`}
        actions={
          <Link className="button" to={`${base}/ask`}>
            <MessageCircleQuestion size={16} aria-hidden /> Ask about your results
          </Link>
        }
      />
      {canAsk && latest && (
        <p className="row summaries-actions">
          <button className="button primary" onClick={() => setRequest({ kind: 'after-report', reportId: latest.id, facts: factsFor('after-report', latest.id) })}>
            Summarize the {formatDate(latest.date)} report
          </button>
          <button className="button" onClick={() => setRequest({ kind: 'overall', facts: factsFor('overall') })}>
            Write an overall summary
          </button>
        </p>
      )}
      {mode === 'unlocked' && !core.ai.apiKey && (
        <Callout icon={Sparkles}>
          <span>
            Summaries use AI with your own Anthropic API key. <Link to="/app/settings#ai">Add one in Settings</Link> to write them.
          </span>
        </Callout>
      )}
      {ordered.length === 0 && (
        <EmptyState icon={Sparkles} title="No summaries yet">
          A summary explains what changed in a report, or across all your results.
        </EmptyState>
      )}
      {ordered.map((s) => {
        const report = s.reportId ? reports.find((r) => r.id === s.reportId) : undefined
        const label = s.kind === 'after-report' ? `Summary of the ${report ? formatDate(report.date) : ''} report` : 'Overall summary'
        return (
          <AiOutput
            key={s.id}
            label={mode === 'demo' ? `${label} (pre-written example)` : label}
            {...(mode === 'demo' ? { note: demoNote('person') } : {})}
            footer={
              <p className="hint">
                {formatDate(s.createdAt.slice(0, 10))}
                {mode !== 'demo' && ` · ${s.model}`}
                {mode !== 'demo' && !current(s) && ' · Your results have changed since this was written, so it may be out of date.'}
              </p>
            }
          >
            <Markdown text={s.text} />
            <p className="hint">{UNCHECKED_NUMBERS_NOTE}</p>
          </AiOutput>
        )
      })}
      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}
