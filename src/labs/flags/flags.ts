// The three flag rules. The code decides what's flagged; the AI only explains it. Every rule works on
// one marker's results for one person, already converted to one unit, each result with its own range
// (ranges differ between labs, so there's no single "normal" band).

import type { Comparator } from '../units/parse'

export type Point = {
  date: string // ISO YYYY-MM-DD
  value: number
  comparator?: Comparator
  range?: { low?: number; high?: number }
  flagAsPrinted?: string
}

/**
 * Thresholds for the "changed" and "trend" rules. They're simple heuristics chosen for clarity, not
 * clinical thresholds, and the app says so. Later: per-marker thresholds from published biological
 * variation ("reference change values").
 */
export const CHANGE_THRESHOLD = 0.25
export const TREND_THRESHOLD = 0.1
export const TREND_MIN_RESULTS = 3

export type RangeFlag = {
  side: 'above' | 'below'
  /** "range": the code compared the value with the printed range; "lab": no usable range, so the lab's printed H or L. */
  basis: 'range' | 'lab'
  /** The lab printed a flag that disagrees with the code's reading of the range. */
  labDisagrees?: boolean
}

function labSide(flag: string | undefined): 'above' | 'below' | undefined {
  if (!flag) return undefined
  const f = flag.trim().toUpperCase()
  if (/^(H|HH|HIGH|ALTO|ELEVADO|↑|\*H)$/.test(f)) return 'above'
  if (/^(L|LL|LOW|BAIXO|DIMINUIDO|DIMINUÍDO|↓|\*L)$/.test(f)) return 'below'
  return undefined
}

/**
 * Rule 1: outside the lab's range. A result like "<0.5" is flagged only when every value it could be
 * is outside the range.
 */
export function rangeFlag(p: Point): RangeFlag | null {
  const { low, high } = p.range ?? {}
  const lab = labSide(p.flagAsPrinted)
  if (low === undefined && high === undefined) return lab ? { side: lab, basis: 'lab' } : null

  let side: 'above' | 'below' | undefined
  switch (p.comparator) {
    case '<':
      if (low !== undefined && p.value <= low) side = 'below'
      break
    case '≤':
      if (low !== undefined && p.value < low) side = 'below'
      break
    case '>':
      if (high !== undefined && p.value >= high) side = 'above'
      break
    case '≥':
      if (high !== undefined && p.value > high) side = 'above'
      break
    default:
      if (low !== undefined && p.value < low) side = 'below'
      else if (high !== undefined && p.value > high) side = 'above'
  }

  const labDisagrees = lab !== undefined && lab !== side
  if (!side) return null
  return { side, basis: 'range', ...(labDisagrees ? { labDisagrees: true } : {}) }
}

/** Whether the lab printed a flag that the code's reading of the range doesn't support. */
export function labFlagWithoutCodeFlag(p: Point): 'above' | 'below' | null {
  const lab = labSide(p.flagAsPrinted)
  if (!lab || !p.range || (p.range.low === undefined && p.range.high === undefined)) return null
  const code = rangeFlag(p)
  return code?.side === lab ? null : lab
}

function width(p: Point): number | null {
  const { low, high } = p.range ?? {}
  return low !== undefined && high !== undefined && high > low ? high - low : null
}

const exact = (p: Point) => p.comparator === undefined

export type Change = {
  from: Point
  to: Point
  direction: 'up' | 'down' | 'same'
  /** Relative change from the previous value, when the previous value isn't zero. */
  relative: number | null
  notable: boolean
  crossedRange: boolean
}

/**
 * Rule 2: changed notably since the previous result. Notable means at least CHANGE_THRESHOLD of the
 * newer result's range width, or of the previous value when there's no two-sided range. Moving into
 * or out of the range always counts. Results like "<0.5" aren't compared.
 */
export function changeSincePrevious(points: Point[]): Change | null {
  const usable = sortByDate(points).filter(exact)
  if (usable.length < 2) return null
  const from = usable[usable.length - 2]
  const to = usable[usable.length - 1]
  const delta = to.value - from.value
  const w = width(to)
  const scale = w ?? Math.abs(from.value)
  const crossedRange = (rangeFlag(from) === null) !== (rangeFlag(to) === null)
  const notable = crossedRange || (scale > 0 && Math.abs(delta) >= CHANGE_THRESHOLD * scale)
  return {
    from,
    to,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    relative: from.value !== 0 ? delta / Math.abs(from.value) : null,
    notable,
    crossedRange,
  }
}

export type Trend = { direction: 'rising' | 'falling'; results: number; from: Point; to: Point }

/**
 * Rule 3: moving steadily in one direction. The last TREND_MIN_RESULTS or more results all rise, or
 * all fall, and the total change across them is at least TREND_THRESHOLD of the latest range width
 * (or of the first value, with no two-sided range), so small wobbles don't count.
 */
export function trend(points: Point[]): Trend | null {
  const usable = sortByDate(points).filter(exact)
  if (usable.length < TREND_MIN_RESULTS) return null

  // Walk back from the latest result while the direction holds.
  const last = usable.length - 1
  const dir = Math.sign(usable[last].value - usable[last - 1].value)
  if (dir === 0) return null
  let start = last - 1
  while (start > 0 && Math.sign(usable[start].value - usable[start - 1].value) === dir) start--

  const run = last - start + 1
  if (run < TREND_MIN_RESULTS) return null
  const from = usable[start]
  const to = usable[last]
  const scale = width(to) ?? Math.abs(from.value)
  if (!(scale > 0) || Math.abs(to.value - from.value) < TREND_THRESHOLD * scale) return null
  return { direction: dir > 0 ? 'rising' : 'falling', results: run, from, to }
}

export function sortByDate<T extends { date: string }>(points: T[]): T[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date))
}
