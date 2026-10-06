// One marker over time. Each result is drawn against its own lab's range (a pale bar behind the point),
// because ranges differ between labs; there's no single "normal" band. Results outside their range get
// a ring with "!" as well as the words in the list below, so the chart never relies on colour.

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

type ChartProps = { points: SeriesPoint[]; unit: string; label: string; contextDates?: string[] }

export function MarkerChart(props: ChartProps) {
  const [ref, width] = useWidth()
  if (props.points.length === 0) return <p className="muted">No results to chart in {props.unit}.</p>
  return (
    <div ref={ref}>
      <ChartSvg {...props} W={width} />
    </div>
  )
}

function ChartSvg({ points, unit, label, contextDates = [], W }: ChartProps & { W: number }) {

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
  const innerH = H - PAD.top - PAD.bottom
  const x = (iso: string) => (points.length === 1 ? PAD.left + innerW / 2 : PAD.left + ((day(iso) - d0) / span) * innerW)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH

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
      aria-label={`${label} in ${unit}: ${points.length} results from ${formatDate(points[0].date)} to ${formatDate(points.at(-1)!.date)}, latest ${formatPoint(points.at(-1)!)}. ${flaggedCount} outside their lab's range. The full list follows the chart.`}
    >
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
            {contextDates.includes(p.date) && <circle className="context" cx={cx} cy={PAD.top + innerH + 6} r={2.5} />}
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
