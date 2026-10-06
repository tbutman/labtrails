// Puts the pieces together for one person: which markers they have, each marker's series in the unit
// shown, and its flags. Everything here is computed from stored results on demand.

import { MARKERS, PANELS, getMarker } from './catalogue/catalogue'
import type { Marker, PanelId } from './catalogue/types'
import { changeSincePrevious, rangeFlag, trend, labFlagWithoutCodeFlag, type Change, type RangeFlag, type Trend } from './flags/flags'
import { buildSeries, displayUnit, type Series, type SeriesPoint } from './series'
import type { Report, Result } from './types'

export type MarkerAnalysis = {
  marker: Marker
  series: Series
  latest: SeriesPoint | undefined
  latestFlag: RangeFlag | null
  labOnlyFlag: 'above' | 'below' | null
  change: Change | null
  trend: Trend | null
}

export type PanelAnalysis = { id: PanelId; name: string; markers: MarkerAnalysis[] }

export function analyseMarker(markerId: string, results: Result[], reportsById: Map<string, Report>, preferredUnit?: string): MarkerAnalysis | null {
  const marker = getMarker(markerId)
  if (!marker) return null
  const unit = displayUnit(markerId, results, reportsById, preferredUnit)
  if (!unit) return null
  const series = buildSeries(markerId, unit, results, reportsById)
  const latest = series.points.at(-1)
  return {
    marker,
    series,
    latest,
    latestFlag: latest ? rangeFlag(latest) : null,
    labOnlyFlag: latest ? labFlagWithoutCodeFlag(latest) : null,
    change: changeSincePrevious(series.points),
    trend: trend(series.points),
  }
}

/** Every panel with at least one result, in catalogue order. BUN folds into urea's chart. */
export function analyse(results: Result[], reports: Report[], preferredUnits: Record<string, string> = {}): PanelAnalysis[] {
  const reportsById = new Map(reports.map((r) => [r.id, r]))
  const present = new Set(results.map((r) => r.markerId).filter((id): id is string => !!id))
  // A marker that charts with another (BUN with urea) gets its own entry only if the other is absent.
  for (const id of [...present]) {
    const other = getMarker(id)?.sameAnalyteAs?.markerId
    if (other && present.has(other)) present.delete(id)
  }
  return PANELS.map((panel) => ({
    id: panel.id,
    name: panel.name,
    markers: MARKERS.filter((m) => m.panel === panel.id && present.has(m.id))
      .map((m) => analyseMarker(m.id, results, reportsById, preferredUnits[m.id]))
      .filter((a): a is MarkerAnalysis => a !== null && a.series.points.length > 0),
  })).filter((p) => p.markers.length > 0)
}

/** Results that aren't mapped to the catalogue, kept as printed so the user can map them later. */
export function unmapped(results: Result[]): Result[] {
  return results.filter((r) => !r.markerId)
}
