import { Segmented, TextField } from '../../core/ui/components'
import type { LabMeta } from './labAdapter'

/** The report-level facts shown above the rows while checking an import. */
export function LabMetaEditor({ meta, onChange }: { meta: LabMeta; onChange: (m: LabMeta) => void }) {
  return (
    <div className="input-row">
      <TextField label="Lab" value={meta.lab} onChange={(e) => onChange({ ...meta, lab: e.target.value })} hint="As printed on the report; you can change it." />
      <Segmented
        legend="Fasting?"
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
  )
}
