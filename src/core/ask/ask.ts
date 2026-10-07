// Sends a question with the app's facts and the thread so far, and checks the answer before it's
// shown (model.ts). One retry tells the AI what failed; after that the answer is withheld.

import { askJson, type AiUsage } from '../ai/client'
import { ANSWER_SCHEMA, checkAnswer, historyText, parseAnswer, type Answer, type AskTurn } from './model'

export type AskOutcome = { answer: Answer; usage: AiUsage } | { withheld: string[]; usage: AiUsage }

export async function askQuestion(o: {
  apiKey: string
  model: string
  system: string
  /** The facts as the AI sees them (JSON text), and as the code checks them. */
  factsText: string
  facts: unknown
  history: AskTurn[]
  question: string
  banned?: RegExp[]
  /** The units whose numbers must be declared (GROWTH_UNITS by default). */
  units?: string[]
  /** Who the facts are about, for the retry's wording: "the baby", "the person" (the default). */
  subject?: string
  signal?: AbortSignal
}): Promise<AskOutcome> {
  const earlier = historyText(o.history)
  const base = `${o.factsText}${earlier ? `\n\nEarlier in this conversation:\n${earlier}` : ''}\n\nQuestion: ${o.question}`
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  let problems: string[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = attempt === 0 ? base : `${base}\n\nYour previous answer was withheld because: ${problems.join('; ')}. Answer again, following the rules: declare every number about ${o.subject ?? 'the person'} in "numbers" with the fact it came from, and use no other numbers with units.`
    const { value, usage: u } = await askJson({ apiKey: o.apiKey, model: o.model, system: o.system, content: [{ type: 'text', text }], maxTokens: 1200, signal: o.signal }, ANSWER_SCHEMA, parseAnswer)
    usage.inputTokens += u.inputTokens
    usage.outputTokens += u.outputTokens
    if (value.kind === 'out-of-scope') return { answer: value, usage }
    const check = checkAnswer(value, o.facts, o.banned, o.units)
    if (check.ok) return { answer: value, usage }
    problems = check.problems
  }
  return { withheld: problems, usage }
}
