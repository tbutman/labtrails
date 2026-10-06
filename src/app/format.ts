import type { Point } from '../labs/flags/flags'

/** A value with sensible precision for lab results: more decimals for small numbers. */
export function formatValue(value: number): string {
  const abs = Math.abs(value)
  const digits = abs === 0 ? 0 : abs < 1 ? 2 : abs < 10 ? 2 : abs < 100 ? 1 : 0
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
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

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function formatPercent(fraction: number): string {
  return `${Math.round(Math.abs(fraction) * 100)}%`
}
