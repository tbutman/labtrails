// The personal timeline (SPEC.md section 18.1): medications, supplements, lifestyle changes and events,
// each with a start and an optional end, as a day or just a month. It never changes a flag; it's shown
// on the charts, the table and (if the user ticks it) the doctor report, and later goes to the AI as
// context. Pure helpers, no storage.

export type TimelineKind = 'medication' | 'supplement' | 'lifestyle' | 'event'

export type TimelineEntry = {
  id: string
  profileId: string
  kind: TimelineKind
  /** As the user writes it: "Sustanon 250", "Vitamin D3", "Stopped alcohol". */
  name: string
  /** YYYY-MM-DD, or YYYY-MM when only the month is known. */
  start: string
  end?: string
  dose?: string
  /** How often, for working out how long since the last dose. */
  every?: { n: number; unit: 'day' | 'week' | 'month' }
  /** The timing of a blood test around a dose matters (injections, thyroid tablets). */
  timing?: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export const KINDS: { value: TimelineKind; label: string }[] = [
  { value: 'medication', label: 'Medication' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'event', label: 'Event' },
]

/** Names offered for lifestyle entries; the user can write anything. */
export const LIFESTYLE_SUGGESTIONS = ['Smoking', 'Stopped smoking', 'Alcohol', 'Stopped alcohol', 'Weight loss', 'Weight gain', 'Training', 'Diet change']

const MONTH = /^\d{4}-\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The first day an entry covers: a month-only start counts from the 1st. */
export function firstDay(start: string): string {
  return MONTH.test(start) ? `${start}-01` : start
}

/** The last day an entry covers: a month-only end counts to the month's last day. */
export function lastDay(end: string): string {
  if (!MONTH.test(end)) return end
  const [y, m] = end.split('-').map(Number)
  return `${end}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Entries active on a day. */
export function activeOn(entries: TimelineEntry[], date: string): TimelineEntry[] {
  return entries.filter((e) => firstDay(e.start) <= date && (!e.end || lastDay(e.end) >= date))
}

/** Entries active at any time between two days, inclusive. */
export function activeBetween(entries: TimelineEntry[], from: string, to: string): TimelineEntry[] {
  return entries.filter((e) => firstDay(e.start) <= to && (!e.end || lastDay(e.end) >= from))
}

/** Entries that started after one day and on or before another: what changed between two tests. */
export function startedBetween(entries: TimelineEntry[], after: string | undefined, upTo: string): TimelineEntry[] {
  return entries.filter((e) => firstDay(e.start) <= upTo && (after === undefined || firstDay(e.start) > after))
}

/** Entries active on a day whose test timing around a dose matters. */
export function timedOn(entries: TimelineEntry[], date: string): TimelineEntry[] {
  return activeOn(entries, date).filter((e) => e.timing)
}

const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000

/** Whole days from one date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from))
}

export function everyLabel(every: TimelineEntry['every']): string | undefined {
  if (!every) return undefined
  return every.n === 1 ? `every ${every.unit}` : `every ${every.n} ${every.unit}s`
}

/**
 * How a test relates to a dose, in words: "before that day's dose of Sustanon 250", "29 days after the
 * last dose of Sustanon 250 (every month)". Facts, not interpretation.
 */
export function describeTiming(t: { name: string; when: 'before-dose' | 'after-dose' | 'between'; lastDose?: string; every?: string }, testDate: string): string {
  if (t.when === 'before-dose') return `before that day's dose of ${t.name}`
  if (t.when === 'after-dose') return `after that day's dose of ${t.name}`
  const schedule = t.every ? ` (${t.every})` : ''
  if (!t.lastDose) return `between doses of ${t.name}${schedule}`
  const days = daysBetween(t.lastDose, testDate)
  return `${days === 1 ? '1 day' : `${days} days`} after the last dose of ${t.name}${schedule}`
}

export function sortByStart(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => firstDay(a.start).localeCompare(firstDay(b.start)) || a.name.localeCompare(b.name))
}

/** "Vitamin D3 2,000 IU, every day": the name with its dose and schedule, without dates. */
export function entryLabel(e: Pick<TimelineEntry, 'name' | 'dose' | 'every'>): string {
  const every = everyLabel(e.every)
  return [e.name, e.dose].filter(Boolean).join(' ') + (every ? `, ${every}` : '')
}

/** The user's input for an entry, before it's saved. */
export type EntryInput = { kind: TimelineKind; name: string; start: string; end: string; dose: string; everyN: string; everyUnit: 'day' | 'week' | 'month'; timing: boolean; notes: string }

export function validateEntry(input: EntryInput): string | null {
  if (!input.name.trim()) return 'Give it a name.'
  if (!DAY.test(input.start) && !MONTH.test(input.start)) return 'Enter when it started (a day, or just the month).'
  if (input.end && !DAY.test(input.end) && !MONTH.test(input.end)) return 'Enter when it ended as a day or a month, or leave it empty.'
  if (input.end && lastDay(input.end) < firstDay(input.start)) return 'It ends before it starts.'
  if (input.everyN && !(Number(input.everyN) >= 1 && Number.isInteger(Number(input.everyN)))) return 'How often should be a whole number.'
  return null
}

export function entryFromInput(input: EntryInput, base: { id: string; profileId: string; createdAt: string }, now: string): TimelineEntry {
  return {
    ...base,
    kind: input.kind,
    name: input.name.trim(),
    start: input.start,
    ...(input.end ? { end: input.end } : {}),
    ...(input.dose.trim() ? { dose: input.dose.trim() } : {}),
    ...(input.everyN ? { every: { n: Number(input.everyN), unit: input.everyUnit } } : {}),
    ...(input.timing ? { timing: true } : {}),
    ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    updatedAt: now,
  }
}

export function inputFromEntry(e?: TimelineEntry): EntryInput {
  return {
    kind: e?.kind ?? 'medication',
    name: e?.name ?? '',
    start: e?.start ?? '',
    end: e?.end ?? '',
    dose: e?.dose ?? '',
    everyN: e?.every ? String(e.every.n) : '',
    everyUnit: e?.every?.unit ?? 'day',
    timing: e?.timing ?? false,
    notes: e?.notes ?? '',
  }
}
