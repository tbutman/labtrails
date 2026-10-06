import { describe, expect, it } from 'vitest'
import { DEMO_EXTRACTION, DEMO_REPORTS, DEMO_RESULTS } from '../../src/app/demo'
import { alreadySavedRows, parseFasting, similarReport } from '../../src/labs/extraction/duplicates'
import { recordsFromConfirmed, toProposedRows, type ConfirmedResultRow } from '../../src/labs/extraction/proposals'

const rows = toProposedRows(DEMO_EXTRACTION)
let n = 0
const saveAll = () => {
  const confirmed: ConfirmedResultRow[] = rows.map((r) => ({ ...r.values, date: '2026-09-15' }))
  return recordsFromConfirmed(confirmed, { profileId: 'p', now: '2026-10-06T00:00:00Z', newId: () => `x${++n}` })
}

describe('content-level duplicates', () => {
  it('finds nothing when the report is new', () => {
    expect(alreadySavedRows(rows, DEMO_REPORTS, DEMO_RESULTS)).toEqual([])
    expect(similarReport(rows, DEMO_REPORTS, DEMO_RESULTS)).toBeNull()
  })

  it('recognises the same report read again from a different file', () => {
    const saved = saveAll()
    const reports = [...DEMO_REPORTS, ...saved.reports]
    const results = [...DEMO_RESULTS, ...saved.results]
    expect(alreadySavedRows(rows, reports, results)).toHaveLength(rows.length)
    const similar = similarReport(rows, reports, results)
    expect(similar?.report.date).toBe('2026-09-15')
    expect(similar?.matched).toBe(similar?.compared)
  })

  it('leaves out only the rows that match, so a report with new rows still adds them', () => {
    const saved = saveAll()
    const results = [...DEMO_RESULTS, ...saved.results.filter((r) => r.nameAsPrinted !== 'Glicose')]
    const already = alreadySavedRows(rows, [...DEMO_REPORTS, ...saved.reports], results)
    expect(already.map((r) => r.values.name)).not.toContain('Glicose')
    expect(already).toHaveLength(rows.length - 1)
  })

  it("doesn't call a different value on the same date a duplicate", () => {
    const saved = saveAll()
    const changed = saved.results.map((r) => (r.value !== undefined ? { ...r, value: r.value + 1 } : r))
    expect(alreadySavedRows(rows, saved.reports, changed)).toEqual([])
    expect(similarReport(rows, saved.reports, changed)).toBeNull()
  })

  it('reads fasting as printed, in Portuguese or English', () => {
    expect(parseFasting('sim')).toBe('yes')
    expect(parseFasting('Em jejum')).toBe('yes')
    expect(parseFasting('Não')).toBe('no')
    expect(parseFasting('No')).toBe('no')
    expect(parseFasting('12 horas')).toBeUndefined()
    expect(parseFasting(null)).toBeUndefined()
  })
})
