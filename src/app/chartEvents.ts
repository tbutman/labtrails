import type { ChartEvent } from './components/MarkerChart'
import { entryLabel, firstDay, lastDay, type TimelineEntry } from '../labs/timeline'
import { formatPeriod } from './format'

/** Timeline entries as the marker chart draws them. */
export function chartEvents(entries: TimelineEntry[]): ChartEvent[] {
  return entries.map((e) => ({ id: e.id, label: entryLabel(e), period: formatPeriod(e.start, e.end), from: firstDay(e.start), ...(e.end ? { to: lastDay(e.end) } : {}) }))
}
