// Matches a marker name as printed on a report ("Colesterol HDL", "TGO/AST", "Glicose (jejum)") to
// the catalogue. Runs before any AI suggestion: the code decides mappings, the AI only suggests a
// catalogue ID when the code finds nothing.

import { MARKERS } from '../catalogue/catalogue'
import type { Marker } from '../catalogue/types'
import { isKnownUnit } from '../units/convert'

/** Lower case, no accents, punctuation as spaces, single spaces; drops a trailing "(…)" note. */
export function normaliseName(printed: string): string {
  return printed
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\((?:jejum|fasting|soro|serum|plasma|sangue|calculad[oa]|calculated|s|p)\)/g, ' ')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Words that labs add around a marker name without changing what it is.
const NOISE = /\b(serum|soro|serica|serico|plasma|plasmatica|sangue|blood|jejum|fasting|em jejum|doseamento|dosagem|level|levels)\b/g

function variants(printed: string): string[] {
  const n = normaliseName(printed)
  const quiet = n.replace(NOISE, ' ').replace(/\s+/g, ' ').trim()
  // "TGO/AST" and "AST (TGO)" print two names for one marker; try each part too.
  const parts = printed.split(/[/()]/).map(normaliseName).filter(Boolean)
  return [...new Set([n, quiet, ...parts].filter(Boolean))]
}

const INDEX: Map<string, Marker[]> = (() => {
  const index = new Map<string, Marker[]>()
  for (const marker of MARKERS) {
    for (const alias of [marker.name, ...marker.aliases]) {
      const key = normaliseName(alias)
      const list = index.get(key) ?? []
      if (!list.includes(marker)) list.push(marker)
      index.set(key, list)
    }
  }
  return index
})()

export type UserAlias = { nameAsPrinted: string; unitAsPrinted?: string; markerId: string }

export type Match =
  | { status: 'matched'; markerId: string; via: 'user' | 'catalogue' }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'unknown' }

/**
 * Finds the catalogue marker for a printed name. The user's own mappings win. When a name fits
 * several markers (neutrophils as a count or a percentage), the unit decides; without a unit that
 * fits exactly one, the result is ambiguous and the user chooses.
 */
export function matchMarker(nameAsPrinted: string, unitAsPrinted: string | undefined, userAliases: UserAlias[] = []): Match {
  const key = normaliseName(nameAsPrinted)
  const user = userAliases.find((a) => normaliseName(a.nameAsPrinted) === key && (!a.unitAsPrinted || !unitAsPrinted || a.unitAsPrinted === unitAsPrinted))
  if (user) return { status: 'matched', markerId: user.markerId, via: 'user' }

  for (const v of variants(nameAsPrinted)) {
    const candidates = INDEX.get(v)
    if (!candidates) continue
    if (candidates.length === 1) {
      const [only] = candidates
      return { status: 'matched', markerId: only.id, via: 'catalogue' }
    }
    const byUnit = unitAsPrinted ? candidates.filter((m) => isKnownUnit(m, unitAsPrinted)) : []
    if (byUnit.length === 1) return { status: 'matched', markerId: byUnit[0].id, via: 'catalogue' }
    return { status: 'ambiguous', candidates: (byUnit.length ? byUnit : candidates).map((m) => m.id) }
  }
  return { status: 'unknown' }
}
