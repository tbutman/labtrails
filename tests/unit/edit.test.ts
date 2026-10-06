import { describe, expect, it } from 'vitest'
import { DEMO_RESULTS } from '../../src/app/demo'
import { aliasToRemember, inputFromResult, printedNumber, reportDecimal, resultFromInput, sameNameResults, validateInput } from '../../src/labs/edit'

const base = { id: 'r1', reportId: 'rep', profileId: 'p', createdAt: '2026-01-01T00:00:00Z' }
const now = '2026-10-06T12:00:00Z'

describe('editing results', () => {
  it('round-trips a saved result through the form unchanged', () => {
    for (const r of DEMO_RESULTS.slice(0, 30)) {
      const decimal = reportDecimal(DEMO_RESULTS.filter((x) => x.reportId === r.reportId))
      const again = resultFromInput(inputFromResult(r, decimal), r, decimal, r.updatedAt)
      expect(again).toEqual(r)
    }
  })

  it('corrects a misread value, keeping the result as printed and its identity', () => {
    const fixed = resultFromInput({ name: 'Glicose', value: '98', unit: 'mg/dL', range: '70 - 110', flag: '', markerId: '' }, base, ',', now)
    expect(fixed).toMatchObject({ id: 'r1', createdAt: base.createdAt, updatedAt: now, markerId: 'glucose', value: 98, range: { low: 70, high: 110 } })
  })

  it('reads decimal commas and comparators as on entry', () => {
    expect(resultFromInput({ name: 'PCR', value: '<0,5', unit: 'mg/L', range: '< 5,0', flag: '', markerId: '' }, base, ',', now)).toMatchObject({
      markerId: 'crp',
      value: 0.5,
      comparator: '<',
      range: { high: 5 },
    })
  })

  it('maps an unknown name when a marker is chosen', () => {
    const mapped = resultFromInput({ name: 'Cistatina C', value: '0,82', unit: 'mg/L', range: '', flag: '', markerId: 'creatinine' }, base, ',', now)
    expect(mapped.markerId).toBe('creatinine')
    const kept = resultFromInput({ name: 'Cistatina C', value: '0,82', unit: 'mg/L', range: '', flag: '', markerId: '' }, base, ',', now)
    expect(kept.markerId).toBeUndefined()
  })

  it('judges the decimal mark from the report and finds results printed the same way', () => {
    expect(reportDecimal(DEMO_RESULTS.filter((r) => r.reportId === 'r6'))).toBe(',')
    expect(reportDecimal(DEMO_RESULTS.filter((r) => r.reportId === 'r1'))).toBe('.')
    expect(sameNameResults(DEMO_RESULTS, 'cistatina c')).toHaveLength(4)
  })

  it('writes stored numbers with the report\'s decimal mark, so they read back the same', () => {
    const r = { ...base, nameAsPrinted: 'Ureia', value: 1.234, unitAsPrinted: 'g/L', updatedAt: now }
    expect(inputFromResult(r, ',').value).toBe('1,234')
    expect(resultFromInput(inputFromResult(r, ','), r, ',', now).value).toBe(1.234)
    expect(printedNumber(0.82, '.')).toBe('0.82')
  })

  it('asks for a name and a value', () => {
    expect(validateInput({ name: '', value: '1', unit: '', range: '', flag: '', markerId: '' })).toMatch(/name/)
    expect(validateInput({ name: 'X', value: ' ', unit: '', range: '', flag: '', markerId: '' })).toMatch(/value/)
  })
})

describe('remembering mappings', () => {
  const input = { name: 'Cistatina C', value: '0,82', unit: 'mg/l', range: '', flag: '', markerId: 'creatinine' }
  const newId = () => 'new'

  it('remembers a name mapped by hand, with the unit spelled the way the matcher compares it', () => {
    expect(aliasToRemember(input, [], undefined, newId)).toEqual({ id: 'new', nameAsPrinted: 'Cistatina C', unitAsPrinted: 'mg/L', markerId: 'creatinine' })
  })

  it('updates an earlier mapping for the same name instead of adding another', () => {
    const earlier = { id: 'a1', nameAsPrinted: 'cistatina c', unitAsPrinted: 'mg/L', markerId: 'crp' }
    expect(aliasToRemember(input, [earlier], 'crp', newId)).toMatchObject({ id: 'a1', markerId: 'creatinine' })
  })

  it("doesn't remember what the code finds anyway, or a choice that didn't change", () => {
    expect(aliasToRemember({ ...input, name: 'Glicose', unit: 'mg/dL', markerId: 'glucose' }, [], undefined, newId)).toBeNull()
    expect(aliasToRemember(input, [], 'creatinine', newId)).toBeNull()
    expect(aliasToRemember({ ...input, markerId: '' }, [], 'creatinine', newId)).toBeNull()
  })

  it('leaves the marker blank in the form when the code would find it, so the form says "Understood as"', () => {
    const glucose = DEMO_RESULTS.find((r) => r.markerId === 'glucose')!
    expect(inputFromResult(glucose, '.').markerId).toBe('')
    const guessed = DEMO_RESULTS.find((r) => r.nameAsPrinted === 'Cistatina C' && r.markerId)
    if (guessed) expect(inputFromResult(guessed, ',').markerId).toBe(guessed.markerId)
  })
})
