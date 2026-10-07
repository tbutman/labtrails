import type { MarkerAnalysis } from '../labs/analysis'
import { lineFlag, lineIn, type PersonalLine } from '../labs/lines'

/** The marker's personal line, in the unit it's shown in. */
export function shownLine(a: MarkerAnalysis, lines: PersonalLine[]) {
  const line = lines.find((l) => l.markerId === a.marker.id)
  return line ? lineIn(line, a.series.unit) : null
}

/** Whether the latest result is beyond the user's line, for the flag chips. */
export function personalFlag(a: MarkerAnalysis, lines: PersonalLine[]): { side: 'above' | 'below'; label: string } | null {
  const line = shownLine(a, lines)
  const side = a.latest ? lineFlag(a.latest, line) : null
  return side && line ? { side, label: line.label } : null
}
