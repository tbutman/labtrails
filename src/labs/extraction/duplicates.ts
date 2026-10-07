// Content-level duplicates for lab reports: rows that are already saved, and a whole report that
// repeats one already in the vault under a different file (a PDF and a photo of it, say). The file
// itself is compared by fingerprint elsewhere; this compares what's printed.

import type { Report, Result } from '../types'
import { normaliseUnit } from '../units/normalise'
import { parseValue, type DecimalHint } from '../units/parse'
import { readPrintedDate } from './dates'
import { guessDecimal, type ProposedResultRow } from './proposals'

export type SimilarReport = { report: Report; matched: number; compared: number }

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-6

function rowKey(row: ProposedResultRow, decimal: DecimalHint) {
  const v = parseValue(row.values.value, decimal)
  return { value: v.kind === 'number' ? v.value : undefined, comparator: v.kind === 'number' ? v.comparator : undefined, unit: row.values.unit ? normaliseUnit(row.values.unit) : '' }
}

const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase()

function sameResult(row: ProposedResultRow, r: Result, decimal: DecimalHint): boolean {
  const k = rowKey(row, decimal)
  // Text results ("Negative" on a urinalysis) match by name, sample type and the exact text.
  if (k.value === undefined || r.value === undefined) {
    return k.value === undefined && r.value === undefined && !!r.textValue && lower(r.textValue) === lower(row.values.value) && lower(r.nameAsPrinted) === lower(row.values.name) && (r.specimen ?? 'blood') === (row.values.specimen ?? 'blood')
  }
  const sameMarker = row.values.marker ? r.markerId === row.values.marker : r.nameAsPrinted.trim().toLowerCase() === row.values.name.trim().toLowerCase()
  const sameUnit = (r.unitAsPrinted ? normaliseUnit(r.unitAsPrinted) : '') === k.unit
  return sameMarker && sameUnit && near(r.value, k.value) && (r.comparator ?? undefined) === k.comparator
}

/** The dates a printed sample date could mean (both readings when it's ambiguous). */
export function candidateDates(rows: ProposedResultRow[]): string[] {
  return [...new Set(rows.flatMap((r) => readPrintedDate(r.values.date).candidates))]
}

/** Rows whose marker, value and unit are already saved for a report on the same date. */
export function alreadySavedRows(rows: ProposedResultRow[], reports: Report[], results: Result[]): ProposedResultRow[] {
  const decimal = guessDecimal(rows.flatMap((r) => [r.values.value, r.values.range]))
  return rows.filter((row) => {
    const dates = readPrintedDate(row.values.date).candidates
    const reportIds = new Set(reports.filter((rep) => dates.includes(rep.date)).map((rep) => rep.id))
    return results.some((r) => reportIds.has(r.reportId) && sameResult(row, r, decimal))
  })
}

/**
 * An existing report on the same date whose saved values match most of what was read. Needs at least
 * three matching values and 60% of the comparable rows, so two reports on the same day from different
 * labs don't trigger it.
 */
export function similarReport(rows: ProposedResultRow[], reports: Report[], results: Result[]): SimilarReport | null {
  const decimal = guessDecimal(rows.flatMap((r) => [r.values.value, r.values.range]))
  const dates = candidateDates(rows)
  const comparable = rows.filter((r) => rowKey(r, decimal).value !== undefined)
  let best: SimilarReport | null = null
  for (const report of reports.filter((rep) => dates.includes(rep.date))) {
    const saved = results.filter((r) => r.reportId === report.id)
    const matched = comparable.filter((row) => saved.some((r) => sameResult(row, r, decimal))).length
    if (matched >= 3 && matched / Math.max(comparable.length, 1) >= 0.6 && (!best || matched > best.matched)) best = { report, matched, compared: comparable.length }
  }
  return best
}

/** "sim", "yes", "em jejum" → yes; "não", "no" → no; anything else → not known. */
export function parseFasting(printed: string | null | undefined): 'yes' | 'no' | undefined {
  if (!printed) return undefined
  const t = printed
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  if (/\b(nao|no|not fasting|sem jejum|non)\b/.test(t)) return 'no'
  if (/\b(sim|yes|em jejum|jejum|fasting|fasted)\b/.test(t)) return 'yes'
  return undefined
}
