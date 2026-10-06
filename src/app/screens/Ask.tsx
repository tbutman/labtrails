// Ask about the numbers: questions answered from the facts LabTrails computes, in saved threads, one
// set per person. Only the markers a question is about are sent, and every number in an answer is
// checked against exactly those facts by the core before it's shown (src/core/ask, request 15).

import { MessageCircleQuestion, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AiError } from '../../core/ai/client'
import { redactNames } from '../../core/ai/redact'
import { SendSheet } from '../../core/ai/SendSheet'
import { askQuestion } from '../../core/ask/ask'
import { AskThreadView } from '../../core/ask/AskThreadView'
import type { AskThread, AskTurn } from '../../core/ask/model'
import { EmptyState, PageHeader, TextAreaField } from '../../core/ui/components'
import { ASK_BANNED, ASK_SYSTEM, askFacts, askFactsText, askSuggestions, LAB_UNITS, OUT_OF_SCOPE } from '../../labs/ai/ask'
import { digest } from '../../labs/ai/digest'
import { DISCLAIMER } from '../components/Flags'
import { DEMO_ANSWERS } from '../demo'
import { formatDate, plural } from '../format'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'

const PREPARED_NOTE = 'Demo: prepared in advance for this made-up person, in the style of the AI answers. No AI was called.'
const nowIso = () => new Date().toISOString()

export function Ask() {
  const { profile, reports, results } = useProfileData()
  const { store, core, mode, app, changed, version } = useSession()
  const base = useBase()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [all, setAll] = useState<AskThread[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (store) void store.list<AskThread>('askThreads').then(setAll)
  }, [store, version])

  const threads = useMemo(() => all.filter((t) => t.profileId === profile.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [all, profile.id])
  const thread = threads.find((t) => t.id === params.get('thread'))
  const suggestions = useMemo(() => askSuggestions(reports, results, app.preferredUnit), [reports, results, app.preferredUnit])
  const back = { to: `${base}/summaries`, label: 'Summaries' }

  if (results.length === 0)
    return (
      <>
        <PageHeader title="Ask about your results" back={back} />
        <EmptyState icon={MessageCircleQuestion} title="No results yet">
          Add a report first; answers come from your own results.
        </EmptyState>
      </>
    )

  // The facts for a question: the markers it (or the conversation so far) is about.
  const asked = (text: string) => [...(thread?.turns ?? []).filter((t) => t.role === 'parent').map((t) => t.text), text]
  const factsFor = (text: string) => askFacts(profile, reports, results, asked(text), app.preferredUnit)
  // A question that would send different facts from the last answer asks for agreement again.
  const lastDigest = thread?.turns.filter((t) => t.role === 'ai').at(-1)?.factsDigest
  const hide = (t: string) => redactNames(t, [profile.name], 'the person')

  async function saveTurns(turns: AskTurn[]) {
    if (!store) return
    const now = nowIso()
    const next: AskThread = thread ? { ...thread, turns: [...thread.turns, ...turns], updatedAt: now } : { id: crypto.randomUUID(), profileId: profile.id, createdAt: now, updatedAt: now, turns }
    await store.put('askThreads', next)
    changed()
    setParams({ thread: next.id }, { replace: true })
  }

  async function submit(q: string) {
    const text = q.trim()
    setError('')
    if (!text) return setError('Type a question first.')
    if (mode === 'demo') {
      const match = suggestions.find((s) => s.text === text)
      if (!match || thread) return setError('In the demo, try one of the suggested questions as a new question. Your own questions use your own Anthropic key.')
      setQuestion('')
      const prepared = DEMO_ANSWERS[match.id]
      return saveTurns([
        { role: 'parent', text, createdAt: nowIso() },
        { role: 'ai', kind: 'prepared', text: prepared.text, model: 'prepared in advance', createdAt: nowIso() },
      ])
    }
    if (!core.ai.apiKey) return setError('NO_KEY')
    const facts = factsFor(text)
    if (!thread || digest(askFactsText(facts)) !== lastDigest) return setPending(text)
    return send(text)
  }

  async function send(text: string) {
    setBusy(true)
    setError('')
    try {
      const facts = factsFor(text)
      const factsText = askFactsText(facts)
      const outcome = await askQuestion({
        apiKey: core.ai.apiKey!,
        model: core.ai.model,
        system: ASK_SYSTEM,
        factsText,
        facts,
        // A name typed into a question is replaced in everything sent; the thread keeps the words typed.
        history: (thread?.turns ?? []).map((t) => ({ ...t, text: hide(t.text) })),
        question: hide(text),
        banned: ASK_BANNED,
        units: LAB_UNITS,
      })
      const factsDigest = digest(factsText)
      const ai: AskTurn =
        'withheld' in outcome
          ? { role: 'ai', kind: 'unchecked', text: '', model: core.ai.model, factsDigest, createdAt: nowIso() }
          : { role: 'ai', kind: outcome.answer.kind, text: outcome.answer.text, model: core.ai.model, factsDigest, createdAt: nowIso() }
      await saveTurns([{ role: 'parent', text, createdAt: nowIso() }, ai])
      setQuestion('')
      setPending(null)
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(t: AskThread) {
    if (!store || !window.confirm('Delete this conversation?')) return
    await store.delete('askThreads', t.id)
    changed()
    navigate(`${base}/ask`, { replace: true })
  }

  const pendingFacts = pending ? factsFor(pending) : null
  const estimate = pendingFacts
    ? { inputTokens: Math.ceil((ASK_SYSTEM.length + askFactsText(pendingFacts).length + (thread ? JSON.stringify(thread.turns).length : 0) + 200) / 3.5), outputTokens: 500 }
    : { inputTokens: 0, outputTokens: 0 }

  return (
    <>
      <PageHeader
        title="Ask about your results"
        subtitle="Answers use only the numbers LabTrails worked out from your reports, and every number is checked before you see it."
        back={back}
        actions={
          thread && (
            <Link className="button small" to={`${base}/ask`}>
              <Plus size={14} aria-hidden /> New question
            </Link>
          )
        }
      />

      {thread && <AskThreadView turns={thread.turns} outOfScope={OUT_OF_SCOPE} preparedNote={PREPARED_NOTE} />}

      {pending && pendingFacts ? (
        <>
          <p className="ask-question pending">{pending}</p>
          <SendSheet
            appName="LabTrails"
            sending={[
              'Your question',
              pendingFacts.selection === 'named in the question'
                ? `Your results for ${pendingFacts.markers.map((m) => m.marker).join(', ')}, with dates, labs and each lab's range, and the flags LabTrails computed`
                : `The ${plural(pendingFacts.markers.length, 'marker')} LabTrails flagged, with dates, labs, each lab's range and the flags`,
              'The names of your other markers, without their results',
              'Your age and sex, if you added them',
              ...(thread ? ['The earlier questions and answers in this conversation'] : []),
            ]}
            notSending={['Your name and date of birth', 'Your notes and medications', 'Your documents', "Other people's results"]}
            notes={['If your question includes your name, LabTrails replaces it with “the person” before sending.']}
            model={core.ai.model}
            estimate={estimate}
            busy={busy}
            onSend={() => void send(pending)}
            onCancel={() => setPending(null)}
          />
        </>
      ) : (
        <form
          className="card ask-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void submit(question)
          }}
        >
          {!thread && suggestions.length > 0 && (
            <div className="ask-suggestions" role="group" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button key={s.id} type="button" className="button small" disabled={busy} onClick={() => void submit(s.text)}>
                  {s.text}
                </button>
              ))}
            </div>
          )}
          <TextAreaField label={thread ? 'Ask a follow-up' : 'Your question'} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="row">
            <button className="button primary" type="submit" disabled={busy}>
              <MessageCircleQuestion size={16} aria-hidden /> {busy ? 'Asking…' : 'Ask'}
            </button>
          </div>
          <p className="hint">
            {mode === 'demo'
              ? 'In the demo, the suggested questions have answers prepared in advance.'
              : 'Uses AI with your own key: about 1 to 2 US cents a question. Name the markers you mean ("my ferritin", "my cholesterol"); answers explain your results, and never say whether they are healthy.'}
          </p>
        </form>
      )}

      {error &&
        (error === 'NO_KEY' ? (
          <p className="callout" role="alert">
            Answers use AI with your own Anthropic API key. <Link to="/app/settings#ai">Add one in Settings</Link>.
          </p>
        ) : (
          <p className="error" role="alert">
            {error}
          </p>
        ))}

      {thread && (
        <button type="button" className="button ghost danger small" onClick={() => void remove(thread)}>
          <Trash2 size={14} aria-hidden /> Delete this conversation
        </button>
      )}

      {threads.filter((t) => t.id !== thread?.id).length > 0 && (
        <>
          <h2 className="section-title">Earlier questions</h2>
          <div className="card padless list">
            {threads
              .filter((t) => t.id !== thread?.id)
              .map((t) => (
                <Link key={t.id} className="list-row" to={`${base}/ask?thread=${t.id}`}>
                  <span className="list-row-main">
                    <span className="list-row-title">{t.turns[0]?.text}</span>
                    <span className="list-row-sub">
                      {formatDate(t.updatedAt.slice(0, 10))} · {plural(t.turns.filter((x) => x.role === 'parent').length, 'question')}
                    </span>
                  </span>
                </Link>
              ))}
          </div>
        </>
      )}
      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}
