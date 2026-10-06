// Entering a report by hand (no AI needed). Each row is typed as printed on the report; the code
// matches the name to the catalogue, parses the value and range, and shows what it understood before
// anything is saved.

import { CheckCircle2, CircleHelp, Copy, Plus, Save, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { MARKERS, PANELS, getMarker } from '../../labs/catalogue/catalogue'
import { matchMarker } from '../../labs/match/match'
import type { Alias, Recently, Report, Result, TestContext } from '../../labs/types'
import { normaliseUnit } from '../../labs/units/normalise'
import { parseRange, parseValue, type DecimalHint } from '../../labs/units/parse'
import { ChipGroup, PageHeader, Segmented, TextAreaField, TextField } from '../../core/ui/components'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatValue } from '../format'

type Row = { key: string; name: string; value: string; unit: string; range: string; flag: string; mapTo: string }

const emptyRow = (): Row => ({ key: crypto.randomUUID(), name: '', value: '', unit: '', range: '', flag: '', mapTo: '' })

const RECENTLY: { value: Recently; label: string }[] = [
  { value: 'illness', label: 'Illness or infection' },
  { value: 'hard-exercise', label: 'Hard exercise' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'poor-sleep', label: 'Poor sleep' },
]

const KEEP = '' // keep the row as printed, unmapped

export function ReportForm() {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profile, reports } = useProfileData()
  const base = useBase()
  const navigate = useNavigate()
  const [aliases, setAliases] = useState<Alias[] | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [lab, setLab] = useState('')
  const [decimal, setDecimal] = useState<DecimalHint>(',')
  const [fasting, setFasting] = useState<TestContext['fasting']>()
  const [medications, setMedications] = useState('')
  const [recently, setRecently] = useState<Recently[]>([])
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()])
  const [error, setError] = useState('')

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
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    const filled = rows.filter((r) => r.name.trim() && r.value.trim())
    if (!date) return setError('Enter the date the blood was taken.')
    if (filled.length === 0) return setError('Add at least one result with a name and a value.')
    const unresolved = filled.find((r) => understand(r, decimal, aliases ?? []).match.status === 'ambiguous' && !r.mapTo)
    if (unresolved) return setError(`Choose which marker "${unresolved.name}" is.`)

    const now = new Date().toISOString()
    const context: TestContext = {
      ...(fasting ? { fasting } : {}),
      ...(medications.trim() ? { medications: medications.trim() } : {}),
      ...(recently.length ? { recently } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    const report: Report = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      date,
      ...(time ? { time } : {}),
      ...(lab.trim() ? { lab: lab.trim() } : {}),
      source: 'manual',
      ...(Object.keys(context).length ? { context } : {}),
      createdAt: now,
      updatedAt: now,
    }
    await store.put('reports', report)
    for (const r of filled) {
      const u = understand(r, decimal, aliases ?? [])
      const result: Result = {
        id: crypto.randomUUID(),
        reportId: report.id,
        profileId: profile.id,
        ...(u.markerId ? { markerId: u.markerId } : {}),
        nameAsPrinted: r.name.trim(),
        ...(u.value.kind === 'number' ? { value: u.value.value, ...(u.value.comparator ? { comparator: u.value.comparator } : {}) } : { textValue: u.value.text }),
        ...(r.unit.trim() ? { unitAsPrinted: r.unit.trim() } : {}),
        ...(r.range.trim() ? { range: u.range ?? { text: r.range.trim() } } : {}),
        ...(r.flag.trim() ? { flagAsPrinted: r.flag.trim() } : {}),
        createdAt: now,
        updatedAt: now,
      }
      await store.put('results', result)
      // A name the user mapped by hand is remembered for next time.
      if (r.mapTo && u.match.status !== 'matched') {
        await store.put('aliases', { id: crypto.randomUUID(), nameAsPrinted: r.name.trim(), ...(r.unit.trim() ? { unitAsPrinted: r.unit.trim() } : {}), markerId: r.mapTo } satisfies Alias)
      }
    }
    await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(base)
  }

  return (
    <>
      <PageHeader title="Add results" subtitle="Type them in as printed on the report." back={{ to: base, label: profile.name }} />
      <form onSubmit={submit} noValidate className="form-layout">
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
          {previous?.context?.medications && (
            <button type="button" className="button small same-as-last" onClick={() => setMedications(previous.context!.medications!)}>
              <Copy size={14} aria-hidden /> Same as last time
            </button>
          )}
          <ChipGroup legend="Recently (optional)" options={RECENTLY} value={recently} onChange={setRecently} />
          <TextAreaField label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Results</h2>
            <label className="decimal-switch">
              <span className="sr-only">Numbers on this report are written like</span>
              <select aria-label="Numbers on this report are written like" value={decimal} onChange={(e) => setDecimal(e.target.value as DecimalHint)}>
                <option value=",">5,4 (decimal comma)</option>
                <option value=".">5.4 (decimal point)</option>
              </select>
            </label>
          </div>
          <datalist id="marker-names">
            {MARKERS.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          <div className="result-rows">
            {rows.map((r, i) => (
              <ResultRow key={r.key} row={r} index={i} decimal={decimal} aliases={aliases ?? []} onChange={(patch) => update(r.key, patch)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
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

function understand(r: Row, decimal: DecimalHint, aliases: Alias[]) {
  const unit = r.unit.trim() ? normaliseUnit(r.unit) : undefined
  const match = r.name.trim() ? matchMarker(r.name, unit, aliases) : ({ status: 'unknown' } as const)
  const markerId = r.mapTo || (match.status === 'matched' ? match.markerId : undefined)
  return { match, markerId, value: parseValue(r.value, decimal), range: r.range.trim() ? parseRange(r.range, decimal) : null }
}

function ResultRow({ row, index, decimal, aliases, onChange, onRemove }: { row: Row; index: number; decimal: DecimalHint; aliases: Alias[]; onChange: (p: Partial<Row>) => void; onRemove: () => void }) {
  const u = understand(row, decimal, aliases)
  const marker = u.markerId ? getMarker(u.markerId) : undefined
  const unitKnown = marker && row.unit.trim() ? marker.units.some((d) => d.unit === normaliseUnit(row.unit)) : true
  const unitsId = `units-${row.key}`

  return (
    <fieldset className="result-row">
      <legend className="sr-only">Result {index + 1}</legend>
      <div className="result-grid">
        <TextField label="Name" list="marker-names" value={row.name} onChange={(e) => onChange({ name: e.target.value, mapTo: '' })} autoComplete="off" />
        <TextField label="Value" inputMode="decimal" value={row.value} onChange={(e) => onChange({ value: e.target.value })} autoComplete="off" />
        <TextField label="Unit" list={marker ? unitsId : undefined} value={row.unit} onChange={(e) => onChange({ unit: e.target.value })} autoComplete="off" />
        <TextField label="Range" value={row.range} onChange={(e) => onChange({ range: e.target.value })} autoComplete="off" placeholder="e.g. 70 - 110" />
        <TextField label="Flag" value={row.flag} onChange={(e) => onChange({ flag: e.target.value })} autoComplete="off" placeholder="e.g. H" />
      </div>
      {marker && (
        <datalist id={unitsId}>
          {marker.units.map((d) => (
            <option key={d.unit} value={d.unit} />
          ))}
        </datalist>
      )}
      {row.name.trim() && (
        <div className="row-status" aria-live="polite">
          {u.match.status === 'matched' && !row.mapTo ? (
            <span className="understood">
              <CheckCircle2 size={15} aria-hidden /> Understood as <strong>{getMarker(u.match.markerId)?.name}</strong>
              {u.match.via === 'user' && ' (your mapping)'}
            </span>
          ) : (
            <label className="map-to">
              <CircleHelp size={15} aria-hidden />
              {u.match.status === 'ambiguous' ? 'Which marker is this?' : 'Not in the catalogue. Map it to'}
              <select value={row.mapTo} onChange={(e) => onChange({ mapTo: e.target.value })}>
                <option value={KEEP}>{u.match.status === 'ambiguous' ? 'Choose…' : 'Keep as printed'}</option>
                {PANELS.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {MARKERS.filter((m) => m.panel === p.id && (u.match.status !== 'ambiguous' || u.match.candidates.includes(m.id))).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {row.value.trim() && (
            <span className="faint">
              {u.value.kind === 'number' ? `Value ${u.value.comparator ?? ''}${formatValue(u.value.value)}${u.value.ambiguous ? ' (check the decimal mark)' : ''}` : 'Kept as text'}
            </span>
          )}
          {row.range.trim() && <span className="faint">{u.range ? `Range ${u.range.low ?? '…'} to ${u.range.high ?? '…'}` : 'Range kept as printed'}</span>}
          {!unitKnown && <span className="error">LabTrails doesn't know this unit for {marker?.name}; it'll be kept but can't be converted.</span>}
          <button type="button" className="icon-button remove-row" onClick={onRemove} aria-label={`Remove result ${index + 1}`}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </fieldset>
  )
}
