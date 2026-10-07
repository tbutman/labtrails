// Entering a report by hand (no AI needed). Each row is typed as printed on the report; the code
// matches the name to the catalogue, parses the value and range, and shows what it understood before
// anything is saved.

import { CalendarRange, Copy, Plus, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import type { StoredDoc } from '../../core/import/duplicates'
import { Pages, usePages } from './Reports'
import { FAR_FROM_RANGE, aliasToRemember, farFromRange, resultFromInput, understandInput, validateInput, type ResultInput } from '../../labs/edit'
import { personAt } from '../../labs/person'
import { activeOn, entryLabel, timedOn } from '../../labs/timeline'
import type { Alias, DoseTiming, Recently, Report, TestContext } from '../../labs/types'
import { DoseTimingFields } from '../components/DoseTiming'
import type { DecimalHint } from '../../labs/units/parse'
import { ChipGroup, PageHeader, Segmented, TextAreaField, TextField } from '../../core/ui/components'
import { DecimalSwitch, MarkerNames, ResultFields } from '../components/ResultFields'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { useLeaveWarning } from '../returnTo'

type Row = ResultInput & { key: string }

const todayIso = () => new Date().toISOString().slice(0, 10)

const emptyRow = (): Row => ({ key: crypto.randomUUID(), name: '', value: '', unit: '', range: '', flag: '', markerId: '' })

const RECENTLY: { value: Recently; label: string }[] = [
  { value: 'illness', label: 'Illness or infection' },
  { value: 'hard-exercise', label: 'Hard exercise' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'poor-sleep', label: 'Poor sleep' },
]

export function ReportForm() {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profile, reports, timeline } = useProfileData()
  const base = useBase()
  const navigate = useNavigate()
  const [aliases, setAliases] = useState<Alias[] | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [lab, setLab] = useState('')
  // No decimal mark until the person chooses one, so "6,500" gets "check the decimal mark" (LAB-03).
  const [decimal, setDecimal] = useState<DecimalHint | undefined>()
  const [fasting, setFasting] = useState<TestContext['fasting']>()
  const [medications, setMedications] = useState('')
  const [recently, setRecently] = useState<Recently[]>([])
  const [notes, setNotes] = useState('')
  const [doseTiming, setDoseTiming] = useState<DoseTiming[]>([])
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()])
  const [error, setError] = useState('')
  // A kept file to type the results from, shown alongside (LAB-14).
  const documentId = useSearchParams()[0].get('document')
  const pages = usePages(store, documentId)
  useLeaveWarning(!!(date || time || lab.trim() || medications.trim() || notes.trim() || rows.some((r) => r.name.trim() || r.value.trim())))

  useEffect(() => {
    if (store) void store.list<Alias>('aliases').then(setAliases)
  }, [store])

  if (!store) return <Navigate to="/app" replace />
  if (mode === 'demo')
    return (
      <>
        <PageHeader title="Add results" back={{ to: base, label: 'Overview' }} />
        <p>Adding reports isn't available in the demo, because nothing in the demo is saved.</p>
        <Link to={base}>Back</Link>
      </>
    )

  const previous = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0]
  // Medications and supplements on the timeline on the test date (or today, before a date is chosen).
  const onTimeline = activeOn(timeline, date || todayIso()).filter((e) => e.kind === 'medication' || e.kind === 'supplement')
  const timed = date ? timedOn(timeline, date) : []
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    const filled = rows.filter((r) => !validateInput(r))
    if (!date) return setError('Enter the date the blood was taken.')
    if (filled.length === 0) return setError('Add at least one result with a name and a value.')
    const unresolved = filled.find((r) => understandInput(r, decimal, aliases ?? []).match.status === 'ambiguous' && !r.markerId)
    if (unresolved) return setError(`Choose which marker "${unresolved.name}" is.`)
    // A value far beyond its range is asked about once more before saving (LAB-23).
    const far = filled.filter((r) => farFromRange(understandInput(r, decimal, aliases ?? [], personAt(profile, date))))
    if (far.length && !window.confirm(`${far.map((r) => r.name.trim()).join(', ')}: ${FAR_FROM_RANGE}\n\nSave anyway?`)) return

    const now = new Date().toISOString()
    const context: TestContext = {
      ...(fasting ? { fasting } : {}),
      ...(medications.trim() ? { medications: medications.trim() } : {}),
      ...(recently.length ? { recently } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(doseTiming.length ? { doseTiming: doseTiming.filter((t) => timed.some((e) => e.id === t.entryId)) } : {}),
    }
    const report: Report = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      date,
      ...(time ? { time } : {}),
      ...(lab.trim() ? { lab: lab.trim() } : {}),
      source: 'manual',
      ...(pages.length ? { documentId: pages[0].id } : {}),
      ...(Object.keys(context).length ? { context } : {}),
      createdAt: now,
      updatedAt: now,
    }
    await store.put('reports', report)
    for (const { key, ...r } of filled) {
      await store.put('results', resultFromInput(r, { id: key, reportId: report.id, profileId: profile.id, createdAt: now }, decimal, now, aliases ?? [], personAt(profile, date)))
      // A name the user mapped by hand is remembered for next time.
      const alias = aliasToRemember(r, aliases ?? [], undefined, () => crypto.randomUUID())
      if (alias) await store.put('aliases', alias)
    }
    // The file it was typed from is now read.
    for (const page of pages as StoredDoc[]) await store.put('documents', { ...page, meta: { ...page.meta, importStatus: 'read' } })
    await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(base)
  }

  return (
    <>
      <PageHeader title="Add results" subtitle="Type them in as printed on the report." back={{ to: base, label: profile.name }} />
      <form onSubmit={submit} noValidate className="form-layout">
        {pages.length > 0 && store && (
          <section className="card typed-from">
            <h2 className="card-title">The report</h2>
            <Pages store={store} pages={pages} />
          </section>
        )}
        <section className="card">
          <h2 className="card-title">The test</h2>
          <div className="input-row three">
            <TextField label="Date the blood was taken" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <TextField label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <TextField label="Lab (optional)" value={lab} onChange={(e) => setLab(e.target.value)} />
          </div>
          <Segmented
            legend="Fasting?"
            name="fasting"
            value={fasting}
            onChange={setFasting}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unknown', label: "Don't know" },
            ]}
          />
          <TextAreaField
            label="Medications and supplements (optional)"
            rows={2}
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            hint="Anything you were taking at the time. Sent to the AI only if you ask for a summary and confirm."
          />
          {(previous?.context?.medications || onTimeline.length > 0) && (
            <div className="row">
              {previous?.context?.medications && (
                <button type="button" className="button small same-as-last" onClick={() => setMedications(previous.context!.medications!)}>
                  <Copy size={14} aria-hidden /> Same as last time
                </button>
              )}
              {onTimeline.length > 0 && (
                <button type="button" className="button small same-as-last" onClick={() => setMedications(onTimeline.map(entryLabel).join('; '))}>
                  <CalendarRange size={14} aria-hidden /> From your timeline
                </button>
              )}
            </div>
          )}
          <DoseTimingFields entries={timed} date={date} value={doseTiming} onChange={setDoseTiming} />
          <ChipGroup legend="Recently (optional)" options={RECENTLY} value={recently} onChange={setRecently} />
          <TextAreaField label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Results</h2>
            <DecimalSwitch value={decimal} onChange={setDecimal} />
          </div>
          <MarkerNames />
          <div className="result-rows">
            {rows.map((r, i) => (
              <ResultFields key={r.key} input={r} label={`Result ${i + 1}`} decimal={decimal} aliases={aliases ?? []} person={personAt(profile, date)} onChange={(patch) => update(r.key, patch)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            ))}
          </div>
          <button type="button" className="button small" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            <Plus size={14} aria-hidden /> Add another result
          </button>
        </section>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className="button ghost" to={base}>
            Cancel
          </Link>
          <button className="button primary large">
            <Save size={18} aria-hidden /> Save the report
          </button>
        </div>
      </form>
    </>
  )
}
