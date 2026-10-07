// Puts the pieces together for one person: which markers they have, each marker's series in the unit
// shown, and its flags. Everything here is computed from stored results on demand.

import { MARKERS, PANELS, getMarker } from './catalogue/catalogue'
import type { Marker, PanelId } from './catalogue/types'
import { changeSincePrevious, critical, persistent, rangeFlag, trend, labFlagWithoutCodeFlag, type Change, type Critical, type Persistent, type RangeFlag, type Trend } from './flags/flags'
import { buildSeries, displayUnit, type Series, type SeriesPoint } from './series'
import type { Report, Result } from './types'

export type MarkerAnalysis = {
  marker: Marker
  series: Series
  latest: SeriesPoint | undefined
  latestFlag: RangeFlag | null
  /** The latest result was marked critical by the lab, or is far outside the lab's range. */
  latestCritical: Critical | null
  labOnlyFlag: 'above' | 'below' | null
  change: Change | null
  trend: Trend | null
  persistent: Persistent | null
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
    latestCritical: latest ? critical(latest) : null,
    labOnlyFlag: latest ? labFlagWithoutCodeFlag(latest) : null,
    change: changeSincePrevious(series.points),
    trend: trend(series.points),
    persistent: persistent(series.points),
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

export type NotRepeated = { markerId: string; name: string; panel: string; lastDate: string }

/** How far back "not repeated since" looks, in months before the newest report. */
export const NOT_REPEATED_MONTHS = 24

/**
 * Markers measured in the NOT_REPEATED_MONTHS before the newest report but missing from it ("HbA1c,
 * last 18 Sep 2025"). Markers that chart together (BUN and urea) count as one. Only blood results.
 */
export function notRepeated(results: Result[], reports: Report[]): NotRepeated[] {
  const newest = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!newest) return []
  const [y, m, d] = newest.date.split('-').map(Number)
  const from = new Date(Date.UTC(y, m - 1 - NOT_REPEATED_MONTHS, d)).toISOString().slice(0, 10)
  const dates = new Map(reports.map((r) => [r.id, r.date]))
  const key = (id: string) => getMarker(id)?.sameAnalyteAs?.markerId ?? id
  const blood = results.filter((r) => r.markerId && !r.specimen)
  const inNewest = new Set(blood.filter((r) => dates.get(r.reportId) === newest.date).map((r) => key(r.markerId!)))
  const last = new Map<string, string>()
  for (const r of blood) {
    const date = dates.get(r.reportId)
    if (!date || date >= newest.date || date < from || inNewest.has(key(r.markerId!))) continue
    const k = key(r.markerId!)
    if (!last.has(k) || date > last.get(k)!) last.set(k, date)
  }
  const panelName = (id: string) => PANELS.find((p) => p.id === getMarker(id)?.panel)?.name ?? ''
  return MARKERS.filter((mk) => last.has(mk.id)).map((mk) => ({ markerId: mk.id, name: mk.name, panel: panelName(mk.id), lastDate: last.get(mk.id)! }))
}

/** Results that aren't mapped to the catalogue, kept as printed so the user can map them later. */
export function unmapped(results: Result[]): Result[] {
  return results.filter((r) => !r.markerId)
}
