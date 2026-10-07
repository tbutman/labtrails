// "Ask about the numbers": a question answered by the AI from a facts object the app computes, with
// every number about the person checked by code before the answer is shown. Apps supply the facts,
// the prompt and the suggested questions; this module holds the answer format, the numbers check
// and the thread records.
//
// The rule (Thomas, October 6, 2026): answers use only numbers the code computed. The AI declares each
// number it uses with the fact it came from; the code resolves the fact, compares the values, and
// withholds any answer whose numbers don't check out or that contains numbers it didn't declare.
//
// For apps (coordination request 15): threads belong to one person (profileId). The app decides which
// facts go with each question; pass only the relevant part of a large history, and the same object
// is what answers are checked against. A value the app shows in another unit is a fact too: put it in
// the facts (for example { value: 97, unit: 'mg/dL', shown: { value: 5.4, unit: 'mmol/L' } }) and the
// AI cites whichever it writes. So is a reference range ("range.low", "range.high"). Numbers may be
// written with a decimal comma ("5,4"). Pass the units your measurements use (MeasurementUnits).

import { BANNED_PHRASES, bannedPhrase } from './wording'

export type AnswerNumber = { text: string; fact: string }
export type Answer = { kind: 'answer' | 'out-of-scope'; text: string; numbers: AnswerNumber[] }

export type AskTurn = {
  /** A question from the person using the app, or the answer to it. */
  role: 'question' | 'answer'
  text: string
  /** For answers: an answer, a question it doesn't answer, or one whose numbers couldn't be checked. */
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

type Token = { value: number; decimals: number; raw: string; index: number; end: number; signed: boolean }
const NUMBER = String.raw`[+\-−]?\d+(?:[.,]\d+)?`

/** The first number in a piece of text, with how many decimals it was written with. A sign counts
 * only where it can be one: the "-" in "1.1-1.5 kg" is a range, not a minus. */
export function firstNumber(text: string, from = 0): Token | undefined {
  const re = new RegExp(NUMBER, 'g')
  re.lastIndex = from
  const m = re.exec(text)
  if (!m) return undefined
  let raw = m[0].replace('−', '-').replace(',', '.')
  let index = m.index
  if (/^[+-]/.test(raw) && index > 0 && /[\p{L}\p{N}]/u.test(text[index - 1])) {
    raw = raw.slice(1)
    index += 1
  }
  return { value: Number(raw), decimals: raw.split('.')[1]?.length ?? 0, raw: m[0], index, end: m.index + m[0].length, signed: /^[+-]/.test(raw) }
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

/** The measurement numbers in a text, each with where it is and where its match ends. */
export function measurementNumbers(text: string, units: string[] = GROWTH_UNITS): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(measurementPattern(units))) {
    const part = m[1] ?? m[2] ?? m[3]
    // Read the number in place, so a sign is judged by the character before it.
    const t = firstNumber(text, m.index + m[0].indexOf(part))
    if (t) out.push({ ...t, raw: m[0], end: m.index + m[0].length })
  }
  return out
}

// Words that give a number its direction (CORE-05): "lost 120 g" is −120, minus sign or not. Only
// words right before the number count, so in "fell to the 2nd percentile" the 2nd stays a level.
// "Below" or "less" right after a number can make it negative ("5.8% below birth weight") but never
// makes a positive fact fail ("5.4 mmol/L below the range" is a level).
const QUALIFIERS = String.raw`(?:(?:by|of|about|around|roughly|nearly|almost|just|only|some|a|an)\s+)*`
const LOSS_BEFORE = new RegExp(String.raw`\b(?:lost|lose|loses|losing|loss|down|fell|fallen|falling|dropped|dropping|drop|decreased|decreasing|decrease|fall|shed)\s+${QUALIFIERS}$`, 'i')
const GAIN_BEFORE = new RegExp(String.raw`\b(?:gained|gain|gains|gaining|up|rose|risen|rising|increased|increasing|increase|put on)\s+${QUALIFIERS}$`, 'i')
const LESS_AFTER = /^(?:\s+(?:a|per)\s+(?:day|week|month))?\s+(?:less|lower|below|smaller|lighter|down)\b/i

/** The values a number can stand for where it's written: the first is how it reads; a second,
 * negative one when "below" or "less" follows it. */
function readings(t: Token, text: string, end: number): number[] {
  if (t.signed) return [t.value]
  const before = text.slice(Math.max(0, t.index - 40), t.index)
  if (LOSS_BEFORE.test(before)) return [-t.value]
  if (GAIN_BEFORE.test(before)) return [t.value]
  return LESS_AFTER.test(text.slice(end, end + 40)) ? [t.value, -t.value] : [t.value]
}

const close = (a: number, b: number, decimals: number) => Math.abs(a - b) <= 0.5 * 10 ** -decimals + 1e-9

export type Check = { ok: boolean; problems: string[] }

/** Checks an answer's numbers against the facts, signs included, and its words against banned phrases. */
export function checkAnswer(answer: Answer, facts: unknown, banned: RegExp[] = BANNED_PHRASES, units: string[] = GROWTH_UNITS): Check {
  const problems: string[] = []
  const verified: { value: number; decimals: number }[] = []
  for (const n of answer.numbers) {
    const fact = resolveFact(facts, n.fact)
    // Read the declared number where the answer writes it, so a "lost" before it counts.
    const at = answer.text.indexOf(n.text)
    const [text, offset] = at >= 0 ? [answer.text, at] : [n.text, 0]
    const t = firstNumber(text, offset)
    if (!t || t.index >= offset + n.text.length) problems.push(`"${n.text}" has no number`)
    else if (typeof fact !== 'number') problems.push(`"${n.fact}" isn't a number in the facts`)
    else if (readings(t, text, offset + n.text.length).some((v) => close(v, fact, t.decimals))) verified.push({ value: fact, decimals: t.decimals })
    else if (close(Math.abs(t.value), Math.abs(fact), t.decimals))
      problems.push(
        `"${n.text}" reads as the opposite of ${n.fact} (${fact}): ${fact < 0 ? 'write the minus sign, or say it was lost or went down' : "it's not a loss, so don't say lost, down or fell"}`,
      )
    else problems.push(`"${n.text}" doesn't match ${n.fact} (${fact})`)
  }
  for (const t of measurementNumbers(answer.text, units)) {
    const values = readings(t, answer.text, t.end)
    if (!verified.some((v) => values.some((value) => close(v.value, value, Math.min(v.decimals, t.decimals))))) problems.push(`"${t.raw}" isn't one of the declared numbers`)
  }
  const word = bannedPhrase(answer.text, banned === BANNED_PHRASES ? [] : banned)
  if (word) problems.push(`uses "${word}"`)
  return { ok: problems.length === 0, problems }
}

/** Earlier turns, as text for the next request. */
export function historyText(turns: AskTurn[]): string {
  return turns
    .filter((t) => t.role === 'question' || t.kind === 'answer' || t.kind === 'prepared')
    .map((t) => `${t.role === 'question' ? 'Question' : 'Answer'}: ${t.text}`)
    .join('\n\n')
}
