import { describe, expect, it } from 'vitest'
import { changeSincePrevious, labFlagWithoutCodeFlag, rangeFlag, trend, type Point } from '../../src/labs/flags/flags'
import { buildSeries } from '../../src/labs/series'
import type { Report, Result } from '../../src/labs/types'

const p = (date: string, value: number, low?: number, high?: number, extra: Partial<Point> = {}): Point => ({
  date,
  value,
  ...(low !== undefined || high !== undefined ? { range: { ...(low !== undefined ? { low } : {}), ...(high !== undefined ? { high } : {}) } } : {}),
  ...extra,
})

describe('rule 1: outside the lab range', () => {
  it('flags values above or below their own range', () => {
    expect(rangeFlag(p('2025-01-01', 120, 70, 110))).toEqual({ side: 'above', basis: 'range' })
    expect(rangeFlag(p('2025-01-01', 60, 70, 110))).toEqual({ side: 'below', basis: 'range' })
    expect(rangeFlag(p('2025-01-01', 110, 70, 110))).toBeNull() // the limits are inside
    expect(rangeFlag(p('2025-01-01', 70, 70, 110))).toBeNull()
  })

  it('judges each result against its own lab range, not one global band', () => {
    // The same value is inside one lab's range and outside another's.
    expect(rangeFlag(p('2024-01-01', 25, 20, 80))).toBeNull()
    expect(rangeFlag(p('2025-01-01', 25, 30, 100))).toEqual({ side: 'below', basis: 'range' })
  })

  it('flags one-sided ranges on their one side only', () => {
    expect(rangeFlag(p('2025-01-01', 210, undefined, 200))).toEqual({ side: 'above', basis: 'range' })
    expect(rangeFlag(p('2025-01-01', 5, undefined, 200))).toBeNull()
    expect(rangeFlag(p('2025-01-01', 35, 40))).toEqual({ side: 'below', basis: 'range' })
  })

  it('flags "<" and ">" results only when every possible value is outside', () => {
    expect(rangeFlag(p('2025-01-01', 0.5, 1, 5, { comparator: '<' }))).toEqual({ side: 'below', basis: 'range' })
    expect(rangeFlag(p('2025-01-01', 2, 1, 5, { comparator: '<' }))).toBeNull()
    expect(rangeFlag(p('2025-01-01', 1, 1, 5, { comparator: '≤' }))).toBeNull()
    expect(rangeFlag(p('2025-01-01', 90, 1, 60, { comparator: '>' }))).toEqual({ side: 'above', basis: 'range' })
    expect(rangeFlag(p('2025-01-01', 50, 1, 60, { comparator: '>' }))).toBeNull()
  })

  it("uses the lab's printed flag when no range was printed", () => {
    expect(rangeFlag(p('2025-01-01', 9, undefined, undefined, { flagAsPrinted: 'H' }))).toEqual({ side: 'above', basis: 'lab' })
    expect(rangeFlag(p('2025-01-01', 9, undefined, undefined, { flagAsPrinted: 'Baixo' }))).toEqual({ side: 'below', basis: 'lab' })
    expect(rangeFlag(p('2025-01-01', 9))).toBeNull()
  })

  it('shows both when the lab and the code disagree', () => {
    expect(rangeFlag(p('2025-01-01', 120, 70, 110, { flagAsPrinted: 'L' }))).toEqual({ side: 'above', basis: 'range', labDisagrees: true })
    expect(labFlagWithoutCodeFlag(p('2025-01-01', 100, 70, 110, { flagAsPrinted: 'H' }))).toBe('above')
    expect(labFlagWithoutCodeFlag(p('2025-01-01', 120, 70, 110, { flagAsPrinted: 'H' }))).toBeNull()
  })
})

describe('rule 2: changed notably since the previous result', () => {
  it('measures change against the newer range width', () => {
    // width 40: 25% is 10
    expect(changeSincePrevious([p('2024-01-01', 80, 70, 110), p('2025-01-01', 91, 70, 110)])?.notable).toBe(true)
    expect(changeSincePrevious([p('2024-01-01', 80, 70, 110), p('2025-01-01', 89, 70, 110)])?.notable).toBe(false)
  })

  it('uses the newer result range when two labs print different ranges', () => {
    const c = changeSincePrevious([p('2024-01-01', 40, 20, 80), p('2025-01-01', 50, 30, 100)])
    // width 70: 25% is 17.5, so +10 isn't notable
    expect(c).toMatchObject({ direction: 'up', notable: false, crossedRange: false })
    expect(c?.relative).toBeCloseTo(0.25)
  })

  it('falls back to the previous value without a two-sided range', () => {
    expect(changeSincePrevious([p('2024-01-01', 100, undefined, 200), p('2025-01-01', 126, undefined, 200)])?.notable).toBe(true)
    expect(changeSincePrevious([p('2024-01-01', 100, undefined, 200), p('2025-01-01', 120, undefined, 200)])?.notable).toBe(false)
  })

  it('always counts moving into or out of the range', () => {
    const c = changeSincePrevious([p('2024-01-01', 108, 70, 110), p('2025-01-01', 112, 70, 110)])
    expect(c).toMatchObject({ notable: true, crossedRange: true })
  })

  it('sorts by date and skips "<" results', () => {
    const c = changeSincePrevious([p('2025-01-01', 91, 70, 110), p('2023-01-01', 80, 70, 110), p('2025-06-01', 0.5, 70, 110, { comparator: '<' })])
    expect(c?.from.date).toBe('2023-01-01')
    expect(c?.to.date).toBe('2025-01-01')
  })

  it('needs two results', () => {
    expect(changeSincePrevious([p('2025-01-01', 91, 70, 110)])).toBeNull()
  })
})

describe('rule 3: moving steadily in one direction', () => {
  it('finds a run of three or more rises or falls', () => {
    const t = trend([p('2023-01-01', 80, 70, 110), p('2024-01-01', 85, 70, 110), p('2025-01-01', 92, 70, 110)])
    expect(t).toMatchObject({ direction: 'rising', results: 3 })
    const f = trend([p('2022-01-01', 50), p('2023-01-01', 40), p('2024-01-01', 35), p('2025-01-01', 30)])
    expect(f).toMatchObject({ direction: 'falling', results: 4 })
  })

  it('ignores small wobbles below the threshold', () => {
    // width 40: 10% is 4; a total rise of 3 doesn't count
    expect(trend([p('2023-01-01', 80, 70, 110), p('2024-01-01', 81, 70, 110), p('2025-01-01', 83, 70, 110)])).toBeNull()
  })

  it('needs the run to reach the latest result', () => {
    expect(trend([p('2022-01-01', 80, 70, 110), p('2023-01-01', 90, 70, 110), p('2024-01-01', 100, 70, 110), p('2025-01-01', 95, 70, 110)])).toBeNull()
  })

  it('counts only the run, not earlier results', () => {
    const t = trend([p('2021-01-01', 100), p('2022-01-01', 60), p('2023-01-01', 70), p('2024-01-01', 80)])
    expect(t).toMatchObject({ direction: 'rising', results: 3 })
  })

  it('needs at least three results and a change', () => {
    expect(trend([p('2024-01-01', 80), p('2025-01-01', 90)])).toBeNull()
    expect(trend([p('2023-01-01', 80), p('2024-01-01', 80), p('2025-01-01', 80)])).toBeNull()
  })
})

describe('series: mixed units from different labs', () => {
  const reports = new Map<string, Report>(
    [
      { id: 'us', date: '2023-05-01', lab: 'US lab' },
      { id: 'pt', date: '2025-05-01', lab: 'PT lab' },
    ].map((r) => [r.id, { ...r, profileId: 'x', source: 'manual', createdAt: '', updatedAt: '' } as Report]),
  )
  const result = (over: Partial<Result>): Result => ({ id: over.id!, reportId: 'us', profileId: 'x', nameAsPrinted: '', createdAt: '', updatedAt: '', ...over })

  it('converts values and each result range to the unit shown, then flags', () => {
    const results = [
      result({ id: 'a', reportId: 'us', markerId: 'glucose', value: 99, unitAsPrinted: 'mg/dL', range: { low: 70, high: 99, text: '70-99' } }),
      result({ id: 'b', reportId: 'pt', markerId: 'glucose', value: 6.1, unitAsPrinted: 'mmol/L', range: { low: 3.9, high: 5.5, text: '3,9 - 5,5' } }),
    ]
    const s = buildSeries('glucose', 'mmol/L', results, reports)
    expect(s.points).toHaveLength(2)
    expect(s.points[0].value).toBeCloseTo(99 * 0.0555)
    expect(s.points[0].range?.high).toBeCloseTo(99 * 0.0555)
    expect(rangeFlag(s.points[0])).toBeNull()
    expect(rangeFlag(s.points[1])).toEqual({ side: 'above', basis: 'range' })
  })

  it('shows BUN results on the urea chart, converted and marked', () => {
    const results = [
      result({ id: 'a', reportId: 'us', markerId: 'bun', value: 14, unitAsPrinted: 'mg/dL' }),
      result({ id: 'b', reportId: 'pt', markerId: 'urea', value: 32, unitAsPrinted: 'mg/dL' }),
    ]
    const s = buildSeries('urea', 'mg/dL', results, reports)
    expect(s.points).toHaveLength(2)
    expect(s.points[0].convertedFrom).toBe('BUN (urea nitrogen)')
    // 14 mg/dL of urea nitrogen is about 30 mg/dL of urea
    expect(s.points[0].value).toBeCloseTo(14 * 0.357 / 0.1665, 5)
    expect(s.points[0].value).toBeCloseTo(30, 0)
  })

  it('refuses to mix Lp(a) units', () => {
    const results = [
      result({ id: 'a', reportId: 'us', markerId: 'lpa', value: 30, unitAsPrinted: 'mg/dL' }),
      result({ id: 'b', reportId: 'pt', markerId: 'lpa', value: 75, unitAsPrinted: 'nmol/L' }),
    ]
    const s = buildSeries('lpa', 'nmol/L', results, reports)
    expect(s.points.map((x) => x.resultId)).toEqual(['b'])
    expect(s.skipped).toEqual([{ resultId: 'a', reason: 'no-conversion' }])
  })
})
