// The facts an AI summary is grounded in (SPEC.md section 11). The code builds them from stored results
// and computed flags; the AI only explains them. The person's name and date of birth are never
// included: they're "the person", with an age in years and sex if set, because some ranges depend on
// them.

import { analyse, type MarkerAnalysis } from '../analysis'
import { rangeFlag, type Point } from '../flags/flags'
import type { Profile, Report, Result, TestContext } from '../types'

export type FactPoint = { date: string; value: number; comparator?: string; range?: { low?: number; high?: number } }

export type MarkerFacts = {
  marker: string
  panel: string
  unit: string
  latest: FactPoint & { outsideRange?: 'above' | 'below' }
  previous?: FactPoint & { outsideRange?: 'above' | 'below' }
  changedNotably?: { direction: 'up' | 'down' | 'same'; percent: number | null; crossedRange: boolean }
  trend?: { direction: 'rising' | 'falling'; results: number }
  history: FactPoint[]
  convertedFrom?: string
}

export type ContextFacts = { fasting?: string; medications?: string; recently?: string[]; notes?: string }

export type SummaryFacts = {
  person: { ageYears?: number; sex?: 'female' | 'male' }
  report?: { date: string; lab?: string; context?: ContextFacts }
  markers: MarkerFacts[]
  flagsAppeared: string[]
  flagsCleared: string[]
  rules: string
}

const RULES =
  'Flags were computed by code: "outsideRange" compares a result with the range printed by its own lab; "changedNotably" means a change of at least 25% of the range width (or of the previous value without a two-sided range), or moving into or out of the range; "trend" means 3 or more results moving the same way by at least 10% of the range width. These are simple heuristics, not clinical thresholds.'

function point(p: Point): FactPoint {
  return { date: p.date, value: round(p.value), ...(p.comparator ? { comparator: p.comparator } : {}), ...(p.range ? { range: roundRange(p.range) } : {}) }
}

const round = (v: number) => Number(v.toPrecision(4))
const roundRange = (r: { low?: number; high?: number }) => ({ ...(r.low !== undefined ? { low: round(r.low) } : {}), ...(r.high !== undefined ? { high: round(r.high) } : {}) })

function withFlag(p: Point) {
  const f = rangeFlag(p)
  return { ...point(p), ...(f?.basis === 'range' ? { outsideRange: f.side } : {}) }
}

export function ageInYears(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

/** Replaces the person's name (and its parts) in free text with "the person". */
export function redactName(text: string, name: string): string {
  const parts = [name, ...name.split(/\s+/)].map((p) => p.trim()).filter((p) => p.length >= 2)
  let out = text
  for (const part of [...new Set(parts)].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), 'the person')
  }
  return out
}

function contextFacts(c: TestContext | undefined, name: string): ContextFacts | undefined {
  if (!c) return undefined
  const out: ContextFacts = {
    ...(c.fasting ? { fasting: c.fasting } : {}),
    ...(c.medications ? { medications: redactName(c.medications, name) } : {}),
    ...(c.recently?.length ? { recently: c.recently } : {}),
    ...(c.notes ? { notes: redactName(c.notes, name) } : {}),
  }
  return Object.keys(out).length ? out : undefined
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
    history: pts.slice(-historyLength).map(point),
    ...(converted ? { convertedFrom: converted } : {}),
  }
}

function person(profile: Profile, on: string): SummaryFacts['person'] {
  return { ...(profile.dateOfBirth ? { ageYears: ageInYears(profile.dateOfBirth, on) } : {}), ...(profile.sex ? { sex: profile.sex } : {}) }
}

/** Facts for the "after a new report" summary: every marker in that report, against its history. */
export function afterReportFacts(profile: Profile, reports: Report[], results: Result[], reportId: string, preferredUnits: Record<string, string> = {}): SummaryFacts {
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
      if (f) markers.push(f)
    }
  }
  const appeared = markers.filter((m) => m.latest.outsideRange && !m.previous?.outsideRange).map((m) => m.marker)
  const cleared = markers.filter((m) => !m.latest.outsideRange && m.previous?.outsideRange).map((m) => m.marker)
  const context = contextFacts(report.context, profile.name)
  return {
    person: person(profile, report.date),
    report: { date: report.date, ...(report.lab ? { lab: redactName(report.lab, profile.name) } : {}), ...(context ? { context } : {}) },
    markers,
    flagsAppeared: appeared,
    flagsCleared: cleared,
    rules: RULES,
  }
}

/** Facts for the overall summary: every marker's recent history and flags. */
export function overallFacts(profile: Profile, reports: Report[], results: Result[], preferredUnits: Record<string, string> = {}): SummaryFacts {
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const markers = analyse(results, reports, preferredUnits).flatMap((panel) => panel.markers.map((a) => markerFacts(a, panel.name, 6)).filter((m): m is MarkerFacts => m !== null))
  return {
    person: person(profile, latest?.date ?? new Date().toISOString().slice(0, 10)),
    markers,
    flagsAppeared: [],
    flagsCleared: [],
    rules: RULES,
  }
}
