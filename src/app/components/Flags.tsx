// How flags appear everywhere in the app. Wording follows SPEC.md section 9: "outside the lab's
// range", "changed since last time", "rising", never "abnormal" or a verdict. Each flag has an icon
// and words, so it never depends on colour.

import type { MarkerAnalysis } from '../../labs/analysis'
import { formatPercent } from '../format'

function Icon({ kind }: { kind: 'range' | 'up' | 'down' | 'changed' }) {
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }
  if (kind === 'range')
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 4v3.5M7 9.8v.2" />
      </svg>
    )
  if (kind === 'changed')
    return (
      <svg {...common}>
        <path d="M2 9l3-3 2.5 2.5L12 4" />
      </svg>
    )
  return <svg {...common}>{kind === 'up' ? <path d="M7 12V2M3 6l4-4 4 4" /> : <path d="M7 2v10M3 8l4 4 4-4" />}</svg>
}

export function RangeFlagBadge({ side, basis }: { side: 'above' | 'below'; basis: 'range' | 'lab' }) {
  return (
    <span className="flag range">
      <Icon kind="range" />
      {basis === 'lab' ? `Lab marked it ${side === 'above' ? 'high' : 'low'}` : `Outside the lab's range (${side})`}
    </span>
  )
}

export function MarkerFlags({ a }: { a: MarkerAnalysis }) {
  return (
    <>
      {a.latestFlag && <RangeFlagBadge side={a.latestFlag.side} basis={a.latestFlag.basis} />}
      {a.labOnlyFlag && (
        <span className="flag neutral">
          <Icon kind="range" />
          Lab marked it {a.labOnlyFlag === 'above' ? 'high' : 'low'}; inside the printed range
        </span>
      )}
      {a.change?.notable && (
        <span className="flag neutral">
          <Icon kind="changed" />
          Changed since last time
          {a.change.relative !== null && ` (${a.change.direction === 'up' ? 'up' : 'down'} ${formatPercent(a.change.relative)})`}
        </span>
      )}
      {a.trend && (
        <span className="flag neutral">
          <Icon kind={a.trend.direction === 'rising' ? 'up' : 'down'} />
          {a.trend.direction === 'rising' ? 'Rising' : 'Falling'} over the last {a.trend.results} results
        </span>
      )}
    </>
  )
}

export const DISCLAIMER =
  "LabTrails records and charts results; it doesn't diagnose anything or give medical advice. Flags are simple rules about the lab's own range and changes over time. Discuss your results with your doctor."
