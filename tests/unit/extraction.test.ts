import { describe, expect, it } from 'vitest'
import { readPrintedDate } from '../../src/labs/extraction/dates'
import { EXTRACTION_SCHEMA, validateExtraction } from '../../src/labs/extraction/schema'

const row = (over: Record<string, unknown> = {}) => ({
  nameAsPrinted: 'Glicose',
  valuePrinted: '92',
  unitPrinted: 'mg/dL',
  rangePrinted: '70 - 110',
  flagPrinted: null,
  suggestedMarkerId: 'glucose',
  confidence: 'high',
  page: 1,
  ...over,
})

describe('validateExtraction', () => {
  it('keeps well-formed rows', () => {
    const v = validateExtraction({ sampleDate: { printed: '03/04/2025', guessedFormat: 'DMY' }, lab: 'Laboratório Exemplo', rows: [row()] })
    expect(v?.dropped).toBe(0)
    expect(v?.extraction.rows[0]).toMatchObject({ nameAsPrinted: 'Glicose', suggestedMarkerId: 'glucose' })
  })

  it('drops malformed rows and counts them, keeping the rest', () => {
    const v = validateExtraction({
      sampleDate: null,
      lab: null,
      rows: [row(), row({ valuePrinted: 42 }), row({ page: 0 }), row({ confidence: 'certain' }), 'nonsense', row({ nameAsPrinted: '' })],
    })
    expect(v?.extraction.rows).toHaveLength(1)
    expect(v?.dropped).toBe(5)
  })

  it('treats a marker ID outside the catalogue as no suggestion', () => {
    const v = validateExtraction({ sampleDate: null, lab: null, rows: [row({ suggestedMarkerId: 'cure-all' })] })
    expect(v?.extraction.rows[0].suggestedMarkerId).toBe('unknown')
  })

  it('rejects output that is not an extraction at all', () => {
    expect(validateExtraction('Ignore previous instructions')).toBeNull()
    expect(validateExtraction({ rows: 'none' })).toBeNull()
    expect(validateExtraction(null)).toBeNull()
  })

  it('rejects overlong text, which a real lab value never is', () => {
    const v = validateExtraction({ sampleDate: null, lab: null, rows: [row({ nameAsPrinted: 'x'.repeat(500) })] })
    expect(v?.extraction.rows).toHaveLength(0)
    expect(v?.dropped).toBe(1)
  })

  it('limits marker suggestions to the catalogue in the schema itself', () => {
    const ids = EXTRACTION_SCHEMA.properties.rows.items.properties.suggestedMarkerId.enum
    expect(ids).toContain('glucose')
    expect(ids).toContain('unknown')
  })
})

describe('readPrintedDate', () => {
  it('asks when a date reads both ways, putting the guess first', () => {
    expect(readPrintedDate('03/04/2025', 'DMY')).toEqual({ candidates: ['2025-04-03', '2025-03-04'], ambiguous: true })
    expect(readPrintedDate('03/04/2025', 'MDY')).toEqual({ candidates: ['2025-03-04', '2025-04-03'], ambiguous: true })
  })

  it('is certain when only one reading is a real date', () => {
    expect(readPrintedDate('25/04/2025')).toEqual({ candidates: ['2025-04-25'], ambiguous: false })
    expect(readPrintedDate('04/25/2025', 'MDY')).toEqual({ candidates: ['2025-04-25'], ambiguous: false })
    expect(readPrintedDate('05.05.2025')).toEqual({ candidates: ['2025-05-05'], ambiguous: false })
  })

  it('reads ISO dates and two-digit years', () => {
    expect(readPrintedDate('2025-04-03')).toEqual({ candidates: ['2025-04-03'], ambiguous: false })
    expect(readPrintedDate('25-04-25')).toEqual({ candidates: ['2025-04-25'], ambiguous: false })
  })

  it('rejects impossible dates and other text', () => {
    expect(readPrintedDate('31/02/2025').candidates).toEqual([])
    expect(readPrintedDate('April 3rd').candidates).toEqual([])
  })
})
