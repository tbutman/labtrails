// Formats found on real Portuguese lab reports (October 2026), reproduced with made-up values: banded
// and age-banded ranges, units with their denominator cut off, percentages written into the value,
// sample dates with a time, urinalysis rows named like blood tests, previous-results columns without
// a range, and the names labs print ("V.G.M.", "Creatininémia", "TFGe [CKD-EPI 2009]").

import { describe, expect, it } from 'vitest'
import { EXTRACTION_COLUMNS } from '../../src/app/extractionColumns'
import { rowErrors, type ReviewRow } from '../../src/core/review/model'
import { inputFromResult, resultFromInput } from '../../src/labs/edit'
import { printedDates, printedTime, recordsFromConfirmed, splitDateTime, toProposedRows, type ConfirmedResultRow } from '../../src/labs/extraction/proposals'
import type { Extraction, ExtractedRow } from '../../src/labs/extraction/schema'
import { matchMarker } from '../../src/labs/match/match'
import { personAt } from '../../src/labs/person'
import type { Result } from '../../src/labs/types'
import { normaliseUnit } from '../../src/labs/units/normalise'
import { parseRange, parseValue } from '../../src/labs/units/parse'

const man44 = { age: 44, sex: 'male' as const }

describe('ranges printed in bands', () => {
  it('takes the sufficient band of a vitamin D range, in Portuguese or English', () => {
    expect(parseRange('Deficiência: <10; Insuficiência: 10 - 30; Suficiência: 30 - 100; Toxicidade: >100', '.')).toMatchObject({ low: 30, high: 100 })
    expect(parseRange('Deficiency: <20; Insufficiency: 20 - 29; Sufficiency: 30 - 100', '.')).toMatchObject({ low: 30, high: 100 })
    expect(parseRange('Deficient < 25 · Insufficient 25 - 74 · Sufficient 75 - 200', '.')).toMatchObject({ low: 75, high: 200 })
  })

  it("takes the person's age band, and stores nothing rather than a wrong range when the age isn't known", () => {
    expect(parseRange('40 - 49 anos: 0 - 2.5', '.', man44)).toMatchObject({ low: 0, high: 2.5 })
    expect(parseRange('40 - 49 anos: 0 - 2.5', '.')).toBeNull()
    expect(parseRange('40 - 49 anos: 0 - 2.5', '.', { age: 62 })).toBeNull()
    const free = '< 15 Anos < 1,8; 15 - 39 Anos 5,4 - 40,0; 40 - 59 Anos 3,6 - 25,7; >= 60 Anos 1,5 - 28,8'
    expect(parseRange(free, ',', man44)).toMatchObject({ low: 3.6, high: 25.7 })
    expect(parseRange(free, ',', { age: 30 })).toMatchObject({ low: 5.4, high: 40 })
  })

  it("takes the person's sex band", () => {
    expect(parseRange('Homens: 13,0 - 17,0; Mulheres: 12,0 - 15,5', ',', man44)).toMatchObject({ low: 13, high: 17 })
    expect(parseRange('Men: 13 - 17; Women: 12 - 15.5', '.', { sex: 'female' })).toMatchObject({ low: 12, high: 15.5 })
    expect(parseRange('Homens: 13,0 - 17,0; Mulheres: 12,0 - 15,5', ',')).toBeNull()
  })

  it('takes the normal or desirable band of a category range', () => {
    expect(parseRange('< 5,7 Normal; 5,7-6,4 Risco de Diabetes; > 6,4 Diabetes', ',')).toMatchObject({ high: 5.7 })
    expect(parseRange('Desejável < 100; Risco Baixo 100 - 129; Risco Elevado 160 - 189', '.')).toMatchObject({ high: 100 })
  })

  it('still reads plain ranges, now with a percent sign too', () => {
    expect(parseRange('70 - 110', '.')).toMatchObject({ low: 70, high: 110 })
    expect(parseRange('< 190', '.')).toMatchObject({ high: 190 })
    expect(parseRange('40-80%', '.')).toMatchObject({ low: 40, high: 80 })
    expect(parseValue('47,1%', ',')).toMatchObject({ kind: 'number', value: 47.1 })
  })
})

describe('units and names as labs print them', () => {
  it('reads a count with its denominator cut off', () => {
    expect(normaliseUnit('x 10³/')).toBe('10³/µL')
    expect(normaliseUnit('x 10^6/')).toBe('10⁶/µL')
    expect(normaliseUnit('x10^9/')).toBe('10⁹/L')
    expect(normaliseUnit('x10^12/L')).toBe('10¹²/L')
  })

  it('matches Portuguese report names to the catalogue', () => {
    const cases: [string, string][] = [
      ['V.G.M.', 'mcv'],
      ['H.G.M.', 'mch'],
      ['C.H.G.M.', 'mchc'],
      ['R.D.W.', 'rdw'],
      ['Urémia', 'urea'],
      ['Creatininémia', 'creatinine'],
      ['Bilirrubinémia Directa', 'bilirubin-direct'],
      ['Calcémia', 'calcium'],
      ['Natrémia', 'sodium'],
      ['Kaliémia', 'potassium'],
      ['TFGe [CKD-EPI 2009]', 'egfr'],
      ['VS à 1ª hora', 'esr'],
      ['Testosterona Total Plasmática (TT)', 'testosterone'],
      ['Testosterona Livre (TL)', 'free-testosterone'],
      ['TGO - Aspartato Aminotransferase', 'ast'],
      ['Colesterol LDL Directo', 'ldl'],
      // Caught by the live extraction check on the fictional reports.
      ['Red cell count', 'rbc'],
      ['LDL Chol Calc (NIH)', 'ldl'],
    ]
    for (const [name, id] of cases) expect(matchMarker(name, undefined), name).toMatchObject({ status: 'matched', markerId: id })
    // Direct bilirubin stays direct.
    expect(matchMarker('Bilirrubina Directa', 'mg/dL')).toMatchObject({ markerId: 'bilirubin-direct' })
  })

  it('splits the time off a sample date', () => {
    expect(splitDateTime('12/03/2026 08:41:07')).toEqual({ date: '12/03/2026', time: '08:41' })
    expect(splitDateTime('12/03/2026')).toEqual({ date: '12/03/2026' })
  })
})

const row = (over: Partial<ExtractedRow>): ExtractedRow => ({
  nameAsPrinted: 'Hemoglobina',
  valuePrinted: '15,1',
  unitPrinted: 'g/dl',
  rangePrinted: '13,0 - 17,0',
  flagPrinted: null,
  suggestedMarkerId: 'haemoglobin',
  confidence: 'high',
  page: 2,
  samplePrinted: null,
  specimen: 'blood',
  ...over,
})

describe('a report with urinalysis, a previous column and a time', () => {
  const extraction: Extraction = {
    sampleDate: { printed: '12/03/2026 08:41:07', guessedFormat: 'DMY' },
    lab: 'Laboratório Fictício',
    fastingPrinted: null,
    rows: [
      row({ samplePrinted: '12/03/2026' }),
      row({ valuePrinted: '14,6', rangePrinted: null, samplePrinted: '20/01/2026' }),
      row({ nameAsPrinted: 'Neutrófilos (%)', valuePrinted: '51,2%', unitPrinted: null, rangePrinted: '40-80%', suggestedMarkerId: 'neutrophils-pct' }),
      row({ nameAsPrinted: 'Glicose', valuePrinted: 'Negativo', unitPrinted: null, rangePrinted: null, suggestedMarkerId: 'glucose', specimen: 'urine', page: 6 }),
      row({ nameAsPrinted: 'Leucócitos', valuePrinted: '< 1', unitPrinted: '/Campo 400x', rangePrinted: '< 5', suggestedMarkerId: 'wbc', specimen: 'urine', page: 6 }),
    ],
  }
  const rows = toProposedRows(extraction)

  it('dates rows without the time, and keeps the time for the report', () => {
    expect(rows.map((r) => r.values.date)).toEqual(['12/03/2026', '20/01/2026', '12/03/2026', '12/03/2026', '12/03/2026'])
    expect(printedDates(extraction)).toEqual(['12/03/2026', '20/01/2026'])
    expect(printedTime(extraction)).toBe('08:41')
  })

  it("gives a previous result this report's printed range, and says so", () => {
    expect(rows[1].values.range).toBe('13,0 - 17,0')
    expect(rows[1].sourceText).toMatch(/^20\/01\/2026: Hemoglobina 14,6 g\/dl \(no range printed for this date/)
  })

  it('reads a percentage written into the value', () => {
    expect(rows[2].values).toMatchObject({ unit: '%', marker: 'neutrophils-pct' })
  })

  it('never matches a urine row to a blood marker, whatever its name or the AI suggests', () => {
    expect(rows[3].values).toMatchObject({ marker: '', specimen: 'urine' })
    expect(rows[4].values).toMatchObject({ marker: '', specimen: 'urine' })
    expect(rows[3].sourceText).toMatch(/^Urine: Glicose Negativo/)
  })

  it('keeps the sample type when saving, and asks before a urine row goes on a chart', () => {
    const confirmed: ConfirmedResultRow[] = [{ date: '2026-03-12', name: 'Leucócitos', value: '< 1', unit: '/Campo 400x', range: '< 5', specimen: 'urine' }]
    const { results } = recordsFromConfirmed(confirmed, { profileId: 'p', now: 'now', newId: () => 'id' })
    expect(results[0]).toMatchObject({ specimen: 'urine', nameAsPrinted: 'Leucócitos' })
    expect(results[0].markerId).toBeUndefined()

    const review = (values: Record<string, string>): ReviewRow => ({ id: 'r', values, confidence: 'high', status: 'accepted' })
    const base = { date: '12/03/2026', name: 'Leucócitos', value: '< 1', unit: '', range: '', flag: '', marker: 'wbc', specimen: 'urine' }
    expect(rowErrors(review(base), EXTRACTION_COLUMNS, 'dmy').specimen).toMatch(/Only blood results/)
    expect(rowErrors(review({ ...base, marker: '' }), EXTRACTION_COLUMNS, 'dmy').specimen).toBeUndefined()
  })

  it("picks an age band with the person's date of birth on the test date", () => {
    const profile = { dateOfBirth: '1982-05-20', sex: 'male' as const }
    expect(personAt(profile, '2026-03-12')).toEqual({ age: 43, sex: 'male' })
    const confirmed: ConfirmedResultRow[] = [{ date: '2026-03-12', name: 'PSA Total', value: '0.9', unit: 'ng/ml', range: '40 - 49 anos: 0 - 2.5', marker: 'psa' }]
    expect(recordsFromConfirmed(confirmed, { profileId: 'p', now: 'now', newId: () => 'id', profile }).results[0].range).toMatchObject({ low: 0, high: 2.5 })
    expect(recordsFromConfirmed(confirmed, { profileId: 'p', now: 'now', newId: () => 'id' }).results[0].range).toEqual({ text: '40 - 49 anos: 0 - 2.5' })
  })
})

describe('correcting a result leaves nothing of the old value behind', () => {
  const saved: Result = { id: 'x', reportId: 'r', profileId: 'p', markerId: 'crp', nameAsPrinted: 'Proteína X', value: 4.2, unitAsPrinted: 'mg/L', createdAt: 'then', updatedAt: 'then' }

  it('unmapping a name clears its marker, and a text value clears the number', () => {
    const input = { ...inputFromResult(saved, '.'), markerId: '', value: 'Não revelou' }
    const fixed = resultFromInput(input, saved, '.', 'now')
    expect(fixed.markerId).toBeUndefined()
    expect(fixed.value).toBeUndefined()
    expect(fixed.textValue).toBe('Não revelou')
    expect(fixed).toMatchObject({ id: 'x', createdAt: 'then' })
  })
})
