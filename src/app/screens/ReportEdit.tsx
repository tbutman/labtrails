// Editing a report's details after it was saved: the date, time, lab and the notes on the test. The
// results themselves stay as they were printed.

import { Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ChipGroup, PageHeader, Segmented, TextAreaField, TextField } from '../../core/ui/components'
import { timedOn } from '../../labs/timeline'
import type { DoseTiming, Recently, Report, TestContext } from '../../labs/types'
import { DoseTimingFields } from '../components/DoseTiming'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate } from '../format'

const RECENTLY: { value: Recently; label: string }[] = [
  { value: 'illness', label: 'Illness or infection' },
  { value: 'hard-exercise', label: 'Hard exercise' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'poor-sleep', label: 'Poor sleep' },
]

export function ReportEdit() {
  const { reportId = '' } = useParams()
  const { reports } = useProfileData()
  const base = useBase()
  const report = reports.find((r) => r.id === reportId)
  if (!report) return <Navigate to={`${base}/reports`} replace />
  return <EditForm key={report.id} report={report} base={base} />
}

function EditForm({ report, base }: { report: Report; base: string }) {
  const { store, mode, core, saveCore, changed } = useSession()
  const navigate = useNavigate()
  const [date, setDate] = useState(report.date)
  const [time, setTime] = useState(report.time ?? '')
  const [lab, setLab] = useState(report.lab ?? '')
  const [fasting, setFasting] = useState<TestContext['fasting']>(report.context?.fasting)
  const [medications, setMedications] = useState(report.context?.medications ?? '')
  const [recently, setRecently] = useState<Recently[]>(report.context?.recently ?? [])
  const [notes, setNotes] = useState(report.context?.notes ?? '')
  const [doseTiming, setDoseTiming] = useState<DoseTiming[]>(report.context?.doseTiming ?? [])
  const { timeline } = useProfileData()
  const timed = timedOn(timeline, date)
  // Timings recorded for entries no longer on the timeline stay as they were.
  const kept = doseTiming.filter((t) => timed.some((e) => e.id === t.entryId) || !timeline.some((e) => e.id === t.entryId))
  const [error, setError] = useState('')
  const demo = mode === 'demo'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    if (!date) return setError('Enter the date the blood was taken.')
    const context: TestContext = {
      ...(fasting ? { fasting } : {}),
      ...(medications.trim() ? { medications: medications.trim() } : {}),
      ...(recently.length ? { recently } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(kept.length ? { doseTiming: kept } : {}),
    }
    const { time: _t, lab: _l, context: _c, ...rest } = report
    const next: Report = {
      ...rest,
      date,
      ...(time ? { time } : {}),
      ...(lab.trim() ? { lab: lab.trim() } : {}),
      ...(Object.keys(context).length ? { context } : {}),
      updatedAt: new Date().toISOString(),
    }
    await store.put('reports', next)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(`${base}/reports#report-${report.id}`)
  }

  return (
    <>
      <PageHeader title="Edit report details" subtitle={`The report from ${formatDate(report.date)}. Results stay exactly as printed.`} back={{ to: `${base}/reports#report-${report.id}`, label: 'Reports' }} />
      <form className="card form-layout" onSubmit={submit} noValidate>
        <div className="input-row three">
          <TextField label="Date the blood was taken" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={error} />
          <TextField label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <TextField label="Lab (optional)" value={lab} onChange={(e) => setLab(e.target.value)} />
        </div>
        <Segmented
          legend="Fasting?"
          name="edit-fasting"
          value={fasting}
          onChange={setFasting}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: "Don't know" },
          ]}
        />
        <TextAreaField label="Medications and supplements (optional)" rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} />
        <DoseTimingFields entries={timed} date={date} value={doseTiming} onChange={setDoseTiming} />
        <ChipGroup legend="Recently (optional)" options={RECENTLY} value={recently} onChange={setRecently} />
        <TextAreaField label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {demo && <p className="hint">In the demo, changes last until you leave it.</p>}
        <div className="form-actions">
          <Link className="button ghost" to={`${base}/reports#report-${report.id}`}>
            Cancel
          </Link>
          <button className="button primary">
            <Save size={16} aria-hidden /> Save details
          </button>
        </div>
      </form>
    </>
  )
}
