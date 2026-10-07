import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReviewPanel } from '../../src/core/review/ReviewPanel'
import { blankRow, confirmedRows, detectDateOrder, initRows, needsDateOrder, normaliseNumber, parseDate, rowErrors, type Column } from '../../src/core/review/model'

const columns: Column[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'weightKg', label: 'Weight', type: 'number', unit: 'kg', validate: (v) => (Number(v) > 40 ? 'Too heavy?' : undefined) },
]

describe('review', () => {
  it('passes on nothing until the user accepts a row', () => {
    const rows = initRows(
      [
        { values: { date: '2026-09-01', weightKg: '7,25' }, confidence: 'high' },
        { values: { date: '2026-08-01', weightKg: 6.9 }, confidence: 'low' },
      ],
      columns,
    )
    expect(rows[0].values.weightKg).toBe('7.25')
    expect(confirmedRows(rows, columns)).toEqual([])
    rows[1].status = 'rejected'
    expect(confirmedRows(rows, columns)).toEqual([])
    rows[0].status = 'accepted'
    expect(confirmedRows(rows, columns)).toEqual([{ date: '2026-09-01', weightKg: 7.25, sourceText: undefined, page: undefined }])
  })

  it('drops accepted rows that fail a check', () => {
    const [row] = initRows([{ values: { date: '2026-09-01', weightKg: '72,5' }, confidence: 'high' }], columns)
    row.status = 'accepted'
    expect(rowErrors(row, columns)).toEqual({ weightKg: 'Too heavy?' })
    expect(confirmedRows([row], columns)).toEqual([])
  })

  it('gives validators cleaned values', () => {
    const seen: string[] = []
    const cols: Column[] = [
      { key: 'date', label: 'Date', type: 'date', validate: (v) => void seen.push(v) as undefined },
      { key: 'n', label: 'N', type: 'number', validate: (v) => void seen.push(v) as undefined },
    ]
    const [row] = initRows([{ values: { date: '25/09/2026', n: '1,5' }, confidence: 'high' }], cols)
    rowErrors(row, cols)
    expect(seen).toEqual(['2026-09-25', '1.5'])
  })

  it('requires required fields on rows the user adds', () => {
    const row = { ...blankRow(columns), status: 'accepted' as const }
    expect(rowErrors(row, columns).date).toBe('Date is needed.')
    expect(confirmedRows([row], columns)).toEqual([])
  })

  it('normalises decimal commas and thousands separators', () => {
    expect(normaliseNumber('5,4')).toBe('5.4')
    expect(normaliseNumber(' 7.25 ')).toBe('7.25')
    expect(normaliseNumber('1.234,5')).toBe('1234.5')
    expect(normaliseNumber('1,234.5')).toBe('1234.5')
  })

  it('reads dates, and asks when day and month could be either', () => {
    expect(parseDate('2026-09-01')).toBe('2026-09-01')
    expect(parseDate('25/09/2026')).toBe('2026-09-25')
    expect(parseDate('09/25/2026')).toBe('2026-09-25')
    expect(parseDate('03/04/2026')).toBeUndefined()
    expect(parseDate('03/04/2026', 'dmy')).toBe('2026-04-03')
    expect(parseDate('03/04/2026', 'mdy')).toBe('2026-03-04')
    expect(parseDate('3.4.26', 'dmy')).toBe('2026-04-03')
    expect(parseDate('31/02/2026', 'dmy')).toBeUndefined()
    expect(detectDateOrder(['03/04/2026', '25/04/2026'])).toBe('dmy')
    expect(detectDateOrder(['03/04/2026', '04/25/2026'])).toBe('mdy')
    expect(needsDateOrder(['03/04/2026'])).toBe(true)
    expect(needsDateOrder(['2026-04-03', '05/05/2026'])).toBe(false)
  })

  it('shows each date as printed next to how it was read (Q1)', () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPanel, { columns, proposed: [{ values: { date: '02.10.26', weightKg: '5.1' }, confidence: 'high' }, { values: { date: '25.10.26' }, confidence: 'high' }], onConfirm: () => {}, onCancel: () => {} }),
    )
    expect(html).toContain('02.10.26 → Oct 2, 2026')
    expect(html).toContain('25.10.26 → Oct 25, 2026')
  })
})
