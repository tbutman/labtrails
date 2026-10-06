import { CalendarRange } from 'lucide-react'
import { Callout, Segmented, TextField } from '../../core/ui/components'
import type { LabMeta } from './labAdapter'

/** The report-level facts shown above the rows while checking an import. */
export function LabMetaEditor({ meta, onChange }: { meta: LabMeta; onChange: (m: LabMeta) => void }) {
  const cumulative = (meta.dates ?? 1) > 1
  return (
    <>
      {cumulative && (
        <Callout icon={CalendarRange}>
          <strong>Results from {meta.dates} sample dates.</strong> This report shows earlier results too. Each date becomes its own
          report, with the date shown on every row; check them below. The lab applies to all of them, and fasting only to the newest.
        </Callout>
      )}
      <div className="input-row">
        <TextField label="Lab" value={meta.lab} onChange={(e) => onChange({ ...meta, lab: e.target.value })} hint="As printed on the report; you can change it." />
        <Segmented
          legend={cumulative ? 'Fasting? (newest date)' : 'Fasting?'}
          name="import-fasting"
          value={meta.fasting}
          onChange={(fasting) => onChange({ ...meta, fasting })}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: "Don't know" },
          ]}
        />
      </div>
    </>
  )
}
