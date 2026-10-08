// The models the apps offer. Changing the default is one line. Prices are US dollars per million
// tokens, from Anthropic's pricing page on October 6, 2026, and only used for rough cost estimates.
// Haiku 4.5 is left out because it's due to retire from October 15, 2026; Fable 5.1 because Anthropic
// requires 30-day retention for it.

export type ModelInfo = { id: string; label: string; inputPerMTok: number; outputPerMTok: number }

export const MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)', inputPerMTok: 2, outputPerMTok: 10 },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (more capable, about twice the cost)', inputPerMTok: 4, outputPerMTok: 20 },
]

export const DEFAULT_MODEL = MODELS[0].id

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}

// A rough cost in US cents, for the "what will be sent" sheet.
export function estimateCents(model: string, inputTokens: number, outputTokens: number): number {
  const m = modelInfo(model)
  return ((inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000) * 100
}
