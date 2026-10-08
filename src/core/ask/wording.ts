// Words an AI answer or summary may not use about a person's results (CORE-04): judgments,
// reassurance and alarm. One list for both apps, checked by code on Ask answers and on summaries.
// Apps can add their own (BabyTrails: none beyond these).
//
// "Fine", "good" and "bad" are banned as judgments ("looks fine", "is good", "good news"), not as
// words: "fine motor skills" or "a good time to ask" say nothing about the results.

/** The banned words, for prompts: "Never say or imply that … is <these>". */
export const BANNED_WORDS = [
  'healthy',
  'unhealthy',
  'normal',
  'abnormal',
  'fine',
  'good',
  'bad',
  'dangerous',
  'alarming',
  'concerning',
  'worrying',
  'reassuring',
  'nothing to worry about',
  'nothing serious',
  'at risk',
  'thriving',
] as const

/** The list for a prompt: `"healthy", "unhealthy", … or "thriving"`. */
export const BANNED_WORDS_TEXT = `${BANNED_WORDS.slice(0, -1).map((w) => `"${w}"`).join(', ')} or "${BANNED_WORDS.at(-1)}"`

const JUDGED = String.raw`(?:is|are|was|were|be|been|looks?|looking|seems?|seemed|sounds?|doing|stays?|remains?)\s+(?:(?:all|perfectly|very|really|quite|pretty|absolutely|completely|totally|still)\s+)?`

export const BANNED_PHRASES: RegExp[] = [
  /\b(?:healthy|unhealthy|normal|normally|abnormal|abnormally|dangerous|alarming|concerning|worrying|reassuring|thriving)\b/i,
  /\bat risk\b/i,
  /\bnothing (?:to worry|serious)\b/i,
  /\b(?:no need|don't need|do not need|nothing) to (?:worry|be worried)\b/i,
  new RegExp(String.raw`\b${JUDGED}(?:fine|good|bad)\b`, 'i'),
  /\b(?:good|bad) (?:news|sign|result|results|number|numbers)\b/i,
]

/** The first banned phrase in a text, or undefined. With `allowQuoted`, words in quotation marks
 * (a document's own words, quoted by a document summary) don't count. */
export function bannedPhrase(text: string, extra: RegExp[] = [], { allowQuoted = false } = {}): string | undefined {
  const checked = allowQuoted ? text.replace(/"[^"\n]*"|“[^”\n]*”/g, '""') : text
  for (const pattern of [...BANNED_PHRASES, ...extra]) {
    const m = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(checked)
    if (m) return m[0]
  }
  return undefined
}

/** Shown instead of a summary that used a banned phrase; nothing is saved. */
export const summaryWordingError = (appName: string) => `This summary used wording ${appName} avoids; try again.`

/** Under every AI summary: summaries are free text, so their numbers aren't checked as Ask's are. */
export const UNCHECKED_NUMBERS_NOTE = "Numbers in this summary weren't checked by the app; the numbers on the charts are."
