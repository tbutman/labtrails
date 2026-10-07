// Builds one marker's chartable series for one person: every numeric result, converted to the unit
// being shown, each with its own range converted the same way.

import { getMarker } from './catalogue/catalogue'
import type { Point } from './flags/flags'
import { sortByDate } from './flags/flags'
import type { Report, Result } from './types'
import { convert } from './units/convert'
import { normaliseUnit } from './units/normalise'

export type SeriesPoint = Point & {
  resultId: string
  reportId: string
  /** The result came from a related marker (BUN shown as urea) and was converted. */
  convertedFrom?: string
  /** The unit the lab printed, when the value was converted from it to the unit shown. */
  printedUnit?: string
}

export type Series = {
  markerId: string
  unit: string
  points: SeriesPoint[]
  /** Results that couldn't be shown in this unit, with the reason. */
  skipped: { resultId: string; reason: 'unknown-unit' | 'no-conversion' | 'not-numeric' }[]
}

/**
 * The unit to show a marker in: the user's preference if set, otherwise the unit of the most recent
 * result that has a unit the catalogue knows.
 */
export function displayUnit(markerId: string, results: Result[], reportsById: Map<string, Report>, preferred?: string): string | null {
  const marker = getMarker(markerId)
  if (!marker) return null
  if (preferred && marker.units.some((u) => u.unit === preferred)) return preferred
  const dated = results
    .filter((r) => r.markerId === markerId && r.unitAsPrinted && marker.units.some((u) => u.unit === normaliseUnit(r.unitAsPrinted!)))
    .map((r) => ({ r, date: reportsById.get(r.reportId)?.date ?? '' }))
  const latest = sortByDate(dated).at(-1)
  return latest ? normaliseUnit(latest.r.unitAsPrinted!) : marker.units[0].unit
}

export function buildSeries(markerId: string, unit: string, results: Result[], reportsById: Map<string, Report>): Series {
  const marker = getMarker(markerId)
  const related = results.filter((r) => {
    if (r.markerId === markerId) return true
    const other = r.markerId ? getMarker(r.markerId) : undefined
    return other?.sameAnalyteAs?.markerId === markerId
  })

  const points: SeriesPoint[] = []
  const skipped: Series['skipped'] = []
  for (const r of related) {
    const report = reportsById.get(r.reportId)
    if (!report) continue
    if (r.value === undefined) {
      skipped.push({ resultId: r.id, reason: 'not-numeric' })
      continue
    }
    const from = r.unitAsPrinted ?? ''
    let conv: (v: number) => number | null
    let convertedFrom: string | undefined
    if (r.markerId === markerId) {
      conv = (v) => convert(markerId, v, from, unit)
    } else {
      // A related marker (BUN for urea): convert to the shared unit within that marker, then here.
      const other = getMarker(r.markerId!)!
      const shared = other.sameAnalyteAs!.unit
      conv = (v) => {
        const inShared = convert(other, v, from, shared)
        return inShared === null ? null : convert(markerId, inShared, shared, unit)
      }
      convertedFrom = other.name
    }

    const value = conv(r.value)
    if (value === null) {
      skipped.push({ resultId: r.id, reason: marker?.noConversion ? 'no-conversion' : 'unknown-unit' })
      continue
    }
    const range = r.range ? convertRange(r.range, conv) : undefined
    const printedUnit = from && normaliseUnit(from) !== unit ? normaliseUnit(from) : undefined
    points.push({
      resultId: r.id,
      reportId: r.reportId,
      date: report.date,
      value,
      ...(r.comparator ? { comparator: r.comparator } : {}),
      ...(range ? { range } : {}),
      ...(r.flagAsPrinted ? { flagAsPrinted: r.flagAsPrinted } : {}),
      ...(convertedFrom ? { convertedFrom } : {}),
      ...(printedUnit ? { printedUnit } : {}),
    })
  }
  return { markerId, unit, points: sortByDate(points), skipped }
}

function convertRange(range: { low?: number; high?: number }, conv: (v: number) => number | null): Point['range'] | undefined {
  const low = range.low === undefined ? undefined : conv(range.low)
  const high = range.high === undefined ? undefined : conv(range.high)
  if (low === null || high === null) return undefined
  if (low === undefined && high === undefined) return undefined
  return { ...(low !== undefined ? { low } : {}), ...(high !== undefined ? { high } : {}) }
}
