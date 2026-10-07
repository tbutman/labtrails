import { describe, expect, it } from 'vitest'
import { DEMO_REPORTS, DEMO_RESULTS } from '../../src/app/demo'
import { analyse } from '../../src/labs/analysis'
import { REPORT_FOOTER, reportHeader, reportRows } from '../../src/app/report/ReportSheet'

const markers = analyse(DEMO_RESULTS, DEMO_REPORTS).flatMap((p) => p.markers)
const rows = reportRows(markers, DEMO_REPORTS, [])
const row = (id: string) => rows.find((r) => r.id === id)!

describe('the doctor report', () => {
  it('dates each row and shows the previous result', () => {
    expect(row('glucose')).toMatchObject({ latest: '6.2 mmol/L', range: '3.6–6 mmol/L', outside: true })
    expect(row('glucose').date).toMatch(/^Jun 9, 2026 · /)
    expect(row('glucose').previous).toBe('Previous: 5.8 (Nov 4, 2025)')
  })

  it('says when a value was converted, and when a result is back inside the range', () => {
    expect(row('crp').notes).toContain("Back inside the lab's range")
    const converted = rows.find((r) => r.notes.some((n) => n.startsWith('converted from')))
    expect(converted ?? null).toBeNull() // the demo's latest results are all in the unit shown
  })

  it("shows the lab's own marks, including one without a range", () => {
    const results = DEMO_RESULTS.map((r) => (r.reportId === 'r6' && r.markerId === 'glucose' ? { ...r, value: 34, flagAsPrinted: 'HH' } : r))
    const m = analyse(results, DEMO_REPORTS).flatMap((p) => p.markers)
    const g = reportRows(m, DEMO_REPORTS, []).find((r) => r.id === 'glucose')!
    expect(g.notes).toEqual(expect.arrayContaining(['! The lab marked this result as critical', "Lab's mark: HH"]))
  })

  it('says what it covers, who prepared it and when', () => {
    expect(reportHeader(DEMO_REPORTS, '2026-10-07', { age: 41, sex: 'female' })).toBe(
      'Results from Sep 14, 2023 to Jun 9, 2026 · 6 reports · Prepared by the patient on Oct 7, 2026 · age 41 · female',
    )
    expect(reportHeader(DEMO_REPORTS, '2026-10-07')).not.toMatch(/age|female|male/)
    expect(REPORT_FOOTER).not.toMatch(/Discuss your results with your doctor/)
  })
})
