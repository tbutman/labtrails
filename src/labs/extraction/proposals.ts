// Between the AI and the review screen (SPEC.md section 10). The AI only copied text; here the code
// matches each name to the catalogue (its own matching first, the AI's suggestion only as a fallback,
// marked for checking), and after review turns confirmed rows into reports and results.

import { MARKERS } from '../catalogue/catalogue'
import { matchMarker, type UserAlias } from '../match/match'
import type { Report, Result } from '../types'
import { normaliseUnit } from '../units/normalise'
import { parseRange, parseValue, type DecimalHint } from '../units/parse'
import type { Confidence, Extraction } from './schema'

export type ProposedResultRow = {
  values: { date: string; name: string; value: string; unit: string; range: string; flag: string; marker: string }
  confidence: Confidence
  sourceText: string
  page: number
}

/** The sample dates printed on a report, once each: more than one means a cumulative report. */
export function printedDates(extraction: Extraction): string[] {
  const own = extraction.sampleDate?.printed ?? ''
  return [...new Set(extraction.rows.map((r) => r.samplePrinted ?? own).filter(Boolean))]
}

/** The text that goes with the document: the catalogue the AI may choose IDs from. */
export function extractionPrompt(): string {
  const catalogue = MARKERS.map((m) => `${m.id}: ${m.name}`).join('\n')
  return `Copy every result from this lab report into the JSON format. Catalogue for suggestedMarkerId (id: name):\n${catalogue}`
}

const lower = (a: Confidence, b: Confidence): Confidence => (a === 'low' || b === 'low' ? 'low' : a === 'medium' || b === 'medium' ? 'medium' : 'high')

export function toProposedRows(extraction: Extraction, aliases: UserAlias[] = []): ProposedResultRow[] {
  const reportDate = extraction.sampleDate?.printed ?? ''
  return extraction.rows.map((row) => {
    // On a cumulative report each row has its own date; saving makes one report per date.
    const date = row.samplePrinted ?? reportDate
    const unit = row.unitPrinted ?? ''
    const match = matchMarker(row.nameAsPrinted, unit ? normaliseUnit(unit) : undefined, aliases)
    let marker = ''
    let confidence = row.confidence
    if (match.status === 'matched') {
      marker = match.markerId
    } else if (row.suggestedMarkerId !== 'unknown') {
      // The AI's guess: used only when the code found nothing, and always flagged for checking.
      marker = row.suggestedMarkerId
      confidence = 'low'
    } else if (match.status === 'ambiguous') {
      confidence = 'low'
    }
    if (parseValue(row.valuePrinted).kind === 'text' && /\d/.test(row.valuePrinted)) confidence = lower(confidence, 'medium')
    return {
      values: { date, name: row.nameAsPrinted, value: row.valuePrinted, unit, range: row.rangePrinted ?? '', flag: row.flagPrinted ?? '', marker },
      confidence,
      sourceText: [row.samplePrinted ? `${row.samplePrinted}:` : '', row.nameAsPrinted, row.valuePrinted, unit, row.rangePrinted ? `(${row.rangePrinted})` : '', row.flagPrinted ?? ''].filter(Boolean).join(' '),
      page: row.page,
    }
  })
}

/** Which decimal mark a report uses, judged from all its values and ranges together. */
export function guessDecimal(texts: string[]): DecimalHint {
  let comma = 0
  let point = 0
  for (const t of texts) {
    if (/\d,\d{1,2}(?!\d)/.test(t)) comma++
    if (/\d\.\d{1,2}(?!\d)/.test(t)) point++
  }
  return comma > point ? ',' : '.'
}

export type ConfirmedResultRow = { date: string; name: string; value: string; unit?: string; range?: string; flag?: string; marker?: string }

/**
 * Turns the rows the user confirmed into one report per sample date, with results stored exactly as
 * printed. Only confirmed rows ever reach this function (the review panel enforces it).
 */
export function recordsFromConfirmed(
  rows: ConfirmedResultRow[],
  opts: { profileId: string; documentId?: string; lab?: string | null; now: string; newId: () => string },
): { reports: Report[]; results: Result[] } {
  const decimal = guessDecimal(rows.flatMap((r) => [r.value, r.range ?? '']))
  const byDate = new Map<string, ConfirmedResultRow[]>()
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])

  const reports: Report[] = []
  const results: Result[] = []
  for (const [date, group] of byDate) {
    const report: Report = {
      id: opts.newId(),
      profileId: opts.profileId,
      date,
      ...(opts.lab ? { lab: opts.lab } : {}),
      ...(opts.documentId ? { documentId: opts.documentId } : {}),
      source: 'extracted',
      createdAt: opts.now,
      updatedAt: opts.now,
    }
    reports.push(report)
    for (const r of group) {
      const value = parseValue(r.value, decimal)
      const range = r.range?.trim() ? parseRange(r.range, decimal) : null
      results.push({
        id: opts.newId(),
        reportId: report.id,
        profileId: opts.profileId,
        ...(r.marker ? { markerId: r.marker } : {}),
        nameAsPrinted: r.name.trim(),
        ...(value.kind === 'number' ? { value: value.value, ...(value.comparator ? { comparator: value.comparator } : {}) } : { textValue: value.text }),
        ...(r.unit?.trim() ? { unitAsPrinted: r.unit.trim() } : {}),
        ...(r.range?.trim() ? { range: range ?? { text: r.range.trim() } } : {}),
        ...(r.flag?.trim() ? { flagAsPrinted: r.flag.trim() } : {}),
        createdAt: opts.now,
        updatedAt: opts.now,
      })
    }
  }
  return { reports, results }
}
