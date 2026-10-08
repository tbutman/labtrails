import { describe, expect, it } from 'vitest'
import { parseNumber, parseRange, parseValue } from '../../src/labs/units/parse'
import { normaliseUnit } from '../../src/labs/units/normalise'

describe('parseNumber', () => {
  it.each([
    ['5.4', 5.4],
    ['5,4', 5.4],
    ['0,85', 0.85],
    ['120', 120],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['−2,5', -2.5],
    [' 7 ', 7],
  ])('reads %s', (text, value) => {
    expect(parseNumber(text)).toEqual({ value, ambiguous: false })
  })

  it('marks thousands-style numbers as ambiguous unless told the decimal mark', () => {
    expect(parseNumber('6,500')).toEqual({ value: 6500, ambiguous: true })
    expect(parseNumber('6,500', ',')).toMatchObject({ value: 6.5, ambiguous: false })
    expect(parseNumber('6.500', '.')).toMatchObject({ value: 6.5, ambiguous: false, otherReading: 6500 })
    expect(parseNumber('1.234.567')).toEqual({ value: 1234567, ambiguous: false })
  })

  it('rejects text that is not a number', () => {
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('5,4,3')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('parseValue', () => {
  it('reads plain values, with a unit or flag printed alongside', () => {
    expect(parseValue('5,4')).toEqual({ kind: 'number', value: 5.4, ambiguous: false })
    expect(parseValue('98 mg/dL')).toEqual({ kind: 'number', value: 98, ambiguous: false })
    expect(parseValue('250 H')).toEqual({ kind: 'number', value: 250, ambiguous: false })
  })

  it('reads comparators in symbols, English and Portuguese', () => {
    expect(parseValue('<0.5')).toMatchObject({ value: 0.5, comparator: '<' })
    expect(parseValue('< 0,5')).toMatchObject({ value: 0.5, comparator: '<' })
    expect(parseValue('inferior a 0,5')).toMatchObject({ value: 0.5, comparator: '<' })
    expect(parseValue('≥ 90')).toMatchObject({ value: 90, comparator: '≥' })
    expect(parseValue('>=90')).toMatchObject({ value: 90, comparator: '≥' })
    expect(parseValue('superior a 60')).toMatchObject({ value: 60, comparator: '>' })
  })

  it('keeps qualitative results as text', () => {
    expect(parseValue('Negativo')).toEqual({ kind: 'text', text: 'Negativo' })
    expect(parseValue('Not detected')).toEqual({ kind: 'text', text: 'Not detected' })
  })
})

describe('parseRange', () => {
  it.each([
    ['70 - 110', 70, 110],
    ['70-110', 70, 110],
    ['70 a 110', 70, 110],
    ['70 – 110', 70, 110],
    ['[70; 110]', 70, 110],
    ['0,5 - 1,2', 0.5, 1.2],
    ['3.5 to 5.0', 3.5, 5],
    ['70 - 110 mg/dL', 70, 110],
  ])('reads the two-sided range %s', (text, low, high) => {
    expect(parseRange(text)).toEqual({ low, high, text })
  })

  it.each([
    ['< 200', { high: 200 }],
    ['<200', { high: 200 }],
    ['até 200', { high: 200 }],
    ['inferior a 5,0', { high: 5 }],
    ['> 40', { low: 40 }],
    ['superior a 40', { low: 40 }],
    ['≥ 60', { low: 60 }],
  ])('reads the one-sided range %s', (text, expected) => {
    expect(parseRange(text)).toEqual({ ...expected, text })
  })

  it('gives up on ranges it cannot read with confidence', () => {
    expect(parseRange('Homens: 13-17; Mulheres: 12-15')).toBeNull()
    expect(parseRange('110 - 70')).toBeNull()
    expect(parseRange('')).toBeNull()
  })
})

describe('normaliseUnit', () => {
  it.each([
    ['mg/dl', 'mg/dL'],
    ['MG/DL', 'mg/dL'],
    ['umol/L', 'µmol/L'],
    ['μmol/l', 'µmol/L'],
    ['mcg/dL', 'µg/dL'],
    ['ug/L', 'µg/L'],
    ['x10^3/uL', '10³/µL'],
    ['10E3/µL', '10³/µL'],
    ['x10³/µL', '10³/µL'],
    ['10^9/L', '10⁹/L'],
    ['G/L', '10⁹/L'],
    ['x10^6/uL', '10⁶/µL'],
    ['/mm3', '/µL'],
    ['UI/L', 'U/L'],
    ['IU/L', 'U/L'],
    ['mUI/L', 'mIU/L'],
    ['uIU/mL', 'µIU/mL'],
    ['mL/min/1,73m2', 'mL/min/1.73m²'],
    ['mm/1ªh', 'mm/h'],
  ])('%s → %s', (printed, canonical) => {
    expect(normaliseUnit(printed)).toBe(canonical)
  })

  it('leaves unknown units as printed', () => {
    expect(normaliseUnit(' copies/mL ')).toBe('copies/mL')
  })
})

describe('a thousands-style number read with a decimal mark (LAB-03)', () => {
  it('keeps the other reading, so the form can say how it was read', () => {
    expect(parseNumber('6,500', ',')).toEqual({ value: 6.5, ambiguous: false, otherReading: 6500 })
    expect(parseNumber('6,500', '.')).toEqual({ value: 6500, ambiguous: false, otherReading: 6.5 })
    expect(parseNumber('6,500')).toEqual({ value: 6500, ambiguous: true })
    expect(parseNumber('5,4', ',')).toEqual({ value: 5.4, ambiguous: false })
  })
})
