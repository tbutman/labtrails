// "Ask about the numbers": a question answered by the AI from a facts object the app computes, with
// every number about the person checked by code before the answer is shown. Apps supply the facts,
// the prompt and the suggested questions; this module holds the answer format, the numbers check
// and the thread records.
//
// The rule (Thomas, 6 October 2026): answers use only numbers the code computed. The AI declares each
// number it uses with the fact it came from; the code resolves the fact, compares the values, and
// withholds any answer whose numbers don't check out or that contains numbers it didn't declare.
//
// For apps (coordination request 15): threads belong to one person (profileId). The app decides which
// facts go with each question; pass only the relevant part of a large history, and the same object
// is what answers are checked against. A value the app shows in another unit is a fact too: put it in
// the facts (for example { value: 97, unit: 'mg/dL', shown: { value: 5.4, unit: 'mmol/L' } }) and the
// AI cites whichever it writes. So is a reference range ("range.low", "range.high"). Numbers may be
// written with a decimal comma ("5,4"). Pass the units your measurements use (MeasurementUnits).

export type AnswerNumber = { text: string; fact: string }
export type Answer = { kind: 'answer' | 'out-of-scope'; text: string; numbers: AnswerNumber[] }

export type AskTurn = {
  role: 'parent' | 'ai'
  text: string
  /** For AI turns: an answer, a question it doesn't answer, or one whose numbers couldn't be checked. */
  kind?: 'answer' | 'out-of-scope' | 'unchecked' | 'prepared'
  /** The facts this turn was answered from (a digest), to tell when the data changed. */
  factsDigest?: string
  model?: string
  createdAt: string
}

export type AskThread = { id: string; profileId: string; createdAt: string; updatedAt: string; turns: AskTurn[] }

export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'text', 'numbers'],
  properties: {
    kind: { type: 'string', enum: ['answer', 'out-of-scope'] },
    text: { type: 'string' },
    numbers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'fact'],
        properties: { text: { type: 'string' }, fact: { type: 'string' } },
      },
    },
  },
} as const

export function parseAnswer(v: unknown): Answer {
  const o = v as Partial<Answer> | null
  if (!o || (o.kind !== 'answer' && o.kind !== 'out-of-scope') || typeof o.text !== 'string' || !Array.isArray(o.numbers)) throw new Error('Not an answer')
  const numbers = o.numbers.filter((n): n is AnswerNumber => !!n && typeof n.text === 'string' && typeof n.fact === 'string')
  return { kind: o.kind, text: o.text, numbers }
}

/** Looks up "latest.scores.wfa.percentile" or "gains.weight[2].perWeekGrams" in the facts. */
export function resolveFact(facts: unknown, path: string): unknown {
  const parts = path.match(/[^.[\]]+/g) ?? []
  let at: unknown = facts
  for (const p of parts) {
    if (at === null || typeof at !== 'object') return undefined
    at = (at as Record<string, unknown>)[/^\d+$/.test(p) ? Number(p) : p]
  }
  return at
}

type Token = { value: number; decimals: number; raw: string }
const NUMBER = String.raw`[+\-−]?\d+(?:[.,]\d+)?`

/** The first number in a piece of text, with how many decimals it was written with. */
export function firstNumber(text: string): Token | undefined {
  const m = new RegExp(NUMBER).exec(text)
  if (!m) return undefined
  const raw = m[0].replace('−', '-').replace(',', '.')
  return { value: Number(raw), decimals: raw.split('.')[1]?.length ?? 0, raw: m[0] }
}

/** The units whose numbers must be declared. Growth units by default; LabTrails passes its own. */
export const GROWTH_UNITS = ['kg', 'g', 'lb', 'lbs', 'oz', 'cm', 'mm', '%']

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// Numbers that describe a measurement: a unit, a percent, a percentile, or a z-score. Ages, counts and
// dates aren't checked here.
function measurementPattern(units: string[]): RegExp {
  // Longest first, so "g/L" wins over "g"; a unit can't run on into a longer word or unit.
  const alternatives = [...new Set(units)].sort((a, b) => b.length - a.length).map(escapeRe).join('|')
  return new RegExp(
    [
      String.raw`(${NUMBER})\s?(?:${alternatives})(?![\p{L}/])`,
      String.raw`(${NUMBER})(?:st|nd|rd|th)?\s+(?:percentile|centile)`,
      String.raw`z(?:-score)?\s*(?:of|=|≈|is)?\s*(${NUMBER})`,
    ].join('|'),
    'giu',
  )
}

export function measurementNumbers(text: string, units: string[] = GROWTH_UNITS): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(measurementPattern(units))) {
    const t = firstNumber(m[1] ?? m[2] ?? m[3])
    if (t) out.push({ ...t, raw: m[0] })
  }
  return out
}

const close = (a: number, b: number, decimals: number) => Math.abs(Math.abs(a) - Math.abs(b)) <= 0.5 * 10 ** -decimals + 1e-9

export type Check = { ok: boolean; problems: string[] }

/** Checks an answer's numbers against the facts, and its words against the app's banned phrases. */
export function checkAnswer(answer: Answer, facts: unknown, banned: RegExp[] = [], units: string[] = GROWTH_UNITS): Check {
  const problems: string[] = []
  const verified: Token[] = []
  for (const n of answer.numbers) {
    const t = firstNumber(n.text)
    const fact = resolveFact(facts, n.fact)
    if (!t) problems.push(`"${n.text}" has no number`)
    else if (typeof fact !== 'number') problems.push(`"${n.fact}" isn't a number in the facts`)
    else if (!close(t.value, fact, t.decimals)) problems.push(`"${n.text}" doesn't match ${n.fact} (${fact})`)
    else verified.push(t)
  }
  for (const t of measurementNumbers(answer.text, units)) {
    if (!verified.some((v) => close(v.value, t.value, Math.min(v.decimals, t.decimals)))) problems.push(`"${t.raw}" isn't one of the declared numbers`)
  }
  for (const b of banned) {
    const m = b.exec(answer.text)
    if (m) problems.push(`uses "${m[0]}"`)
  }
  return { ok: problems.length === 0, problems }
}

/** Earlier turns, as text for the next request. */
export function historyText(turns: AskTurn[]): string {
  return turns
    .filter((t) => t.role === 'parent' || t.kind === 'answer' || t.kind === 'prepared')
    .map((t) => `${t.role === 'parent' ? 'Parent' : 'Answer'}: ${t.text}`)
    .join('\n\n')
}
