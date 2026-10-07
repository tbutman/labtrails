import type { Column } from '../core/review/model'
import { MARKERS } from '../labs/catalogue/catalogue'

// The review screen's columns for results read from a report. Values stay text as printed (they may be
// "<0,5" or "Negativo"); the code parses them when saving.
export const EXTRACTION_COLUMNS: Column[] = [
  { key: 'date', label: 'Sample date', type: 'date', required: true, validate: (v) => (v > new Date().toISOString().slice(0, 10) ? 'In the future.' : undefined) },
  { key: 'name', label: 'Name as printed', type: 'text', required: true },
  { key: 'value', label: 'Value', type: 'text', required: true },
  { key: 'unit', label: 'Unit', type: 'text' },
  { key: 'range', label: 'Range as printed', type: 'text' },
  { key: 'flag', label: 'Flag', type: 'text' },
  {
    key: 'marker',
    label: 'Marker',
    type: 'choice',
    options: [{ value: '', label: 'Not in LabTrails’ list of markers (keep as printed)' }, ...MARKERS.map((m) => ({ value: m.id, label: m.name }))],
  },
  {
    // Urinalysis rows share names with blood tests ("Glicose", "Leucócitos"); they're kept as printed.
    key: 'specimen',
    label: 'Sample',
    type: 'choice',
    required: true,
    options: [
      { value: 'blood', label: 'Blood' },
      { value: 'urine', label: 'Urine' },
      { value: 'other', label: 'Other' },
    ],
    validate: (v, row) => (v !== 'blood' && row.marker ? 'Only blood results go on a marker’s chart; choose “Not in LabTrails’ list of markers” for this row.' : undefined),
  },
]
