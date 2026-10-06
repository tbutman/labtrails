import type { MarkerAnalysis } from '../labs/analysis'
import { rangeFlag } from '../labs/flags/flags'
import type { SparkPoint } from '../core/ui/components'

/** A marker's last results as sparkline points, each with its own range, flagged ones marked. */
export function sparkPoints(a: MarkerAnalysis, last = 8): SparkPoint[] {
  return a.series.points.slice(-last).map((p) => ({
    value: p.value,
    ...(p.range?.low !== undefined ? { low: p.range.low } : {}),
    ...(p.range?.high !== undefined ? { high: p.range.high } : {}),
    flagged: rangeFlag(p)?.basis === 'range',
  }))
}
