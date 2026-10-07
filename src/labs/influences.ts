// Known influences (SPEC.md section 18.4): documented things that can affect a test's result, each
// pair cited to a public source (MedlinePlus, the NHS, Lab Tests Online UK, or Testing.com, formerly
// Lab Tests Online) and stating only a direction, with the source's own limits ("in some people").
// Matched against the person's timeline and a test's context, they're shown as "your timeline includes
// X; X can raise Y": a documented influence and the user's own entry, never a cause.

import type { TimelineEntry } from './timeline'
import { activeOn } from './timeline'
import type { TestContext } from './types'
import { INFLUENCES } from './influences-data'

export type InfluenceId =
  | 'time-of-day'
  | 'eating'
  | 'dehydration'
  | 'hard-exercise'
  | 'illness'
  | 'smoking'
  | 'alcohol'
  | 'biotin'
  | 'testosterone'
  | 'glp1'
  | 'statin'
  | 'thyroid-hormone'
  | 'corticosteroid'
  | 'nsaid'
  | 'iron'
  | 'vitamin-d'
  | 'altitude'
  | 'pregnancy'

export const INFLUENCE_NAMES: Record<InfluenceId, string> = {
  'time-of-day': 'The time of day',
  eating: 'Eating before the test',
  dehydration: 'Dehydration',
  'hard-exercise': 'Hard exercise before the test',
  illness: 'A recent illness or infection',
  smoking: 'Smoking',
  alcohol: 'Alcohol',
  biotin: 'Biotin supplements',
  testosterone: 'Testosterone therapy or anabolic steroids',
  glp1: 'GLP-1 medicines (semaglutide, tirzepatide)',
  statin: 'Statins',
  'thyroid-hormone': 'Thyroid hormone medicine',
  corticosteroid: 'Corticosteroids',
  nsaid: 'Anti-inflammatory painkillers (NSAIDs)',
  iron: 'Iron supplements',
  'vitamin-d': 'Vitamin D supplements',
  altitude: 'Living at high altitude',
  pregnancy: 'Pregnancy',
}

export type Effect = 'raise' | 'lower' | 'affect' | 'vary'

export type InfluenceSource = { title: string; url: string; quote: string; accessed: string }

export type Influence = {
  markers: string[]
  influence: InfluenceId
  effect: Effect
  /** The source's own limits, so the sentence is no stronger than the quote: "in some people". */
  qualifier?: string
  /** Matched only from a test's own notes ("recent alcohol"), never from the timeline. */
  onlyFromNotes?: boolean
  source: InfluenceSource
}

const EFFECT_WORDS: Record<Effect, string> = { raise: 'can raise', lower: 'can lower', affect: 'can affect', vary: 'varies with' }

/** "can raise", "can lower", "can affect", "varies with". */
export const effectWords = (e: Effect) => EFFECT_WORDS[e]

/** The influences documented for a marker. */
export function influencesFor(markerId: string): Influence[] {
  return INFLUENCES.filter((i) => i.markers.includes(markerId))
}

// What a timeline entry's name says it is. Names are free text, so this looks for common names in
// English and Portuguese; an entry that starts with "Stopped" or "Quit" never counts as the thing
// itself. Hard exercise isn't matched from the timeline: the sources mean exercise in the day or two
// before the draw, which only a test's own notes say.
const NAMES: [InfluenceId, RegExp][] = [
  ['testosterone', /testost|sustanon|enanthate|enantato|cypionate|cipionato|undecanoate|undecanoato|nebido|androgel|testogel|tostran|anabolic|anabolizante|\btrt\b/i],
  ['glp1', /semaglutid|ozempic|wegovy|rybelsus|tirzepatid|mounjaro|zepbound|liraglutid|saxenda|victoza|dulaglutid|trulicity|\bglp-?1\b/i],
  ['statin', /statin|estatina|atorvastat|rosuvastat|simvastat|pravastat|pitavastat|fluvastat|lipitor|crestor|zocor/i],
  ['thyroid-hormone', /levothyrox|levotirox|\bthyroxine|\btiroxina|euthyrox|eutirox|synthroid|letrox/i],
  ['corticosteroid', /prednis|dexamet|hydrocortis|hidrocortis|methylpred|metilpred|cortico/i],
  ['nsaid', /ibuprof|naprox|diclofen|ketoprof|cetoprof|celecox|etoricox|nimesul|\bnsaid|aine\b|anti-?inflamat/i],
  ['iron', /\biron\b|\bferro|ferrous|ferroso|ferric|férrico|ferrico|ferritab/i],
  ['vitamin-d', /vitamin[ae]?\s*d|\bd3\b|colecalcif|cholecalcif|calcifediol/i],
  ['biotin', /biotin|biotina|vitamin[ae]?\s*b7|\bb7\b/i],
  ['smoking', /smok|cigar|tobacco|tabaco|fumar|fumador|vape|vaping|nicotin/i],
  ['alcohol', /alcohol|álcool|alcool|drinking|wine|beer|vinho|cerveja/i],
  ['altitude', /altitude/i],
  ['pregnancy', /pregnan|grávida|gravidez/i],
]

const STOPPED = /^\s*(stopped|quit|no more|parei|deixei|sem)\b/i

// Steroids on the skin, in the nose or eyes, or inhaled: the sources mean steroids taken by mouth or
// injection ("certain types of … steroids").
const LOCAL = /cream|creme|ointment|pomada|\bgel\b|lotion|inhal|spray|nasal|puff|bombinha|drops|gotas|eye|topical|tópic|topic/i

/** The influences a timeline entry's name stands for. */
export function entryInfluences(entry: Pick<TimelineEntry, 'name'>): InfluenceId[] {
  if (STOPPED.test(entry.name)) return []
  return NAMES.filter(([id, re]) => re.test(entry.name) && !(id === 'corticosteroid' && LOCAL.test(entry.name))).map(([id]) => id)
}

/** The influences a test's own notes stand for. */
export function contextInfluences(context: TestContext | undefined): InfluenceId[] {
  if (!context) return []
  return [
    ...(context.fasting === 'no' ? (['eating'] as const) : []),
    ...(context.recently ?? []).flatMap((r) => (r === 'illness' ? (['illness'] as const) : r === 'hard-exercise' ? (['hard-exercise'] as const) : r === 'alcohol' ? (['alcohol'] as const) : [])),
  ]
}

export type Matched = { influence: Influence; from: { kind: 'timeline'; entry: TimelineEntry } | { kind: 'test'; date: string } }

/**
 * The documented influences on a marker that the person's timeline (entries active on the test date)
 * or the test's own notes include, for one test.
 */
export function matchInfluences(markerId: string, timeline: TimelineEntry[], test: { date: string; context?: TestContext }): Matched[] {
  const known = influencesFor(markerId)
  const out: Matched[] = []
  for (const entry of activeOn(timeline, test.date)) {
    for (const id of entryInfluences(entry)) for (const influence of known.filter((k) => k.influence === id && !k.onlyFromNotes)) out.push({ influence, from: { kind: 'timeline', entry } })
  }
  for (const id of contextInfluences(test.context)) for (const influence of known.filter((k) => k.influence === id)) out.push({ influence, from: { kind: 'test', date: test.date } })
  return out
}

/**
 * "Your timeline includes Atorvastatin (from Jan 2026); statins can raise glucose in some people." An
 * entry that has ended shows its span: "(Nov 1, 2025 to Mar 1, 2026)".
 */
export function matchedSentence(m: Matched, markerName: string, formatWhen: (iso: string) => string): string {
  const what = lowerFirst(INFLUENCE_NAMES[m.influence.influence])
  const q = m.influence.qualifier ? ` ${m.influence.qualifier}` : ''
  const effect = m.influence.effect === 'vary' ? `${markerName} varies with ${what}${q}` : `${what} ${effectWords(m.influence.effect)} ${markerName}${q}`
  if (m.from.kind === 'timeline') {
    const { start, end, name } = m.from.entry
    return `Your timeline includes ${name} (${end ? `${formatWhen(start)} to ${formatWhen(end)}` : `from ${formatWhen(start)}`}); ${effect}.`
  }
  return `The ${formatWhen(m.from.date)} test ${TEST_NOTES[m.influence.influence] ?? 'has a note about it'}; ${effect}.`
}

/** "Vitamin D supplements" → "vitamin D supplements"; "GLP-1 medicines" stays as it is. */
export const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

const TEST_NOTES: Partial<Record<InfluenceId, string>> = {
  eating: 'was not fasting',
  illness: 'came after a recent illness',
  'hard-exercise': 'came after hard exercise',
  alcohol: 'came after alcohol',
}
