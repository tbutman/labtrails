// Reading the sample date as printed. US reports write MM/DD/YYYY and Portuguese ones DD/MM/YYYY, so
// "03/04/2025" could be 3 April or 4 March. When both readings are valid dates, the user chooses.

import type { DateFormat } from './schema'

export type DateReading = { candidates: string[]; ambiguous: boolean }

function iso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > days) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Returns every valid reading of a printed date, the AI's guessed format first. An empty list means
 * the date couldn't be read. Two-digit years are taken as 20xx.
 */
export function readPrintedDate(printed: string, guessed: DateFormat = 'unknown'): DateReading {
  const parts = printed.trim().match(/^(\d{1,4})[./\- ](\d{1,2})[./\- ](\d{1,4})$/)
  if (!parts) return { candidates: [], ambiguous: false }
  const [a, b, c] = parts.slice(1).map(Number)
  const year = (n: number) => (n < 100 ? 2000 + n : n)

  if (parts[1].length === 4) {
    const ymd = iso(a, b, c)
    return { candidates: ymd ? [ymd] : [], ambiguous: false }
  }
  const dmy = iso(year(c), b, a)
  const mdy = iso(year(c), a, b)
  const ordered = guessed === 'MDY' ? [mdy, dmy] : [dmy, mdy]
  const candidates = [...new Set(ordered.filter((d): d is string => d !== null))]
  return { candidates, ambiguous: candidates.length > 1 }
}
