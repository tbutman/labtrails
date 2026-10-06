// How flags appear everywhere in the app. Wording follows SPEC.md section 9: "outside the lab's
// range", "changed since last time", "rising", never "abnormal" or a verdict. Each flag has an icon and
// words, so it never depends on colour.

import { CircleAlert, MoveDownRight, MoveUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import type { MarkerAnalysis } from '../../labs/analysis'
import { Chip } from '../../core/ui/components'
import { formatPercent } from '../format'

export function MarkerFlags({ a, compact = false }: { a: MarkerAnalysis; compact?: boolean }) {
  return (
    <>
      {a.latestFlag && (
        <Chip tone="flag" icon={CircleAlert}>
          {a.latestFlag.basis === 'lab'
            ? `Lab marked it ${a.latestFlag.side === 'above' ? 'high' : 'low'}`
            : compact
              ? `${a.latestFlag.side === 'above' ? 'Above' : 'Below'} lab range`
              : `Outside the lab's range (${a.latestFlag.side})`}
        </Chip>
      )}
      {a.labOnlyFlag && (
        <Chip tone="outline" icon={CircleAlert}>
          Lab marked it {a.labOnlyFlag === 'above' ? 'high' : 'low'}
        </Chip>
      )}
      {a.change?.notable && (
        <Chip icon={a.change.direction === 'down' ? MoveDownRight : MoveUpRight}>
          {compact ? 'Changed' : 'Changed since last time'}
          {a.change.relative !== null && ` ${a.change.direction === 'up' ? '+' : '−'}${formatPercent(a.change.relative)}`}
        </Chip>
      )}
      {a.trend && (
        <Chip icon={a.trend.direction === 'rising' ? TrendingUp : TrendingDown}>
          {a.trend.direction === 'rising' ? 'Rising' : 'Falling'}
          {compact ? ` · ${a.trend.results}` : ` over the last ${a.trend.results} results`}
        </Chip>
      )}
    </>
  )
}

export const DISCLAIMER =
  "LabTrails records and charts results; it doesn't diagnose anything or give medical advice. Flags are simple rules about the lab's own range and changes over time. Discuss your results with your doctor."
