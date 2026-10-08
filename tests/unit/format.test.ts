import { describe, expect, it } from 'vitest'
import { formatPoint, formatValue, unitLabel } from '../../src/app/format'

describe('formatValue: never rounds a small value to a different number', () => {
  it('keeps three significant digits under 1', () => {
    expect(formatValue(0.003)).toBe('0.003')
    expect(formatValue(0.005)).toBe('0.005')
    expect(formatValue(0.0123)).toBe('0.0123')
    expect(formatValue(0.456)).toBe('0.456')
    expect(formatValue(0.1)).toBe('0.1')
  })

  it('never shows a non-zero value as 0', () => {
    for (const v of [0.0004, 0.001, 0.009]) expect(formatValue(v)).not.toBe('0')
  })

  it('keeps the usual precision for larger values', () => {
    expect(formatValue(0)).toBe('0')
    expect(formatValue(5.25)).toBe('5.25')
    expect(formatValue(42.36)).toBe('42.4')
    expect(formatValue(612)).toBe('612')
    expect(formatValue(6500)).toBe('6,500')
  })

  it('keeps a comparator', () => {
    expect(formatPoint({ value: 0.005, comparator: '<' })).toBe('<0.005')
    expect(formatPoint({ value: 0.003 })).toBe('0.003')
  })
})

describe('unitLabel', () => {
  it('writes counts with a times sign', () => {
    expect(unitLabel('10⁹/L')).toBe('× 10⁹/L')
    expect(unitLabel('10¹²/L')).toBe('× 10¹²/L')
    expect(unitLabel('mmol/L')).toBe('mmol/L')
  })
})
