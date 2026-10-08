// Parsing values and reference ranges exactly as labs print them. Reports come from different
// countries, so numbers may use a decimal comma ("5,4", Portugal) or a decimal point ("5.4", US),
// and ranges are written in many ways ("70 - 110", "70 a 110", "< 200", "até 200").

export type Comparator = '<' | '≤' | '>' | '≥'

export type DecimalHint = ',' | '.'

export type ParsedNumber = {
  value: number
  ambiguous: boolean
  /** For a thousands-style number read with a hint ("6,500" as 6.5), the value under the other reading. */
  otherReading?: number
}

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
  let otherReading: number | undefined
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
      if (decimal) {
        decimalMark = decimal
        // "6,500" read with a decimal comma is 6.5; read the other way it would be 6500, and vice versa.
        otherReading = Number(mark === decimal ? groups.join('') : groups.join('.'))
      } else {
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
  return Number.isFinite(value) ? { value, ambiguous, ...(otherReading !== undefined ? { otherReading } : {}) } : null
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
  | { kind: 'number'; value: number; comparator?: Comparator; ambiguous: boolean; otherReading?: number }
  | { kind: 'text'; text: string }

/** Parses a printed result: "5,4", "<0.5", "inferior a 0,5", or a qualitative result like "Negativo". */
export function parseValue(text: string, decimal?: DecimalHint): ParsedValue {
  const { comparator, rest } = splitComparator(text)
  // Tolerate a trailing unit or flag printed in the same cell ("5,4 mg/dL", "250 H", "43,3%")
  const m = rest.match(new RegExp(`^(${NUMBER})(?:\\s*%|\\s+[^\\d].*)?$`))
  const n = m ? parseNumber(m[1], decimal) : null
  if (n) return { kind: 'number', value: n.value, ambiguous: n.ambiguous, ...(n.otherReading !== undefined ? { otherReading: n.otherReading } : {}), ...(comparator ? { comparator } : {}) }
  return { kind: 'text', text: text.trim() }
}

export type ParsedRange = { low?: number; high?: number; text: string }

/** Who a result belongs to, for ranges printed by age or sex. */
export type Person = { age?: number; sex?: 'female' | 'male' }

// Labels on ranges printed in bands, in English and Portuguese.
const AGE_LABEL = /\b(anos|ano|years?|yrs?)\b/i
const MALE_LABEL = /\b(homens?|men|males?|masculin[oa]s?)\b/i
const FEMALE_LABEL = /\b(mulheres?|women|females?|feminin[oa]s?)\b/i
const NORMAL_LABEL = /(normal|refer[eê]ncia|reference|sufici[eê]n|sufficien|desej[aá]vel|desirable|optim|[oó]tim|recomendad|recommended|\balvo\b|target)/i
const OTHER_LABEL = /(pr[eé][-\s]?diab|\brisk|risco|defici|insufici|insufficien|toxic|diabet|elevad|\bhigh\b|\balto\b|\bbaixo\b|\blow\b|borderline|lim[ií]trofe|abnormal|anormal)/i

type Band = { label: string; body: string }

function splitBand(band: string): Band {
  // "40 - 49 anos: 0 - 2.5" and "< 15 Anos < 1,8": an age label, then the range.
  const age = band.match(/^(.*?\b(?:anos|ano|years?|yrs?)\b)\s*:?\s*(.+)$/i)
  if (age) return { label: age[1], body: age[2] }
  // "Suficiência: 30 - 100", "Homens: 13 - 17"
  const colon = band.match(/^([^:\d<>≤≥]+):\s*(.+)$/)
  if (colon) return { label: colon[1], body: colon[2] }
  // "Desejável < 100" (label first) or "< 5,7 Normal" (label after)
  const lead = band.match(/^([^\d<>≤≥]*?)\s*((?:<=|>=|≤|≥|<|>)?\s*\d[\d.,]*(?:\s*(?:-|–|a|to|até)\s*\d[\d.,]*)?)\s*(.*)$/i)
  if (lead) return { label: `${lead[1]} ${lead[3]}`.trim(), body: lead[2] }
  return { label: band, body: '' }
}

/**
 * A range printed in bands: by age ("40 - 49 anos: 0 - 2.5"), by sex ("Homens: 13 - 17") or by category
 * ("Deficiência: <10; Suficiência: 30 - 100"). Picks the band for this person, or the lab's normal or
 * sufficient band. Returns undefined when the text isn't banded, and null when it is but no single band
 * fits (so no range is stored, rather than a wrong one).
 */
function parseBands(text: string, decimal: DecimalHint | undefined, person: Person | undefined): ParsedRange | null | undefined {
  const bands = text.split(/\s*(?:;|\n|\||·|•)\s*/).filter(Boolean).map(splitBand)
  const labelled = bands.filter((b) => AGE_LABEL.test(b.label) || MALE_LABEL.test(b.label) || FEMALE_LABEL.test(b.label) || NORMAL_LABEL.test(b.label) || OTHER_LABEL.test(b.label))
  if (!labelled.length) return undefined
  const fits = labelled.filter((b) => {
    if (AGE_LABEL.test(b.label)) {
      if (person?.age === undefined) return false
      const ages = parseRange(b.label.replace(AGE_LABEL, ' ').replace(/[^\d.,<>≤≥\s–-]/g, ' ').trim(), decimal)
      if (!ages || (ages.low !== undefined && person.age < ages.low) || (ages.high !== undefined && person.age > ages.high)) return false
    }
    if (MALE_LABEL.test(b.label) && person?.sex !== 'male') return false
    if (FEMALE_LABEL.test(b.label) && person?.sex !== 'female') return false
    if (OTHER_LABEL.test(b.label) && !NORMAL_LABEL.test(b.label.replace(OTHER_LABEL, ''))) return false
    return true
  })
  if (fits.length !== 1) return null
  const range = parseRange(fits[0].body, decimal)
  return range ? { ...(range.low !== undefined ? { low: range.low } : {}), ...(range.high !== undefined ? { high: range.high } : {}), text } : null
}

/**
 * Parses a printed reference range. Ranges printed in bands (by age, sex or category) need the person
 * to pick the right band. Returns null when it can't be read with confidence; the text is then kept as
 * printed.
 */
export function parseRange(text: string, decimal?: DecimalHint, person?: Person): ParsedRange | null {
  const original = text.trim()
  if (!original) return null
  const banded = parseBands(original, decimal, person)
  if (banded !== undefined) return banded
  // Brackets and a trailing unit ("[70; 110]", "70 - 110 mg/dL")
  const t = original.replace(/^[[(]\s*/, '').replace(/\s*[\])]\s*/, ' ').trim()

  const two = t.match(new RegExp(`^(${NUMBER})\\s*%?\\s*(?:-|–|—|a|to|até|ate|;|/)\\s*(${NUMBER})(?:\\s*%|\\s+[^\\d].*)?$`, 'i'))
  if (two) {
    const low = parseNumber(two[1].trim(), decimal)
    const high = parseNumber(two[2].trim(), decimal)
    if (low && high && low.value <= high.value) return { low: low.value, high: high.value, text: original }
  }

  const { comparator, rest } = splitComparator(t)
  if (comparator) {
    const m = rest.match(new RegExp(`^(${NUMBER})(?:\\s*%|\\s+[^\\d].*)?$`))
    const n = m ? parseNumber(m[1].trim(), decimal) : null
    if (n) return comparator === '<' || comparator === '≤' ? { high: n.value, text: original } : { low: n.value, text: original }
  }
  return null
}
