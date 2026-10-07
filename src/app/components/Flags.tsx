// How flags appear everywhere in the app. Wording follows SPEC.md sections 9 and 18.2: "outside the
// lab's range" (and for how many tests in a row), "changed since last time", "rising", never
// "abnormal" or a verdict. Each flag has an icon and
// words, so it never depends on colour.

import { CircleAlert, Minus, MoveDownRight, MoveUpRight, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import type { MarkerAnalysis } from '../../labs/analysis'
import { Callout, Chip } from '../../core/ui/components'
import { formatValue } from '../format'

export function MarkerFlags({ a, compact = false, line }: { a: MarkerAnalysis; compact?: boolean; line?: { side: 'above' | 'below'; label: string } | null }) {
  return (
    <>
      {a.latestCritical && (
        <Chip tone="flag" icon={TriangleAlert}>
          {a.latestCritical.labMarked
            ? compact
              ? 'Lab marked critical'
              : 'The lab marked this result as critical'
            : compact
              ? 'Far outside lab range'
              : "Far outside the lab's range"}
        </Chip>
      )}
      {line && (
        <Chip tone="outline" icon={Minus}>
          {line.side === 'above' ? 'Above' : 'Below'} your line{compact ? '' : ` (${line.label})`}
        </Chip>
      )}
      {a.latestFlag && (
        <Chip tone="flag" icon={CircleAlert}>
          {a.latestFlag.basis === 'lab'
            ? `Lab marked it ${a.latestFlag.side === 'above' ? 'high' : 'low'}`
            : compact
              ? `${a.latestFlag.side === 'above' ? 'Above' : 'Below'} lab range${a.persistent ? ` · ${a.persistent.results} tests` : ''}`
              : `Outside the lab's range (${a.latestFlag.side})${a.persistent ? ` on the last ${a.persistent.results} tests` : ''}`}
        </Chip>
      )}
      {a.labOnlyFlag && (
        <Chip tone="outline" icon={CircleAlert}>
          Lab marked it {a.labOnlyFlag === 'above' ? 'high' : 'low'}
        </Chip>
      )}
      {a.change?.notable && (
        <Chip icon={a.change.direction === 'down' ? MoveDownRight : MoveUpRight}>
          {a.change.crossedRange && !a.latestFlag ? "Back inside the lab's range · " : compact ? 'Changed ' : 'Changed since last time '}
          {changeAmount(a)}
        </Chip>
      )}
      {a.trend && (
        <Chip icon={a.trend.direction === 'rising' ? TrendingUp : TrendingDown}>
          {a.trend.direction === 'rising' ? 'Rising' : 'Falling'}
          {compact ? ` over ${a.trend.results} tests` : ` over the last ${a.trend.results} results`}
        </Chip>
      )}
    </>
  )
}

/** A change in the unit shown: "+1.2 mmol/L", "−30 mg/dL". */
export function changeAmount(a: MarkerAnalysis): string {
  if (!a.change) return ''
  const sign = a.change.delta > 0 ? '+' : a.change.delta < 0 ? '−' : ''
  return `${sign}${formatValue(Math.abs(a.change.delta))} ${a.series.unit}`
}

export const DISCLAIMER =
  "LabTrails keeps records and draws charts. It doesn't diagnose or give medical advice; talk to your doctor about anything that worries you. Flags are simple rules about the lab's own range and changes over time."

/** Shown under a result the lab marked critical or that's far outside its range (LAB-01). Fixed wording. */
export const CRITICAL_TEXT =
  "This result is far outside the lab's range. First check it matches the report (the number and the unit). If it does and no doctor has talked to you about it yet, contact your doctor or the lab today. If you feel unwell, call your local emergency number."

/** CRITICAL_TEXT for several results at once, on the overview. */
export const CRITICAL_TEXT_MANY =
  "These results are far outside the lab's range. First check each one matches the report (the number and the unit). If it does and no doctor has talked to you about it yet, contact your doctor or the lab today. If you feel unwell, call your local emergency number."

export function CriticalNotice({ a }: { a: MarkerAnalysis }) {
  if (!a.latestCritical) return null
  return (
    <Callout icon={TriangleAlert} tone="warning">
      {a.latestCritical.labMarked && <strong>The lab marked this result as critical. </strong>}
      {CRITICAL_TEXT}
    </Callout>
  )
}

/** "Lab's mark: HH", as printed, or nothing when the lab printed no mark. */
export function labMarkText(flag: string | undefined): string | null {
  const f = flag?.trim()
  return f ? `Lab's mark: ${f}` : null
}

/** The public page "What 'outside the range' means" cites (LAB-06), shown the way influences are cited. */
export const RANGE_SOURCE = { title: 'MedlinePlus: How to Understand Your Lab Results', url: 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/' }

export function RangeMeaning() {
  return (
    <p className="hint range-meaning">
      <strong>What “outside the range” means.</strong> A lab's range is where most healthy people's results fall, so some healthy people are just outside it. Food,
      exercise, a recent illness or the time of day can move a result too. A result outside the range is worth bringing to your doctor, who can read it with your
      history.{' '}
      <a href={RANGE_SOURCE.url} target="_blank" rel="noreferrer noopener">
        {RANGE_SOURCE.title}
      </a>
    </p>
  )
}
