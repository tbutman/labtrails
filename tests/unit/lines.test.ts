import { describe, expect, it } from 'vitest'
import { lineFlag, lineIn, lineText, validateLine, type PersonalLine } from '../../src/labs/lines'

const line = (over: Partial<PersonalLine> = {}): PersonalLine => ({ id: 'l', profileId: 'p', markerId: 'glucose', label: "Doctor's target", high: 100, unit: 'mg/dL', createdAt: 'x', updatedAt: 'x', ...over })

describe('personal lines', () => {
  it('converts the line to the unit shown, or gives up when it can’t', () => {
    expect(lineIn(line(), 'mg/dL')).toEqual({ high: 100, label: "Doctor's target" })
    expect(lineIn(line(), 'mmol/L')?.high).toBeCloseTo(5.55, 2)
    expect(lineIn(line({ markerId: 'lpa', high: 50, unit: 'mg/dL' }), 'nmol/L')).toBeNull()
  })

  it('flags results beyond the line, comparators only when every value they could be is beyond it', () => {
    const l = { low: 30, high: 54, label: 'x' }
    expect(lineFlag({ value: 55 }, l)).toBe('above')
    expect(lineFlag({ value: 54 }, l)).toBeNull()
    expect(lineFlag({ value: 29 }, l)).toBe('below')
    expect(lineFlag({ value: 30, comparator: '<' }, l)).toBe('below')
    expect(lineFlag({ value: 40, comparator: '<' }, l)).toBeNull()
    expect(lineFlag({ value: 55 }, null)).toBeNull()
  })

  it('describes and checks the line', () => {
    expect(lineText({ high: 54 })).toBe('under 54')
    expect(lineText({ low: 30 })).toBe('at least 30')
    expect(lineText({ low: 30, high: 54 })).toBe('between 30 and 54')
    expect(validateLine({ label: 'x', low: '', high: '' })).toMatch(/lower or an upper/)
    expect(validateLine({ label: 'x', low: '60', high: '54' })).toMatch(/below the upper/)
    expect(validateLine({ label: 'x', low: '', high: '5,5' })).toBeNull()
  })
})
