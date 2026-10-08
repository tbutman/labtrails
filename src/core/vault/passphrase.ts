// What a new passphrase must be, and a rough three-step strength hint. The rules only stop the
// obvious (too short, too few different characters, one word repeated, the app's own name); the hint
// nudges towards four random words, which are easy to type and hard to guess.

export const MIN_PASSPHRASE_LENGTH = 12

export type PassphraseStrength = 'weak' | 'ok' | 'strong'

export type PassphraseCheck = {
  /** Why it can't be used, for the user. Undefined when it can. */
  problem?: string
  strength: PassphraseStrength
}

export const STRENGTH_HINTS: Record<PassphraseStrength, string> = {
  weak: "Weak: try four random words, like 'quartz meadow tulip anchor'.",
  ok: 'OK',
  strong: 'Strong',
}

const distinct = (s: string) => new Set(s).size

// "monkeymonkeymonkey", "abcabcabcabc": the whole thing is one shorter piece repeated.
function isRepeated(s: string): boolean {
  for (let size = 1; size <= s.length / 2; size++) {
    if (s.length % size === 0 && s.slice(0, size).repeat(s.length / size) === s) return true
  }
  return false
}

/** Checks a new passphrase. `appName` is the app's name or ID ("babytrails"), which can't be most of it. */
export function checkPassphrase(passphrase: string, appName = ''): PassphraseCheck {
  const text = passphrase.normalize('NFC')
  const compact = text.toLowerCase().replace(/[\s\-_.,]+/g, '')
  const name = appName.toLowerCase().replace(/\s+/g, '')
  const words = text.split(/[\s\-_.,]+/).filter((w) => w.length >= 3)

  let problem: string | undefined
  if ([...text].length < MIN_PASSPHRASE_LENGTH) problem = `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`
  else if (distinct(compact) < 4) problem = 'Use at least 4 different characters.'
  else if (isRepeated(compact)) problem = "Don't repeat one word. Try four different random words."
  else if (name && distinct(compact.replaceAll(name, '').replace(/[^\p{L}]/gu, '')) < 4) problem = `Don't build it from the name ${appName}. Try four random words.`

  const strength: PassphraseStrength = problem
    ? 'weak'
    : words.length >= 4 || ([...text].length >= 24 && distinct(compact) >= 10)
      ? 'strong'
      : [...text].length >= 16 || words.length >= 3
        ? 'ok'
        : 'weak'
  return { problem, strength }
}
