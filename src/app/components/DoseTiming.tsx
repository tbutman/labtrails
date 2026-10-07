// When the blood was drawn relative to a dose, for each timeline entry active on the test date whose
// timing matters (SPEC.md section 18.1). Asked on manual entry and when editing a report's details.

import { Segmented, TextField } from '../../core/ui/components'
import { describeTiming, everyLabel, type TimelineEntry } from '../../labs/timeline'
import type { DoseTiming } from '../../labs/types'

type When = DoseTiming['when'] | 'unknown'

export function DoseTimingFields({ entries, date, value, onChange }: { entries: TimelineEntry[]; date: string; value: DoseTiming[]; onChange: (v: DoseTiming[]) => void }) {
  if (!entries.length) return null
  const set = (entry: TimelineEntry, patch: { when?: When; lastDose?: string }) => {
    const rest = value.filter((t) => t.entryId !== entry.id)
    const current = value.find((t) => t.entryId === entry.id)
    const when: When | undefined = patch.when ?? current?.when
    if (!when || when === 'unknown') return onChange(rest)
    const every = everyLabel(entry.every)
    const next: DoseTiming = {
      entryId: entry.id,
      name: [entry.name, entry.dose].filter(Boolean).join(' '),
      when,
      ...(every ? { every } : {}),
      ...(when === 'between' && (patch.lastDose ?? current?.lastDose) ? { lastDose: patch.lastDose ?? current?.lastDose } : {}),
    }
    onChange([...rest, next])
  }
  return (
    <>
      {entries.map((entry) => {
        const t = value.find((x) => x.entryId === entry.id)
        const label = [entry.name, entry.dose].filter(Boolean).join(' ')
        return (
          <div key={entry.id} className="dose-timing">
            <Segmented<When>
              legend={`When was the blood drawn, relative to ${label}?`}
              name={`timing-${entry.id}`}
              value={t?.when ?? 'unknown'}
              onChange={(when) => set(entry, { when })}
              options={[
                { value: 'before-dose', label: "Before that day's dose" },
                { value: 'after-dose', label: "After that day's dose" },
                { value: 'between', label: 'Between doses' },
                { value: 'unknown', label: 'Not sure' },
              ]}
              hint="From your timeline, where you said the timing of a test matters. It never changes a flag."
            />
            {t?.when === 'between' && (
              <TextField label="Last dose before the test (optional)" type="date" value={t.lastDose ?? ''} max={date || undefined} onChange={(e) => set(entry, { lastDose: e.target.value || undefined })} />
            )}
            {t && date && <p className="hint">Shown as: {describeTiming(t, date)}.</p>}
          </div>
        )
      })}
    </>
  )
}
