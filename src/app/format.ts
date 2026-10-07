import type { Point } from '../labs/flags/flags'
import { formatDate } from '../core/format'

/**
 * A value with sensible precision for lab results. Values under 1 keep three significant digits, so a
 * non-zero value never rounds to 0 or to a different number (0.003 stays 0.003, not "0").
 */
export function formatValue(value: number): string {
  const abs = Math.abs(value)
  if (abs > 0 && abs < 1) return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(value)
  const digits = abs === 0 ? 0 : abs < 10 ? 2 : abs < 100 ? 1 : 0
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}

export function formatPoint(p: Pick<Point, 'value' | 'comparator'>): string {
  return `${p.comparator ?? ''}${formatValue(p.value)}`
}

export function formatRange(range: Point['range']): string {
  if (!range) return 'no range printed'
  const { low, high } = range
  if (low !== undefined && high !== undefined) return `${formatValue(low)}–${formatValue(high)}`
  if (high !== undefined) return `up to ${formatValue(high)}`
  if (low !== undefined) return `${formatValue(low)} or more`
  return 'no range printed'
}

/** "Lab's range 3.6–6", or "No range printed" (never "Lab's range no range printed"). */
export function labRange(range: Point['range'], start: 'Lab' | 'lab' = 'Lab'): string {
  const r = formatRange(range)
  return r === 'no range printed' ? (start === 'Lab' ? 'No range printed' : r) : `${start}'s range ${r}`
}

/** "Sep 19, 2026": the core's shared US date (Q1), so both apps write dates the same way. */
export { formatDate }

/** A day ("Jan 6, 2025") or, for a month-only date, the month ("Nov 2024"). */
export function formatWhen(when: string): string {
  if (/^\d{4}-\d{2}$/.test(when)) {
    const [y, m] = when.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return formatDate(when)
}

/** "from Nov 2024", "Jan 6, 2025 to Mar 3, 2025". */
export function formatPeriod(start: string, end?: string): string {
  return end ? `${formatWhen(start)} to ${formatWhen(end)}` : `from ${formatWhen(start)}`
}

export function formatPercent(fraction: number): string {
  return `${Math.round(Math.abs(fraction) * 100)}%`
}

/** "1 report", "3 reports"; or with explicit forms, "1 marker has", "2 markers have". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** A unit as shown next to a value: counts read "× 10⁹/L" rather than "10⁹/L" (LAB-17). */
export function unitLabel(unit: string): string {
  return /^10[⁰¹²³⁴⁵⁶⁷⁸⁹]+\//.test(unit) ? `× ${unit}` : unit
}
