import { describe, expect, it } from 'vitest'
import { confirmedRows, type ReviewRow } from '../../src/core/review/model'
import { EXTRACTION_COLUMNS } from '../../src/app/extractionColumns'
import { DEMO_EXTRACTION } from '../../src/app/demo'
import { extractionPrompt, guessDecimal, recordsFromConfirmed, toProposedRows, type ConfirmedResultRow } from '../../src/labs/extraction/proposals'
import type { Extraction } from '../../src/labs/extraction/schema'

const extraction = (rows: Partial<Extraction['rows'][number]>[]): Extraction => ({
  sampleDate: { printed: '03/04/2026', guessedFormat: 'DMY' },
  lab: 'Fictional lab',
  rows: rows.map((r) => ({ nameAsPrinted: 'Glicose', valuePrinted: '92', unitPrinted: 'mg/dL', rangePrinted: '70 - 110', flagPrinted: null, suggestedMarkerId: 'glucose', confidence: 'high', page: 1, ...r })),
})

describe('toProposedRows', () => {
  it("prefers the code's own match over the AI's suggestion", () => {
    const [row] = toProposedRows(extraction([{ nameAsPrinted: 'Glicose', suggestedMarkerId: 'insulin' }]))
    expect(row.values.marker).toBe('glucose')
    expect(row.confidence).toBe('high')
  })

  it("uses the AI's suggestion only as a fallback, marked for checking", () => {
    const [row] = toProposedRows(extraction([{ nameAsPrinted: 'Glic. plasm.', suggestedMarkerId: 'glucose', confidence: 'high' }]))
    expect(row.values.marker).toBe('glucose')
    expect(row.confidence).toBe('low')
  })

  it('keeps unknown names as printed', () => {
    const [row] = toProposedRows(extraction([{ nameAsPrinted: 'Cistatina C', suggestedMarkerId: 'unknown', unitPrinted: 'mg/L' }]))
    expect(row.values.marker).toBe('')
  })

  it('flags names that fit two markers for checking', () => {
    const [row] = toProposedRows(extraction([{ nameAsPrinted: 'Neutrófilos', unitPrinted: null, suggestedMarkerId: 'unknown' }]))
    expect(row.confidence).toBe('low')
  })

  it("uses the user's own mappings", () => {
    const [row] = toProposedRows(extraction([{ nameAsPrinted: 'Glic. plasm.', suggestedMarkerId: 'unknown' }]), [{ nameAsPrinted: 'Glic. plasm.', markerId: 'glucose' }])
    expect(row.values.marker).toBe('glucose')
    expect(row.confidence).toBe('high')
  })

  it('lists every catalogue ID in the prompt', () => {
    expect(extractionPrompt()).toContain('glucose: Glucose')
    expect(extractionPrompt()).toContain('vitamin-d: Vitamin D (25-OH)')
  })
})

describe('nothing is saved without confirmation', () => {
  const columns = EXTRACTION_COLUMNS
  const proposed = toProposedRows(DEMO_EXTRACTION)
  const rows: ReviewRow[] = proposed.map((p, i) => ({ id: String(i), values: Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, String(v)])), confidence: p.confidence, status: 'pending' }))

  it('pending rows never reach the app', () => {
    expect(confirmedRows(rows, columns, 'dmy')).toEqual([])
  })

  it('removed rows never reach the app; accepted ones do, with ISO dates', () => {
    const reviewed = rows.map((r, i) => ({ ...r, status: i === 0 ? ('rejected' as const) : ('accepted' as const) }))
    const confirmed = confirmedRows(reviewed, columns, 'dmy')
    expect(confirmed).toHaveLength(rows.length - 1)
    expect(confirmed[0].date).toBe('2026-09-15')
  })
})

describe('recordsFromConfirmed', () => {
  let n = 0
  const opts = { profileId: 'p', documentId: 'd', lab: 'Fictional lab', now: '2026-10-06T12:00:00Z', newId: () => `id${++n}` }

  it('stores values exactly as printed, parsed with the report\'s decimal mark', () => {
    const rows: ConfirmedResultRow[] = [
      { date: '2026-09-15', name: 'Glicose', value: '104', unit: 'mg/dL', range: '70 - 110', marker: 'glucose' },
      { date: '2026-09-15', name: 'Creatinina', value: '0,98', unit: 'mg/dL', range: '0,70 - 1,20', marker: 'creatinine' },
      { date: '2026-09-15', name: 'PCR', value: '<0,5', unit: 'mg/L', range: '< 5,0', marker: 'crp' },
      { date: '2026-09-15', name: 'Cistatina C', value: '0,82', unit: 'mg/L', range: '' },
    ]
    const { reports, results } = recordsFromConfirmed(rows, opts)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ date: '2026-09-15', source: 'extracted', documentId: 'd', lab: 'Fictional lab' })
    expect(results[1]).toMatchObject({ value: 0.98, range: { low: 0.7, high: 1.2, text: '0,70 - 1,20' }, nameAsPrinted: 'Creatinina' })
    expect(results[2]).toMatchObject({ value: 0.5, comparator: '<', range: { high: 5 } })
    expect(results[3].markerId).toBeUndefined()
  })

  it('makes one report per sample date', () => {
    const { reports } = recordsFromConfirmed(
      [
        { date: '2026-01-10', name: 'Glucose', value: '90', marker: 'glucose' },
        { date: '2026-06-10', name: 'Glucose', value: '95', marker: 'glucose' },
      ],
      opts,
    )
    expect(reports.map((r) => r.date)).toEqual(['2026-01-10', '2026-06-10'])
  })

  it('guesses the decimal mark from the whole report', () => {
    expect(guessDecimal(['0,98', '4,5', '120'])).toBe(',')
    expect(guessDecimal(['0.98', '4.5', '6,500'])).toBe('.')
  })
})
