// Parsing values and reference ranges exactly as labs print them. Reports come from different
// countries, so numbers may use a decimal comma ("5,4", Portugal) or a decimal point ("5.4", US),
// and ranges are written in many ways ("70 - 110", "70 a 110", "< 200", "até 200").

export type Comparator = '<' | '≤' | '>' | '≥'

export type DecimalHint = ',' | '.'

export type ParsedNumber = { value: number; ambiguous: boolean }

const NUMBER = String.raw`[-−]?\d[\d.,\s]*`

/**
 * Parses one printed number. With both separators present, the last one is the decimal mark. A lone
 * comma is a decimal comma, except in thousands-style numbers like "6,500" where it could be either:
 * those are read with the hint if given, and otherwise marked ambiguous (read as thousands).
 */
export function parseNumber(text: string, decimal?: DecimalHint): ParsedNumber | null {
  let s = text.trim().replace(/−/g, '-').replace(/\s+/g, '')
  if (!/^-?\d[\d.,]*$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let ambiguous = false
  let decimalMark: DecimalHint | null = null

  if (lastComma >= 0 && lastDot >= 0) {
    decimalMark = lastComma > lastDot ? ',' : '.'
  } else if (lastComma >= 0 || lastDot >= 0) {
    const mark: DecimalHint = lastComma >= 0 ? ',' : '.'
    const groups = s.split(mark)
    const thousandsLike = groups.length > 1 && /^-?\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => g.length === 3)
    if (groups.length > 2) {
      // "1.234.567" or "1,234,567": only grouping makes sense
      if (!thousandsLike) return null
      decimalMark = mark === ',' ? '.' : ','
    } else if (thousandsLike) {
      if (decimal) decimalMark = decimal
      else {
        // "6,500" or "6.500": a decimal with three places is rare in lab reports, but not impossible
        ambiguous = true
        decimalMark = mark === ',' ? '.' : ','
      }
    } else {
      decimalMark = mark
    }
  }

  if (decimalMark === ',') s = s.replace(/\./g, '').replace(',', '.')
  else if (decimalMark === '.') s = s.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const value = Number(s)
  return Number.isFinite(value) ? { value, ambiguous } : null
}

// Words that labs use in place of a comparator symbol, in English and Portuguese.
const COMPARATOR_WORDS: [RegExp, Comparator][] = [
  [/^(<=|≤|=<|até|ate|up to|inferior ou igual a|menor ou igual a)\s*/i, '≤'],
  [/^(>=|≥|=>|superior ou igual a|maior ou igual a)\s*/i, '≥'],
  [/^(<|inferior a|menor que|menor de|less than|below)\s*/i, '<'],
  [/^(>|superior a|maior que|maior de|greater than|above)\s*/i, '>'],
]

function splitComparator(text: string): { comparator?: Comparator; rest: string } {
  const t = text.trim()
  for (const [re, comparator] of COMPARATOR_WORDS) {
    const m = t.match(re)
    if (m) return { comparator, rest: t.slice(m[0].length) }
  }
  return { rest: t }
}

export type ParsedValue =
  | { kind: 'number'; value: number; comparator?: Comparator; ambiguous: boolean }
  | { kind: 'text'; text: string }

/** Parses a printed result: "5,4", "<0.5", "inferior a 0,5", or a qualitative result like "Negativo". */
export function parseValue(text: string, decimal?: DecimalHint): ParsedValue {
  const { comparator, rest } = splitComparator(text)
  // Tolerate a trailing unit or flag printed in the same cell ("5,4 mg/dL", "250 H")
  const m = rest.match(new RegExp(`^(${NUMBER})(?:\\s+[^\\d].*)?$`))
  const n = m ? parseNumber(m[1], decimal) : null
  if (n) return { kind: 'number', value: n.value, ambiguous: n.ambiguous, ...(comparator ? { comparator } : {}) }
  return { kind: 'text', text: text.trim() }
}

export type ParsedRange = { low?: number; high?: number; text: string }

/**
 * Parses a printed reference range. Returns null when it can't be read with confidence (for example
 * ranges that differ by sex or age, printed together); the text is then kept as printed.
 */
export function parseRange(text: string, decimal?: DecimalHint): ParsedRange | null {
  const original = text.trim()
  if (!original) return null
  // Brackets and a trailing unit ("[70; 110]", "70 - 110 mg/dL")
  const t = original.replace(/^[[(]\s*/, '').replace(/\s*[\])]\s*/, ' ').trim()

  const two = t.match(new RegExp(`^(${NUMBER})\\s*(?:-|–|—|a|to|até|ate|;|/)\\s*(${NUMBER})(?:\\s+[^\\d].*)?$`, 'i'))
  if (two) {
    const low = parseNumber(two[1].trim(), decimal)
    const high = parseNumber(two[2].trim(), decimal)
    if (low && high && low.value <= high.value) return { low: low.value, high: high.value, text: original }
  }

  const { comparator, rest } = splitComparator(t)
  if (comparator) {
    const m = rest.match(new RegExp(`^(${NUMBER})(?:\\s+[^\\d].*)?$`))
    const n = m ? parseNumber(m[1].trim(), decimal) : null
    if (n) return comparator === '<' || comparator === '≤' ? { high: n.value, text: original } : { low: n.value, text: original }
  }
  return null
}
