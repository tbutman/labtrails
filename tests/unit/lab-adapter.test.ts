import { describe, expect, it } from 'vitest'
import { savedSummary } from '../../src/app/import/labAdapter'

describe('the summary after saving an import', () => {
  it('names the date, or for a cumulative report how many reports and which dates', () => {
    expect(savedSummary(12, ['2026-09-15'])).toBe('12 results on 15 Sept 2026')
    expect(savedSummary(48, ['2026-09-15', '2024-03-03', '2025-01-10', '2025-06-01'])).toBe('48 results in 4 reports, 3 Mar 2024 to 15 Sept 2026')
    expect(savedSummary(1, [])).toBe('1 result')
  })
})
