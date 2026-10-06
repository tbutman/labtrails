// Checks the colours in the shared tokens and LabTrails' accent against the kit's contrast rules
// (src/core/ui/README.md), in both modes, by reading the CSS files themselves.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/core/ui/tokens.css', 'utf8')
const accent = readFileSync('src/app/styles/accent.css', 'utf8')

function vars(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2].toLowerCase()]))
}
const lightBlock = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('@media (prefers-color-scheme: dark)'))
const darkBlock = tokens.slice(tokens.indexOf(":root[data-theme='dark']"), tokens.indexOf(":root[data-theme='light']"))
const a = vars(accent)
const light: Record<string, string> = { ...vars(lightBlock), accent: a['accent-light'], 'accent-text': a['accent-text-light'], 'accent-soft': a['accent-soft-light'], 'on-accent': a['on-accent-light'] }
const dark: Record<string, string> = { ...vars(darkBlock), accent: a['accent-dark'], 'accent-text': a['accent-text-dark'], 'accent-soft': a['accent-soft-dark'], 'on-accent': a['on-accent-dark'], primary: a['accent-dark'], 'primary-hover': a['accent-text-dark'] }

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio(a: string, b: string) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s mode', (_mode, c) => {
  const surfaces = ['bg', 'surface', 'surface-2', 'surface-3'] as const

  it.each(['text', 'text-muted', 'text-faint', 'accent-text'])('%s is at least 4.5:1 on every surface', (fg) => {
    for (const s of surfaces) expect(ratio(c[fg], c[s]), `${fg} on ${s}`).toBeGreaterThanOrEqual(4.5)
  })

  it('text and accent text are readable on the accent tint', () => {
    expect(ratio(c.text, c['accent-soft'])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(c['accent-text'], c['accent-soft'])).toBeGreaterThanOrEqual(4.5)
  })

  it('text on accent fills and on the primary button is at least 4.5:1', () => {
    expect(ratio(c['on-accent'], c.accent)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(c['on-primary'] ?? '#ffffff', c.primary)).toBeGreaterThanOrEqual(4.5)
    if (c['primary-hover']) expect(ratio(c['on-primary'] ?? '#ffffff', c['primary-hover'])).toBeGreaterThanOrEqual(4.5)
  })

  it('control borders are at least 3:1 against the surfaces they sit on', () => {
    for (const s of ['bg', 'surface'] as const) expect(ratio(c['control-border'], c[s]), `control-border on ${s}`).toBeGreaterThanOrEqual(3)
  })

  it('the focus ring (accent text) is at least 3:1 against the page', () => {
    expect(ratio(c['accent-text'], c.bg)).toBeGreaterThanOrEqual(3)
  })
})
