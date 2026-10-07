// The personal timeline (SPEC.md section 18.1): medications, supplements, lifestyle changes and
// events, with when they started and ended. They never change a flag; they're shown on the charts and
// the table, and on the doctor report if the user ticks it.

import { CalendarRange, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Checkbox, Chip, EmptyState, PageHeader, Segmented, SelectField, TextAreaField, TextField } from '../../core/ui/components'
import { KINDS, LIFESTYLE_SUGGESTIONS, entryFromInput, entryLabel, inputFromEntry, lastDay, sortByStart, validateEntry, type EntryInput, type TimelineEntry, type TimelineKind } from '../../labs/timeline'
import { formatPeriod } from '../format'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'

const kindLabel = (k: TimelineKind) => KINDS.find((x) => x.value === k)?.label ?? k
const today = () => new Date().toISOString().slice(0, 10)

export function Timeline() {
  const { profile, timeline } = useProfileData()
  const base = useBase()
  const sorted = sortByStart(timeline).reverse()
  const ongoing = sorted.filter((e) => !e.end || lastDay(e.end) >= today())
  const ended = sorted.filter((e) => !ongoing.includes(e))

  const list = (entries: TimelineEntry[]) => (
    <div className="card padless">
      <ul className="list">
        {entries.map((e) => (
          <li key={e.id} className="list-row">
            <span className="list-row-main">
              <span className="list-row-title">{entryLabel(e)}</span>
              <span className="list-row-sub">
                {formatPeriod(e.start, e.end)}
                {e.timing && ' · test timing matters'}
                {e.notes && ` · ${e.notes}`}
              </span>
            </span>
            <Chip tone="outline">{kindLabel(e.kind)}</Chip>
            <Link className="icon-button" to={`${base}/timeline/${e.id}`} aria-label={`Edit ${e.name}`} title="Edit">
              <Pencil size={15} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Timeline"
        subtitle={`Medications, supplements and changes in ${profile.name}'s life, shown on the charts so results can be read in context. They never change a flag.`}
        actions={
          <Link className="button primary" to={`${base}/timeline/new`}>
            <Plus size={16} aria-hidden /> Add to the timeline
          </Link>
        }
      />
      {timeline.length === 0 && (
        <EmptyState icon={CalendarRange} title="Nothing on the timeline yet">
          Add a medication or supplement with when it started, or a change like stopping alcohol or starting training. It appears on every chart.
        </EmptyState>
      )}
      {ongoing.length > 0 && (
        <>
          <h2 className="section-title">Ongoing · {ongoing.length}</h2>
          {list(ongoing)}
        </>
      )}
      {ended.length > 0 && (
        <>
          <h2 className="section-title">Ended · {ended.length}</h2>
          {list(ended)}
        </>
      )}
    </>
  )
}

export function TimelineEdit() {
  const { entryId } = useParams()
  const { timeline } = useProfileData()
  const base = useBase()
  const entry = entryId ? timeline.find((e) => e.id === entryId) : undefined
  if (entryId && !entry) return <Navigate to={`${base}/timeline`} replace />
  return <EntryForm key={entry?.id ?? 'new'} entry={entry} base={base} />
}

/** A day or, with "only the month", a month. */
function WhenField({ label, value, onChange, optional }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const monthOnly = /^\d{4}-\d{2}$/.test(value)
  return (
    <div className="when-field">
      <TextField label={label} type={monthOnly ? 'month' : 'date'} value={value} onChange={(e) => onChange(e.target.value)} hint={optional ? 'Leave empty if it’s ongoing.' : undefined} />
      <Checkbox checked={monthOnly} onChange={(m) => onChange(m ? value.slice(0, 7) : value ? `${value}-01` : '')}>
        Only the month
      </Checkbox>
    </div>
  )
}

function EntryForm({ entry, base }: { entry?: TimelineEntry; base: string }) {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profile } = useProfileData()
  const navigate = useNavigate()
  const [input, setInput] = useState<EntryInput>(() => inputFromEntry(entry))
  const [error, setError] = useState('')
  const set = (patch: Partial<EntryInput>) => setInput((i) => ({ ...i, ...patch }))
  const back = `${base}/timeline`
  const dosed = input.kind === 'medication' || input.kind === 'supplement'

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    const invalid = validateEntry(input)
    if (invalid) return setError(invalid)
    const now = new Date().toISOString()
    await store.put('timeline', entryFromInput(input, entry ?? { id: crypto.randomUUID(), profileId: profile.id, createdAt: now }, now))
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(back)
  }

  async function remove() {
    if (!store || !entry || !window.confirm(`Delete "${entry.name}" from the timeline? This can't be undone, except from a backup.`)) return
    await store.delete('timeline', entry.id)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(back)
  }

  return (
    <>
      <PageHeader title={entry ? `Edit ${entry.name}` : 'Add to the timeline'} back={{ to: back, label: 'Timeline' }} />
      <form className="card form-layout" onSubmit={save} noValidate>
        <Segmented legend="What is it?" name="timeline-kind" value={input.kind} onChange={(kind) => set({ kind })} options={KINDS} />
        <TextField
          label="Name"
          value={input.name}
          onChange={(e) => set({ name: e.target.value })}
          list={input.kind === 'lifestyle' ? 'lifestyle-names' : undefined}
          hint={dosed ? 'As on the box or prescription, for example "Vitamin D3".' : input.kind === 'lifestyle' ? 'For example "Stopped alcohol" or "Training".' : 'For example "Flu" or "Surgery".'}
          autoComplete="off"
        />
        <datalist id="lifestyle-names">
          {LIFESTYLE_SUGGESTIONS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="input-row">
          <WhenField label="Started" value={input.start} onChange={(start) => set({ start })} />
          <WhenField label="Ended (optional)" value={input.end} onChange={(end) => set({ end })} optional />
        </div>
        {dosed && (
          <>
            <div className="input-row three">
              <TextField label="Dose (optional)" value={input.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. 2,000 IU" />
              <TextField label="Every (optional)" inputMode="numeric" value={input.everyN} onChange={(e) => set({ everyN: e.target.value })} placeholder="1" />
              <SelectField label="Unit" value={input.everyUnit} onChange={(e) => set({ everyUnit: e.target.value as EntryInput['everyUnit'] })}>
                <option value="day">day(s)</option>
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
              </SelectField>
            </div>
            <Checkbox checked={input.timing} onChange={(timing) => set({ timing })}>
              The timing of a blood test around a dose matters (for example injections or thyroid tablets)
            </Checkbox>
          </>
        )}
        <TextAreaField label="Notes (optional)" rows={2} value={input.notes} onChange={(e) => set({ notes: e.target.value })} />
        <p className="hint">Kept encrypted on this device. It goes to the AI only as part of a request you confirm.</p>
        {mode === 'demo' && <p className="hint">In the demo, changes last until you leave it.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {entry && (
            <button type="button" className="button ghost danger push-left" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden /> Delete
            </button>
          )}
          <Link className="button ghost" to={back}>
            Cancel
          </Link>
          <button className="button primary">
            <Save size={16} aria-hidden /> {entry ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </>
  )
}
