import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/core/ai/Markdown'
import { DEMO_SUMMARIES } from '../../src/app/demo'

describe('AI output is never rendered as HTML', () => {
  it.each([
    '<img src=x onerror="alert(1)">',
    '<script>alert(1)</script>',
    '**<a href="javascript:alert(1)">bold link</a>**',
    '- <iframe src="https://example.com"></iframe>',
    '<style>body{display:none}</style>',
  ])('shows %s as text', (text) => {
    const html = renderToStaticMarkup(<Markdown text={text} />)
    expect(html).not.toMatch(/<(img|script|a|iframe|style)\b/i)
    expect(html).toContain('&lt;')
  })

  it('renders the small Markdown subset it supports', () => {
    const html = renderToStaticMarkup(<Markdown text={'Intro **bold**\n\n- one\n- two\n\n1. first\n2. second'} />)
    expect(html).toBe('<div class="ai-text"><p>Intro <strong>bold</strong></p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol></div>')
  })
})

// The pre-written demo summaries follow the same rules as the real prompts (SPEC.md section 11).
describe('demo summaries keep to the not-medical-advice rules', () => {
  const forbidden = [/diagnos/i, /\byou have\b/i, /\bhealthy\b/i, /\bnormal\b/i, /\babnormal\b/i, /\bdisease\b/i, /\bdeficien/i, /\bdiabet/i, /\btake\b/i, /\bsupplement/i, /\bdose\b/i, /\bstart\b/i, /\bstop\b/i, /\btreat/i]
  it.each(DEMO_SUMMARIES.map((s) => [s.id, s.text]))('%s', (_id, text) => {
    for (const re of forbidden) expect(text, String(re)).not.toMatch(re)
    expect(text).toMatch(/doctor/i)
  })
})
