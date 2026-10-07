import { describe, expect, it } from 'vitest'
import { activeBetween, activeOn, entryFromInput, entryLabel, firstDay, inputFromEntry, lastDay, startedBetween, validateEntry, type TimelineEntry } from '../../src/labs/timeline'

const entry = (over: Partial<TimelineEntry>): TimelineEntry => ({ id: 'e', profileId: 'p', kind: 'medication', name: 'Medicine X', start: '2026-06-01', createdAt: 'x', updatedAt: 'x', ...over })

describe('the personal timeline', () => {
  it('reads a month-only date as the whole month', () => {
    expect(firstDay('2024-11')).toBe('2024-11-01')
    expect(lastDay('2024-02')).toBe('2024-02-29')
    expect(lastDay('2026-06-15')).toBe('2026-06-15')
  })

  it('knows what was active on a day and over a period', () => {
    const ongoing = entry({ id: 'a', start: '2026-06' })
    const ended = entry({ id: 'b', start: '2025-01-10', end: '2025-03' })
    expect(activeOn([ongoing, ended], '2026-06-01').map((e) => e.id)).toEqual(['a'])
    expect(activeOn([ongoing, ended], '2025-03-31').map((e) => e.id)).toEqual(['b'])
    expect(activeOn([ongoing, ended], '2025-04-01')).toEqual([])
    expect(activeBetween([ongoing, ended], '2025-03-15', '2026-05-31').map((e) => e.id)).toEqual(['b'])
  })

  it('finds what started between two tests', () => {
    const e = [entry({ id: 'a', start: '2026-06-01' }), entry({ id: 'b', start: '2025-01' })]
    expect(startedBetween(e, '2026-05-23', '2026-06-24').map((x) => x.id)).toEqual(['a'])
    expect(startedBetween(e, undefined, '2025-06-01').map((x) => x.id)).toEqual(['b'])
  })

  it('labels an entry with its dose and schedule', () => {
    expect(entryLabel({ name: 'Vitamin D3', dose: '2,000 IU', every: { n: 1, unit: 'day' } })).toBe('Vitamin D3 2,000 IU, every day')
    expect(entryLabel({ name: 'Injection', dose: '250 mg', every: { n: 4, unit: 'week' } })).toBe('Injection 250 mg, every 4 weeks')
    expect(entryLabel({ name: 'Stopped alcohol' })).toBe('Stopped alcohol')
  })

  it('checks the input and builds the entry from it', () => {
    const input = { ...inputFromEntry(), name: ' Vitamin D3 ', start: '2024-11', dose: '2,000 IU', everyN: '1', kind: 'supplement' as const }
    expect(validateEntry({ ...input, name: '' })).toMatch(/name/)
    expect(validateEntry({ ...input, start: '' })).toMatch(/started/)
    expect(validateEntry({ ...input, end: '2024-10' })).toMatch(/ends before/)
    expect(validateEntry({ ...input, everyN: '1.5' })).toMatch(/whole number/)
    expect(validateEntry(input)).toBeNull()
    expect(entryFromInput(input, { id: 'n', profileId: 'p', createdAt: 'then' }, 'now')).toEqual({
      id: 'n',
      profileId: 'p',
      createdAt: 'then',
      updatedAt: 'now',
      kind: 'supplement',
      name: 'Vitamin D3',
      start: '2024-11',
      dose: '2,000 IU',
      every: { n: 1, unit: 'day' },
    })
  })
})
