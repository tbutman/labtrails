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
    options: [{ value: '', label: 'Not in the catalogue (keep as printed)' }, ...MARKERS.map((m) => ({ value: m.id, label: m.name }))],
  },
]
