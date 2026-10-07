// Correcting saved results: editing one (a value the AI misread), adding one it missed, and mapping a
// name that wasn't in the catalogue to a marker, for one result or every result printed that way.
// Values are still stored as printed; the code parses them the same way as on entry.

import { matchMarker, normaliseName, type UserAlias } from './match/match'
import type { Alias, Result } from './types'
import { normaliseUnit } from './units/normalise'
import { parseRange, parseValue, type DecimalHint, type Person } from './units/parse'

export type ResultInput = { name: string; value: string; unit: string; range: string; flag: string; markerId: string }

/**
 * The form's starting values for a saved result. A marker the code would find by itself is left blank,
 * so the form shows "Understood as …"; a marker chosen earlier (by the user or the AI) is kept.
 */
export function inputFromResult(r: Result, decimal: DecimalHint | undefined, aliases: UserAlias[] = []): ResultInput {
  const unit = r.unitAsPrinted ? normaliseUnit(r.unitAsPrinted) : undefined
  const match = matchMarker(r.nameAsPrinted, unit, aliases)
  const automatic = match.status === 'matched' && match.markerId === r.markerId
  return {
    name: r.nameAsPrinted,
    value: `${r.comparator ?? ''}${r.value !== undefined ? printedNumber(r.value, decimal) : (r.textValue ?? '')}`,
    unit: r.unitAsPrinted ?? '',
    range: r.range?.text ?? '',
    flag: r.flagAsPrinted ?? '',
    markerId: automatic ? '' : (r.markerId ?? ''),
  }
}

/** A stored number written with the report's decimal mark, as it was printed ("0,82"). */
export function printedNumber(value: number, decimal: DecimalHint | undefined): string {
  const text = String(value)
  return decimal === ',' ? text.replace('.', ',') : text
}

/** The decimal mark a report uses, judged from the ranges printed on it ("3,9 - 5,5"). */
export function reportDecimal(results: Result[]): DecimalHint {
  let comma = 0
  let point = 0
  for (const r of results) {
    const t = r.range?.text ?? ''
    if (/\d,\d/.test(t)) comma++
    if (/\d\.\d/.test(t)) point++
  }
  return comma > point ? ',' : '.'
}

/** What the code understands from the input: the marker (typed, or matched by name) and the parsed value. */
export function understandInput(input: ResultInput, decimal: DecimalHint | undefined, aliases: UserAlias[] = [], person?: Person) {
  const unit = input.unit.trim() ? normaliseUnit(input.unit) : undefined
  const match = input.name.trim() ? matchMarker(input.name, unit, aliases) : ({ status: 'unknown' } as const)
  const markerId = input.markerId || (match.status === 'matched' ? match.markerId : undefined)
  return { match, markerId, value: parseValue(input.value, decimal), range: input.range.trim() ? parseRange(input.range, decimal, person) : null }
}

/**
 * Builds the saved result from the input, keeping only the original's identity, creation time and
 * sample type: everything else comes from the input, so unmapping a name or changing a number to text
 * leaves nothing of the old value behind.
 */
export function resultFromInput(
  input: ResultInput,
  base: { id: string; reportId: string; profileId: string; createdAt: string; specimen?: Result['specimen'] },
  decimal: DecimalHint | undefined,
  now: string,
  aliases: UserAlias[] = [],
  person?: Person,
): Result {
  const u = understandInput(input, decimal, aliases, person)
  return {
    id: base.id,
    reportId: base.reportId,
    profileId: base.profileId,
    createdAt: base.createdAt,
    ...(base.specimen ? { specimen: base.specimen } : {}),
    ...(u.markerId ? { markerId: u.markerId } : {}),
    nameAsPrinted: input.name.trim(),
    ...(u.value.kind === 'number' ? { value: u.value.value, ...(u.value.comparator ? { comparator: u.value.comparator } : {}) } : { textValue: u.value.text }),
    ...(input.unit.trim() ? { unitAsPrinted: input.unit.trim() } : {}),
    ...(input.range.trim() ? { range: u.range ?? { text: input.range.trim() } } : {}),
    ...(input.flag.trim() ? { flagAsPrinted: input.flag.trim() } : {}),
    updatedAt: now,
  }
}

/** Every result of one person printed with this name (ignoring case and accents), for mapping them all at once. */
export function sameNameResults(results: Result[], name: string): Result[] {
  const key = normaliseName(name)
  return results.filter((r) => normaliseName(r.nameAsPrinted) === key)
}

export function validateInput(input: ResultInput): string | null {
  if (!input.name.trim()) return 'Enter the name as printed.'
  if (!input.value.trim()) return 'Enter the value.'
  return null
}

/**
 * The mapping to remember when the user chose a marker by hand, so the next report printed the same way
 * matches by itself. An existing mapping for the same name and unit is updated rather than repeated.
 * Nothing is remembered when the choice is what the code finds anyway, or wasn't changed.
 */
export function aliasToRemember(input: ResultInput, aliases: Alias[], previousMarkerId: string | undefined, newId: () => string): Alias | null {
  if (!input.markerId || input.markerId === previousMarkerId) return null
  const unit = input.unit.trim() ? normaliseUnit(input.unit) : undefined
  const match = matchMarker(input.name, unit, aliases)
  if (match.status === 'matched' && match.markerId === input.markerId) return null
  const key = normaliseName(input.name)
  const existing = aliases.find((a) => normaliseName(a.nameAsPrinted) === key && (a.unitAsPrinted ?? '') === (unit ?? ''))
  return { id: existing?.id ?? newId(), nameAsPrinted: input.name.trim(), ...(unit ? { unitAsPrinted: unit } : {}), markerId: input.markerId }
}
