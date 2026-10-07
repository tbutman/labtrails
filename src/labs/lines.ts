// Personal lines (SPEC.md section 18.5): a lower and/or upper value the user or their doctor sets for
// a marker ("Doctor's target: under 54"). Drawn on the chart in a different style from the lab's range
// and flagged as "Above your line": clearly the user's, never suggested by the app.

import type { Point } from './flags/flags'
import { convert } from './units/convert'

export type PersonalLine = {
  id: string
  profileId: string
  markerId: string
  /** "Doctor's target", "My limit". */
  label: string
  low?: number
  high?: number
  /** The unit the values were entered in; shown in other units by conversion. */
  unit: string
  createdAt: string
  updatedAt: string
}

export type LineBounds = { low?: number; high?: number; label: string }

/** The line in another unit, or null when the units can't be converted. */
export function lineIn(line: PersonalLine, unit: string): LineBounds | null {
  const to = (v: number | undefined) => (v === undefined ? undefined : line.unit === unit ? v : convert(line.markerId, v, line.unit, unit))
  const low = to(line.low)
  const high = to(line.high)
  if (low === null || high === null) return null
  return { ...(low !== undefined ? { low } : {}), ...(high !== undefined ? { high } : {}), label: line.label }
}

/** Whether a result is beyond the user's line. A result like "<0.5" counts only when every value it could be is beyond it. */
export function lineFlag(p: Pick<Point, 'value' | 'comparator'>, line: LineBounds | null): 'above' | 'below' | null {
  if (!line) return null
  const { low, high } = line
  switch (p.comparator) {
    case '<':
      return low !== undefined && p.value <= low ? 'below' : null
    case '≤':
      return low !== undefined && p.value < low ? 'below' : null
    case '>':
      return high !== undefined && p.value >= high ? 'above' : null
    case '≥':
      return high !== undefined && p.value > high ? 'above' : null
    default:
      if (high !== undefined && p.value > high) return 'above'
      if (low !== undefined && p.value < low) return 'below'
      return null
  }
}

/** "under 54", "at least 30", "between 30 and 54". */
export function lineText(line: Pick<LineBounds, 'low' | 'high'>, format: (n: number) => string = String): string {
  if (line.low !== undefined && line.high !== undefined) return `between ${format(line.low)} and ${format(line.high)}`
  if (line.high !== undefined) return `under ${format(line.high)}`
  return `at least ${format(line.low!)}`
}

export function validateLine(input: { label: string; low: string; high: string }): string | null {
  const low = input.low.trim() ? Number(input.low.replace(',', '.')) : undefined
  const high = input.high.trim() ? Number(input.high.replace(',', '.')) : undefined
  if (low === undefined && high === undefined) return 'Enter a lower or an upper value, or both.'
  if ((low !== undefined && !Number.isFinite(low)) || (high !== undefined && !Number.isFinite(high))) return 'Enter numbers, like 54 or 5.5.'
  if (low !== undefined && high !== undefined && low >= high) return 'The lower value should be below the upper one.'
  return null
}
