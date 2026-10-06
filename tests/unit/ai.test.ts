import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiError, ANTHROPIC_URL, askJson, askText } from '../../src/core/ai/client'
import { Markdown } from '../../src/core/ai/Markdown'
import { redactNames } from '../../src/core/ai/redact'
import { DEFAULT_MODEL, estimateCents } from '../../src/core/ai/models'

const KEY = 'sk-ant-test-0000-not-a-real-key'
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const ok = (text: string) => reply({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' })

afterEach(() => vi.unstubAllGlobals())

describe('AI client', () => {
  it('calls Anthropic directly with the browser-access header and the user key', async () => {
    const fetch = vi.fn().mockResolvedValue(ok('Hello'))
    vi.stubGlobal('fetch', fetch)
    const out = await askText({ apiKey: KEY, model: DEFAULT_MODEL, system: 'sys', content: [{ type: 'text', text: 'hi' }] })
    expect(out.text).toBe('Hello')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(ANTHROPIC_URL)
    expect(init.headers['x-api-key']).toBe(KEY)
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
    expect(init.credentials).toBe('omit')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'claude-sonnet-5-5', system: 'sys' })
  })

  it('asks for structured output and validates it', async () => {
    const fetch = vi.fn().mockResolvedValue(ok('{"n": 2}'))
    vi.stubGlobal('fetch', fetch)
    const schema = { type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false }
    const out = await askJson({ apiKey: KEY, model: DEFAULT_MODEL, system: '', content: [] }, schema, (v) => v as { n: number })
    expect(out.value).toEqual({ n: 2 })
    expect(JSON.parse(fetch.mock.calls[0][1].body).output_config).toEqual({ format: { type: 'json_schema', schema } })
  })

  it('rejects output that is not JSON or fails validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('not json')))
    await expect(askJson({ apiKey: KEY, model: DEFAULT_MODEL, system: '', content: [] }, {}, (v) => v)).rejects.toMatchObject({ kind: 'output' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('{"n": "x"}')))
    const strict = (v: unknown) => {
      if (typeof (v as { n: unknown }).n !== 'number') throw new AiError('output', 'bad')
      return v
    }
    await expect(askJson({ apiKey: KEY, model: DEFAULT_MODEL, system: '', content: [] }, {}, strict)).rejects.toMatchObject({ kind: 'output' })
  })

  it('explains errors without ever including the key', async () => {
    for (const [status, kind] of [[401, 'key'], [429, 'limit'], [529, 'busy'], [400, 'request']] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { message: 'details from Anthropic' } }, status)))
      const err = await askText({ apiKey: KEY, model: DEFAULT_MODEL, system: '', content: [] }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AiError)
      expect((err as AiError).kind).toBe(kind)
      expect(String((err as Error).message) + String((err as Error).stack)).not.toContain(KEY)
    }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(askText({ apiKey: KEY, model: DEFAULT_MODEL, system: '', content: [] })).rejects.toMatchObject({ kind: 'network' })
  })

  it('estimates cost from the model price', () => {
    expect(estimateCents('claude-sonnet-5-5', 2000, 400)).toBeCloseTo(0.8, 5)
    expect(estimateCents('claude-opus-5-5', 2000, 400)).toBeCloseTo(1.6, 5)
  })
})

describe('name placeholder', () => {
  it('replaces whole names in any case, including accents', () => {
    expect(redactNames('João gained 200 g. joão is well. Joãozinho too.', ['João Silva'], 'the baby')).toBe(
      'the baby gained 200 g. the baby is well. Joãozinho too.',
    )
    expect(redactNames('Sam and Samuel', ['Sam'], '[child]')).toBe('[child] and Samuel')
    expect(redactNames('Nothing to hide', [undefined, ''], 'x')).toBe('Nothing to hide')
  })
})

describe('AI output rendering', () => {
  const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }))

  it('never turns AI text into HTML', () => {
    const out = html('<img src=x onerror="alert(1)"> and <script>alert(2)</script> [link](https://evil.example)')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<a ')
    expect(out).toContain('&lt;img')
  })

  it('renders the small Markdown subset', () => {
    expect(html('Hello **there**\n\n- one\n- two\n\n1. first')).toBe(
      '<div class="ai-text"><p>Hello <strong>there</strong></p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol></div>',
    )
    expect(html('## Heading')).toBe('<div class="ai-text"><p><strong>Heading</strong></p></div>')
  })
})
