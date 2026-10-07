// The facts an AI summary is grounded in (SPEC.md section 11). The code builds them from stored results
// and computed flags; the AI only explains them. The person's name and date of birth are never
// included: they're "the person", with an age in years and sex if set, because some ranges depend on
// them.

import { analyse, notRepeated, type MarkerAnalysis } from '../analysis'
import { critical, rangeFlag, type Point } from '../flags/flags'
import { INFLUENCE_NAMES, effectWords, matchInfluences } from '../influences'
import { lineFlag, lineIn, type PersonalLine } from '../lines'
import { ageInYears } from '../person'
import { activeBetween, describeTiming, everyLabel, sortByStart, type TimelineEntry } from '../timeline'
import type { Profile, Report, Result, TestContext } from '../types'

export type FactPoint = { date: string; value: number; comparator?: string; range?: { low?: number; high?: number } }

export type MarkerFacts = {
  marker: string
  panel: string
  unit: string
  latest: FactPoint & { outsideRange?: 'above' | 'below'; farOutside?: true }
  previous?: FactPoint & { outsideRange?: 'above' | 'below'; farOutside?: true }
  changedNotably?: { direction: 'up' | 'down' | 'same'; percent: number | null; crossedRange: boolean }
  trend?: { direction: 'rising' | 'falling'; results: number }
  /** Outside the lab's range on this many tests in a row, ending with the latest. */
  persistent?: { side: 'above' | 'below'; results: number }
  /** Documented influences on this marker that the timeline or a test's notes include. */
  knownInfluences?: InfluenceFact[]
  /** A line the person or their doctor set for this marker, in its unit, and whether the latest result is beyond it. */
  personalLine?: PersonalLineFact
  history: FactPoint[]
  convertedFrom?: string
}

export type ContextFacts = { fasting?: string; medications?: string; recently?: string[]; notes?: string; doseTiming?: string[] }

/** A timeline entry as the AI sees it (SPEC.md 18.7). */
export type TimelineFact = { kind: string; name: string; start: string; end?: string; dose?: string; every?: string }

export type PersonalLineFact = { label: string; low?: number; high?: number; latestBeyond?: 'above' | 'below' }

/** The person's own line for a marker, as the AI sees it. */
export function personalLineFact(a: MarkerAnalysis, lines: PersonalLine[], name: string): PersonalLineFact | undefined {
  const line = lines.find((l) => l.markerId === a.marker.id)
  const shown = line ? lineIn(line, a.series.unit) : null
  if (!shown) return undefined
  const beyond = a.latest ? lineFlag(a.latest, shown) : null
  const round = (v: number) => Number(v.toPrecision(4))
  return { label: redactName(shown.label, name), ...(shown.low !== undefined ? { low: round(shown.low) } : {}), ...(shown.high !== undefined ? { high: round(shown.high) } : {}), ...(beyond ? { latestBeyond: beyond } : {}) }
}

/** A documented influence on a marker that LabTrails matched to the timeline or a test's notes. */
export type InfluenceFact = { influence: string; effect: string; matchedBy: string; source: string }

export type SummaryFacts = {
  person: { ageYears?: number; sex?: 'female' | 'male' }
  report?: { date: string; lab?: string; context?: ContextFacts }
  markers: MarkerFacts[]
  flagsAppeared: string[]
  flagsCleared: string[]
  /** Markers measured in the two years before the latest report but missing from it. */
  notInLatestReport: { marker: string; lastDate: string }[]
  /** The person's timeline during these results, when there is one. */
  timeline?: TimelineFact[]
  rules: string
}

const RULES =
  'Flags were computed by code: "outsideRange" compares a result with the range printed by its own lab; "changedNotably" means a change of at least 25% of the range width (of its one limit for a one-sided range, or of the previous value without a range), or moving into or out of the range; "trend" means 3 or more results moving the same way by at least 10% of the range width; "persistent" means outside the lab\'s range on that many tests in a row (3 or more); "farOutside" means the lab marked the result critical (for example HH, LL or "critical") or it is at least one range width outside the lab\'s range. "notInLatestReport" lists markers measured before but not in the latest report. These are simple heuristics, not clinical thresholds. "timeline" is the person\'s own record of medications, supplements, lifestyle changes and events, with dates and doses; "doseTiming" says when a test was drawn relative to a dose; "knownInfluences" are documented influences on a marker from health information sites that LabTrails matched to the timeline or a test\'s notes. None of these is a cause of a result. "personalLine" is a value the person or their doctor chose for a marker, not a lab or clinical range.'

function point(p: Point): FactPoint {
  return { date: p.date, value: round(p.value), ...(p.comparator ? { comparator: p.comparator } : {}), ...(p.range ? { range: roundRange(p.range) } : {}) }
}

const round = (v: number) => Number(v.toPrecision(4))
const roundRange = (r: { low?: number; high?: number }) => ({ ...(r.low !== undefined ? { low: round(r.low) } : {}), ...(r.high !== undefined ? { high: round(r.high) } : {}) })

function withFlag(p: Point) {
  const f = rangeFlag(p)
  return { ...point(p), ...(f?.basis === 'range' ? { outsideRange: f.side } : {}), ...(critical(p) ? { farOutside: true as const } : {}) }
}

export { ageInYears } from '../person'

/** Replaces the person's name (and its parts) in free text with "the person". */
export function redactName(text: string, name: string): string {
  const parts = [name, ...name.split(/\s+/)].map((p) => p.trim()).filter((p) => p.length >= 2)
  let out = text
  for (const part of [...new Set(parts)].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), 'the person')
  }
  return out
}

function contextFacts(c: TestContext | undefined, name: string, date?: string): ContextFacts | undefined {
  if (!c) return undefined
  const out: ContextFacts = {
    ...(c.fasting ? { fasting: c.fasting } : {}),
    ...(c.medications ? { medications: redactName(c.medications, name) } : {}),
    ...(c.recently?.length ? { recently: c.recently } : {}),
    ...(c.notes ? { notes: redactName(c.notes, name) } : {}),
    ...(c.doseTiming?.length && date ? { doseTiming: c.doseTiming.map((t) => `drawn ${describeTiming({ ...t, name: redactName(t.name, name) }, date)}`) } : {}),
  }
  return Object.keys(out).length ? out : undefined
}

/** Timeline entries active between two dates, oldest first, with the person's name removed. */
export function timelineFacts(timeline: TimelineEntry[], from: string, to: string, name: string): TimelineFact[] {
  return sortByStart(activeBetween(timeline, from, to)).map((e) => ({
    kind: e.kind,
    name: redactName(e.name, name),
    start: e.start,
    ...(e.end ? { end: e.end } : {}),
    ...(e.dose ? { dose: redactName(e.dose, name) } : {}),
    ...(e.every ? { every: everyLabel(e.every)! } : {}),
  }))
}

/** Matched known influences on a marker, over all its tests, each named once. */
export function influenceFacts(markerId: string, tests: Report[], timeline: TimelineEntry[], name: string): InfluenceFact[] {
  const seen = new Set<string>()
  const out: InfluenceFact[] = []
  for (const t of tests) {
    for (const m of matchInfluences(markerId, timeline, t)) {
      const matchedBy = m.from.kind === 'timeline' ? `timeline: ${redactName(m.from.entry.name, name)}` : `notes on the ${m.from.date} test`
      const key = `${m.influence.influence}|${matchedBy}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ influence: INFLUENCE_NAMES[m.influence.influence], effect: effectWords(m.influence.effect), matchedBy, source: m.influence.source.title })
    }
  }
  return out
}

function markerFacts(a: MarkerAnalysis, panel: string, historyLength: number): MarkerFacts | null {
  const pts = a.series.points
  const latest = pts.at(-1)
  if (!latest) return null
  const previous = pts.at(-2)
  const converted = pts.find((p) => p.convertedFrom)?.convertedFrom
  return {
    marker: a.marker.name,
    panel,
    unit: a.series.unit,
    latest: withFlag(latest),
    ...(previous ? { previous: withFlag(previous) } : {}),
    ...(a.change?.notable
      ? { changedNotably: { direction: a.change.direction, percent: a.change.relative === null ? null : Math.round(a.change.relative * 100), crossedRange: a.change.crossedRange } }
      : {}),
    ...(a.trend ? { trend: { direction: a.trend.direction, results: a.trend.results } } : {}),
    ...(a.persistent ? { persistent: { side: a.persistent.side, results: a.persistent.results } } : {}),
    history: pts.slice(-historyLength).map(point),
    ...(converted ? { convertedFrom: converted } : {}),
  }
}

function person(profile: Profile, on: string): SummaryFacts['person'] {
  return { ...(profile.dateOfBirth ? { ageYears: ageInYears(profile.dateOfBirth, on) } : {}), ...(profile.sex ? { sex: profile.sex } : {}) }
}

/** The reports a marker's chart points come from. */
const testsOf = (a: MarkerAnalysis, reports: Report[]) => {
  const ids = new Set(a.series.points.map((p) => p.reportId))
  return reports.filter((r) => ids.has(r.id))
}

const missing = (results: Result[], reports: Report[]) => notRepeated(results, reports).map((m) => ({ marker: m.name, lastDate: m.lastDate }))

/** Facts for the "after a new report" summary: every marker in that report, against its history. */
export function afterReportFacts(profile: Profile, reports: Report[], results: Result[], reportId: string, preferredUnits: Record<string, string> = {}, timeline: TimelineEntry[] = [], lines: PersonalLine[] = []): SummaryFacts {
  const report = reports.find((r) => r.id === reportId)
  if (!report) throw new Error('No such report')
  // Only results up to and including this report, so a later report can't leak into an older summary.
  const upTo = new Set(reports.filter((r) => r.date <= report.date).map((r) => r.id))
  const scoped = results.filter((r) => upTo.has(r.reportId))
  const inReport = new Set(results.filter((r) => r.reportId === reportId).map((r) => r.markerId))
  const markers: MarkerFacts[] = []
  for (const panel of analyse(scoped, reports.filter((r) => upTo.has(r.id)), preferredUnits)) {
    for (const a of panel.markers) {
      const shown = inReport.has(a.marker.id) || a.series.points.some((p) => p.reportId === reportId)
      if (!shown) continue
      const f = markerFacts(a, panel.name, 4)
      const influences = influenceFacts(a.marker.id, testsOf(a, reports), timeline, profile.name)
      const line = personalLineFact(a, lines, profile.name)
      if (f) markers.push({ ...f, ...(influences.length ? { knownInfluences: influences } : {}), ...(line ? { personalLine: line } : {}) })
    }
  }
  const appeared = markers.filter((m) => m.latest.outsideRange && !m.previous?.outsideRange).map((m) => m.marker)
  const cleared = markers.filter((m) => !m.latest.outsideRange && m.previous?.outsideRange).map((m) => m.marker)
  const context = contextFacts(report.context, profile.name, report.date)
  const first = markers.flatMap((m) => m.history.map((p) => p.date)).sort()[0] ?? report.date
  const during = timelineFacts(timeline, first, report.date, profile.name)
  return {
    person: person(profile, report.date),
    report: { date: report.date, ...(report.lab ? { lab: redactName(report.lab, profile.name) } : {}), ...(context ? { context } : {}) },
    markers,
    flagsAppeared: appeared,
    flagsCleared: cleared,
    notInLatestReport: missing(scoped, reports.filter((r) => upTo.has(r.id))),
    ...(during.length ? { timeline: during } : {}),
    rules: RULES,
  }
}

/** Facts for the overall summary: every marker's recent history and flags. */
export function overallFacts(profile: Profile, reports: Report[], results: Result[], preferredUnits: Record<string, string> = {}, timeline: TimelineEntry[] = [], lines: PersonalLine[] = []): SummaryFacts {
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.at(-1)
  const markers = analyse(results, reports, preferredUnits).flatMap((panel) =>
    panel.markers
      .map((a) => {
        const f = markerFacts(a, panel.name, 6)
        const influences = influenceFacts(a.marker.id, testsOf(a, reports), timeline, profile.name)
        const line = personalLineFact(a, lines, profile.name)
        return f ? { ...f, ...(influences.length ? { knownInfluences: influences } : {}), ...(line ? { personalLine: line } : {}) } : f
      })
      .filter((m): m is MarkerFacts => m !== null),
  )
  const during = sorted[0] && latest ? timelineFacts(timeline, sorted[0].date, latest.date, profile.name) : []
  return {
    person: person(profile, latest?.date ?? new Date().toISOString().slice(0, 10)),
    markers,
    flagsAppeared: [],
    flagsCleared: [],
    notInLatestReport: missing(results, reports),
    ...(during.length ? { timeline: during } : {}),
    rules: RULES,
  }
}
