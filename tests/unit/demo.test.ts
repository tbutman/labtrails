import { describe, expect, it } from 'vitest'
import { analyse, unmapped } from '../../src/labs/analysis'
import { DEMO_REPORTS, DEMO_RESULTS, DEMO_SUMMARIES } from '../../src/app/demo'
import { bannedPhrase } from '../../src/core/ask/wording'

// The demo is what portfolio visitors see, so its data must show what the summaries claim.
describe('demo data', () => {
  const panels = analyse(DEMO_RESULTS, DEMO_REPORTS)
  const get = (id: string) => panels.flatMap((p) => p.markers).find((m) => m.marker.id === id)!

  it('maps every printed name except the deliberately unknown one', () => {
    expect(unmapped(DEMO_RESULTS).map((r) => r.nameAsPrinted)).toEqual(['Cystatin C', 'Cystatin C', 'Cystatin C', 'Cystatin C'])
  })

  it('flags the latest glucose as above the range, with a rising trend', () => {
    expect(get('glucose').latestFlag?.side).toBe('above')
    expect(get('glucose').trend).toMatchObject({ direction: 'rising', results: 6 })
    expect(get('glucose').change?.crossedRange).toBe(true)
  })

  it('shows ferritin falling but inside the range', () => {
    expect(get('ferritin').latestFlag).toBeNull()
    expect(get('ferritin').trend).toMatchObject({ direction: 'falling', results: 6 })
  })

  it('shows LDL above the range and rising', () => {
    expect(get('ldl').latestFlag?.side).toBe('above')
    expect(get('ldl').trend?.direction).toBe('rising')
  })

  it('charts BUN and urea together under urea', () => {
    const urea = get('urea')
    expect(urea.series.points).toHaveLength(6)
    expect(urea.series.points.filter((p) => p.convertedFrom)).toHaveLength(2)
    expect(panels.flatMap((p) => p.markers).some((m) => m.marker.id === 'bun')).toBe(false)
  })

  it('reads the "<0.5" CRP result as a comparator, not a value', () => {
    const crp = get('crp').series.points.find((p) => p.date === '2024-10-08')!
    expect(crp).toMatchObject({ value: 0.5, comparator: '<' })
    expect(get('crp').latestFlag).toBeNull()
  })

  it('shows TSH from both labs in one unit', () => {
    expect(get('tsh').series.points).toHaveLength(6)
    expect(get('tsh').series.skipped).toEqual([])
  })

  it('charts US and UK results together, in the UK unit of the latest test', () => {
    expect(get('glucose').series.unit).toBe('mmol/L')
    expect(get('glucose').series.points).toHaveLength(6)
    expect(get('glucose').series.points[0].value).toBeCloseTo(88 / 18.016, 2)
    expect(get('vitamin-d').latest?.range).toMatchObject({ low: 75, high: 200 })
  })
})

// Every flag the code raises on the demo, so the pre-written summaries can't drift from the data.
describe('demo flags match the pre-written summaries', () => {
  it('raises exactly these flags', () => {
    const flags = analyse(DEMO_RESULTS, DEMO_REPORTS)
      .flatMap((p) => p.markers)
      .map((m) => [m.marker.id, [m.latestFlag && `outside:${m.latestFlag.side}`, m.persistent && `persistent:${m.persistent.results}`, m.change?.notable && `changed:${m.change.direction}`, m.trend && `${m.trend.direction}:${m.trend.results}`].filter(Boolean).join(' ')])
      .filter(([, f]) => f)
    expect(Object.fromEntries(flags)).toEqual({
      glucose: 'outside:above changed:up rising:6',
      hba1c: 'rising:4',
      'cholesterol-total': 'outside:above persistent:4 rising:6',
      ldl: 'outside:above persistent:6 rising:6',
      triglycerides: 'changed:down',
      ferritin: 'falling:6',
      'vitamin-d': 'rising:4',
      crp: 'changed:down',
    })
  })
})

describe('the demo summaries use no banned wording (CORE-04)', () => {
  it('passes the same check as real summaries', () => {
    for (const s of DEMO_SUMMARIES) expect(bannedPhrase(s.text), s.id).toBeUndefined()
  })
})
