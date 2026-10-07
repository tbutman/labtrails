import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEMO_REPORTS, DEMO_RESULTS } from '../../src/app/demo'
import { analyse } from '../../src/labs/analysis'
import { CriticalNotice } from '../../src/app/components/Flags'

const glucose = (over: { value: number; flagAsPrinted?: string }) =>
  analyse(
    DEMO_RESULTS.map((r) => (r.reportId === 'r6' && r.markerId === 'glucose' ? { ...r, ...over } : r)),
    DEMO_REPORTS,
  )
    .flatMap((p) => p.markers)
    .find((a) => a.marker.id === 'glucose')!

describe('the critical notice says "far outside" only when it is (CHK-03)', () => {
  it('a lab mark on a result just outside the range: the mark, then what to do', () => {
    const html = renderToStaticMarkup(<CriticalNotice a={glucose({ value: 6.3, flagAsPrinted: 'HH' })} />)
    expect(html).toContain('The lab marked this result as critical.')
    expect(html).toContain('First check it matches the report')
    expect(html).not.toContain('far outside')
  })

  it('a result far outside the range keeps the full text', () => {
    const html = renderToStaticMarkup(<CriticalNotice a={glucose({ value: 34 })} />)
    expect(html).toContain('This result is far outside the lab&#x27;s range.')
  })
})
