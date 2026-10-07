// Before your next test (SPEC.md section 18.6): what was measured last time and what wasn't repeated,
// facts from the history worth having in mind, and a request for the tests the user ticks, in English
// or Portuguese. The app never chooses the tests.

import { ClipboardCheck, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChipGroup, PageHeader, Segmented } from '../../core/ui/components'
import { analyse, notRepeated } from '../../labs/analysis'
import { historyNotes, requestSentence, type RequestLanguage } from '../../labs/nextTest'
import { entryLabel } from '../../labs/timeline'
import { DISCLAIMER } from '../components/Flags'
import { formatDate, plural } from '../format'
import { useBase, useProfileData } from '../profileContext'

const today = () => new Date().toISOString().slice(0, 10)

export function NextTest() {
  const { reports, results, timeline } = useProfileData()
  const base = useBase()
  const [picked, setPicked] = useState<string[]>([])
  const [lang, setLang] = useState<RequestLanguage>('en')
  const [copied, setCopied] = useState(false)

  const panels = useMemo(() => analyse(results, reports), [results, reports])
  const latest = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0]
  const lastIds = latest ? [...new Set(results.filter((r) => r.reportId === latest.id && r.markerId && !r.specimen).map((r) => r.markerId!))] : []
  const missing = notRepeated(results, reports)
  const notes = useMemo(() => historyNotes(results, reports, timeline, today()), [results, reports, timeline])
  const sentence = requestSentence(picked, lang)
  const add = (ids: string[]) => setPicked((p) => [...new Set([...p, ...ids])])

  async function copy() {
    try {
      await navigator.clipboard.writeText(sentence)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable: the text is on screen to copy by hand.
    }
  }

  return (
    <>
      <PageHeader title="Before your next test" subtitle="What you had measured, what wasn't repeated, and a request for the tests you choose." back={{ to: base, label: 'Overview' }} />

      {latest && (
        <>
          <h2 className="section-title">Last time</h2>
          <div className="card">
            <p>
              {formatDate(latest.date)}
              {latest.time && ` at ${latest.time}`}
              {latest.lab && ` · ${latest.lab}`}: {plural(lastIds.length, 'marker')}.
            </p>
            {missing.length > 0 && (
              <p>
                <strong>Not in that report:</strong> {missing.map((m) => `${m.name} (last ${formatDate(m.lastDate)})`).join(', ')}.
              </p>
            )}
          </div>
        </>
      )}

      {(notes.timeOfDay.length > 0 || notes.timed.length > 0 || notes.fasting.known > 0) && (
        <>
          <h2 className="section-title">From your history</h2>
          <div className="card">
            <ul className="plain-list next-test-notes">
              {notes.timed.map((e) => (
                <li key={e.id}>
                  {entryLabel(e)} is on your timeline, with test timing marked as mattering. Note whether the blood is drawn before or after that day's dose; you can record it with the results.
                </li>
              ))}
              {notes.timeOfDay.map((n) => (
                <li key={n.markerId}>
                  {n.name} varies through the day (
                  <a href={n.influence.source.url} target="_blank" rel="noreferrer noopener">
                    {n.influence.source.title}
                  </a>
                  ).{n.times.length > 0 && ` Your earlier draws were at ${n.times.join(', ')}.`}
                </li>
              ))}
              {notes.fasting.known > 0 && (
                <li>
                  {notes.fasting.yes} of your {plural(notes.fasting.known, 'earlier test')} with a note were fasting.
                  {notes.eating.length > 0 && ` Eating before the test can raise ${notes.eating.map((e) => e.name.toLowerCase()).join(' and ')}.`}
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      <h2 className="section-title">
        <ClipboardCheck size={14} aria-hidden /> Tests to ask for
      </h2>
      <div className="card form-layout">
        <div className="row">
          {lastIds.length > 0 && (
            <button type="button" className="button small" onClick={() => add(lastIds)}>
              Add what was measured last time
            </button>
          )}
          {missing.length > 0 && (
            <button type="button" className="button small" onClick={() => add(missing.map((m) => m.markerId))}>
              Add what wasn't repeated
            </button>
          )}
          {picked.length > 0 && (
            <button type="button" className="button small ghost" onClick={() => setPicked([])}>
              Clear
            </button>
          )}
        </div>
        {panels.map((p) => (
          <ChipGroup key={p.id} legend={p.name} options={p.markers.map((a) => ({ value: a.marker.id, label: a.marker.name }))} value={picked.filter((id) => p.markers.some((a) => a.marker.id === id))} onChange={(ids) => setPicked((all) => [...all.filter((id) => !p.markers.some((a) => a.marker.id === id)), ...ids])} />
        ))}
        <p className="hint">Your own choice, for example after talking with your doctor. LabTrails doesn't recommend tests.</p>
      </div>

      {sentence && (
        <>
          <h2 className="section-title">Your request</h2>
          <div className="card form-layout">
            <Segmented legend="Language" name="request-language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }]} />
            <p className="request-sentence" lang={lang}>
              {sentence}
            </p>
            <div className="row">
              <button type="button" className="button small" onClick={() => void copy()}>
                <Copy size={14} aria-hidden /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </>
      )}
      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}
