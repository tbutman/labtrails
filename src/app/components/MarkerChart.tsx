// One marker over time. Each result is drawn against its own lab's range (a pale bar behind the point),
// because ranges differ between labs; there's no single "normal" band. Results outside their range get
// a ring with "!" as well as the words in the list below, so the chart never relies on colour.
// Timeline entries (SPEC.md section 18.1) run as thin bands above the plot, named in the chart's text
// description and in a list under it.

import { useLayoutEffect, useRef, useState } from 'react'
import { rangeFlag } from '../../labs/flags/flags'
import type { SeriesPoint } from '../../labs/series'
import { formatDate, formatPoint, formatRange, formatValue } from '../format'

const H = 240
const PAD = { top: 16, right: 16, bottom: 32, left: 48 }

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v < max + step; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000

/** The chart is drawn at its container's width, so labels stay readable on a phone. */
function useWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** A timeline entry on the chart: first and last day it covers (no last day while it's ongoing). */
export type ChartEvent = { id: string; label: string; period: string; from: string; to?: string }

type ChartProps = { points: SeriesPoint[]; unit: string; label: string; contextDates?: string[]; events?: ChartEvent[] }

const LANE = 9
const MAX_LANES = 4

/** Entries that overlap the chart's dates, each in the first lane where it doesn't overlap another. */
function laneEvents(events: ChartEvent[], first: string, last: string) {
  const shown = events.filter((e) => e.from <= last && (!e.to || e.to >= first)).sort((a, b) => a.from.localeCompare(b.from))
  const ends: string[] = []
  return shown.flatMap((e) => {
    let lane = ends.findIndex((end) => end < e.from)
    if (lane === -1) lane = ends.length
    if (lane >= MAX_LANES) return []
    ends[lane] = e.to ?? '9999-12-31'
    return [{ ...e, lane }]
  })
}

export function MarkerChart(props: ChartProps) {
  const [ref, width] = useWidth()
  if (props.points.length === 0) return <p className="muted">No results to chart in {props.unit}.</p>
  const lanes = props.points.length > 1 ? laneEvents(props.events ?? [], props.points[0].date, props.points.at(-1)!.date) : []
  return (
    <div ref={ref}>
      <ChartSvg {...props} lanes={lanes} W={width} />
      {lanes.length > 0 && (
        <ul className="chart-events" aria-label="Timeline on this chart">
          {lanes.map((e) => (
            <li key={e.id}>
              <span className="chart-event-swatch" aria-hidden />
              {e.label} <span className="faint">({e.period})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChartSvg({ points, unit, label, contextDates = [], lanes, W }: ChartProps & { W: number; lanes: (ChartEvent & { lane: number })[] }) {
  const laneCount = lanes.length ? Math.max(...lanes.map((e) => e.lane)) + 1 : 0
  const top = PAD.top + laneCount * LANE

  const values = points.flatMap((p) => [p.value, p.range?.low, p.range?.high]).filter((v): v is number => v !== undefined)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1
  lo = Math.max(lo - pad, Math.min(...values) >= 0 ? 0 : -Infinity)
  hi = hi + pad
  const ticks = niceTicks(lo, hi)
  lo = Math.min(lo, ticks[0])
  hi = Math.max(hi, ticks.at(-1)!)

  const d0 = day(points[0].date)
  const d1 = day(points.at(-1)!.date)
  const span = d1 - d0 || 1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - top - PAD.bottom
  const x = (iso: string) => (points.length === 1 ? PAD.left + innerW / 2 : PAD.left + ((day(iso) - d0) / span) * innerW)
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * innerH

  // One label per year at 1 January. The first year's label sits at the first result instead, and gives
  // way to the next year's if they'd overlap.
  const yearLabels: { yr: string; xx: number }[] = []
  for (const yr of new Set(points.map((p) => p.date.slice(0, 4)))) {
    const jan1 = day(`${yr}-01-01`)
    const xx = jan1 < d0 ? x(points[0].date) : x(`${yr}-01-01`)
    const prev = yearLabels.at(-1)
    if (prev && xx - prev.xx < 36) {
      if (yearLabels.length === 1) yearLabels[0] = { yr, xx }
      continue
    }
    yearLabels.push({ yr, xx })
  }
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const barW = 12
  const flaggedCount = points.filter((p) => rangeFlag(p)?.basis === 'range').length

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label} in ${unit}: ${points.length} results from ${formatDate(points[0].date)} to ${formatDate(points.at(-1)!.date)}, latest ${formatPoint(points.at(-1)!)}. ${flaggedCount} outside their lab's range.${lanes.length ? ` Timeline: ${lanes.map((e) => `${e.label}, ${e.period}`).join('; ')}.` : ''} The full list follows the chart.`}
    >
      {lanes.map((e) => {
        const x0 = e.from <= points[0].date ? PAD.left : x(e.from)
        const x1 = !e.to || e.to >= points.at(-1)!.date ? W - PAD.right : x(e.to)
        const yy = PAD.top - 6 + e.lane * LANE
        return (
          <g key={e.id} className="timeline-band">
            <title>{`${e.label} (${e.period})`}</title>
            <rect x={x0} y={yy} width={Math.max(x1 - x0, 4)} height={5} rx={2.5} />
            {e.from > points[0].date && <circle cx={x0} cy={yy + 2.5} r={4} />}
          </g>
        )
      })}
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
            {formatValue(t)}
          </text>
        </g>
      ))}
      {yearLabels.map(({ yr, xx }) => (
        <text key={yr} x={xx} y={H - 8} textAnchor={points.length === 1 ? 'middle' : 'start'}>
          {yr}
        </text>
      ))}

      {points.map((p) => {
        if (!p.range) return null
        const top = y(p.range.high ?? hi)
        const bottom = y(p.range.low ?? lo)
        return <rect key={`r-${p.resultId}`} className="range" x={x(p.date) - barW / 2} y={top} width={barW} height={Math.max(bottom - top, 2)} rx={barW / 2} />
      })}

      {points.length > 1 && <path className="line" d={line} />}

      {points.map((p) => {
        const flagged = rangeFlag(p)?.basis === 'range'
        const cx = x(p.date)
        const cy = y(p.value)
        return (
          <g key={p.resultId}>
            {flagged ? (
              <>
                <circle className="ring" cx={cx} cy={cy} r={8} />
                <text className="ring-mark" x={cx} y={cy + 3.5} textAnchor="middle">
                  !
                </text>
              </>
            ) : (
              <circle className={p.comparator ? 'point open' : 'point'} cx={cx} cy={cy} r={5} />
            )}
            {contextDates.includes(p.date) && <circle className="context" cx={cx} cy={top + innerH + 6} r={2.5} />}
          </g>
        )
      })}
    </svg>
  )
}

export function ResultsList({ points, unit }: { points: SeriesPoint[]; unit: string }) {
  return (
    <div className="card padless">
      <ul className="list">
        {[...points].reverse().map((p) => {
          const f = rangeFlag(p)
          return (
            <li key={p.resultId} className="list-row">
              <span className="list-row-main">
                <span className="list-row-title">{formatDate(p.date)}</span>
                <span className="list-row-sub">
                  Lab's range {formatRange(p.range)}
                  {p.convertedFrom && ` · converted from ${p.convertedFrom}`}
                  {f?.labDisagrees && ' · the lab printed a different flag'}
                </span>
              </span>
              {f && <span className="chip flag">! {f.side === 'above' ? 'Above' : 'Below'}</span>}
              <span className="result-value">
                {formatPoint(p)} <span className="unit">{unit}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
