// Calls Anthropic's Messages API straight from the browser with the user's own key. The key is only
// ever put in the request header to api.anthropic.com; it never appears in errors or logs.
//
// Browser calls need the header `anthropic-dangerous-direct-browser-access: true`: without it the
// API sends no CORS headers and the browser blocks the response. Anthropic's SDK guards it because
// shipping your own key to visitors is risky; here each user brings their own key, stored in their
// own encrypted vault. See THREAT_MODEL.md.

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } }

export type AiRequest = {
  apiKey: string
  model: string
  system: string
  content: ContentBlock[]
  maxTokens?: number
  signal?: AbortSignal
}

export type AiUsage = { inputTokens: number; outputTokens: number }

export class AiError extends Error {
  readonly kind: 'key' | 'limit' | 'busy' | 'request' | 'network' | 'output'
  constructor(kind: AiError['kind'], message: string) {
    super(message)
    this.name = 'AiError'
    this.kind = kind
  }
}

async function post(req: AiRequest, extra: Record<string, unknown>): Promise<{ text: string; usage: AiUsage; stopReason: string }> {
  let response: Response
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 1500,
        system: req.system,
        messages: [{ role: 'user', content: req.content }],
        ...extra,
      }),
      signal: req.signal,
      referrerPolicy: 'no-referrer',
      credentials: 'omit',
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new AiError(
      'network',
      "Couldn't reach Anthropic. Check your connection. If your Anthropic organisation has zero data retention, browser requests aren't allowed for it; use a key from another organisation.",
    )
  }

  if (!response.ok) throw await errorFor(response)
  const body = (await response.json()) as {
    content?: { type: string; text?: string }[]
    usage?: { input_tokens: number; output_tokens: number }
    stop_reason?: string
  }
  const text = (body.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  return {
    text,
    usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 },
    stopReason: body.stop_reason ?? '',
  }
}

async function errorFor(response: Response): Promise<AiError> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // Not JSON; the status is enough.
  }
  switch (response.status) {
    case 401:
    case 403:
      return new AiError('key', 'Anthropic didn\'t accept the API key. Check it in Settings.')
    case 429:
      return new AiError('limit', 'Anthropic says you\'ve hit a rate or spending limit. Try again later, or check your limits in the Anthropic Console.')
    case 413:
      return new AiError('request', 'That document is too large to send. Try a smaller file or fewer pages.')
    case 500:
    case 529:
      return new AiError('busy', 'Anthropic is busy right now. Try again in a minute.')
    default:
      // Anthropic's own message, which never contains the key.
      return new AiError('request', `Anthropic couldn't handle the request${detail ? `: ${detail}` : '.'}`)
  }
}

// Plain-text answer.
export async function askText(req: AiRequest): Promise<{ text: string; usage: AiUsage }> {
  const { text, usage } = await post(req, {})
  if (!text.trim()) throw new AiError('output', 'Anthropic sent back an empty answer.')
  return { text, usage }
}

// Structured answer: the model must reply with JSON matching `schema` (structured outputs), and the
// app's validator decides what's usable. Invalid output is an error, never saved.
export async function askJson<T>(req: AiRequest, schema: object, validate: (value: unknown) => T): Promise<{ value: T; usage: AiUsage }> {
  const { text, usage, stopReason } = await post(req, { output_config: { format: { type: 'json_schema', schema } } })
  if (stopReason === 'max_tokens') throw new AiError('output', 'The answer was cut off. Try a shorter document.')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AiError('output', "Anthropic's answer wasn't in the expected format.")
  }
  return { value: validate(parsed), usage }
}

// Encodes bytes for a document or image block.
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function pdfBlock(bytes: Uint8Array): ContentBlock {
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } }
}

export function imageBlock(bytes: Uint8Array, mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'): ContentBlock {
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: toBase64(bytes) } }
}

// Shrinks a photo so its long edge is at most `maxEdge` pixels, as JPEG. Saves tokens and keeps
// phone photos under Anthropic's per-image limit. Returns the original if it's already small.
export async function shrinkImage(
  bytes: Uint8Array<ArrayBuffer>,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  maxEdge = 2000,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mediaType }))
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && bytes.length < 4 * 1024 * 1024) {
    bitmap.close()
    return { bytes, mediaType }
  }
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mediaType: 'image/jpeg' }
}
