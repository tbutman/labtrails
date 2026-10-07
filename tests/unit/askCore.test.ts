// The core's Ask check on its own, with made-up facts (X-10): no app code.
import { describe, expect, it } from 'vitest'
import { checkAnswer, firstNumber, measurementNumbers, type Answer } from '../../src/core/ask/model'
import { bannedPhrase, BANNED_PHRASES, BANNED_WORDS_TEXT } from '../../src/core/ask/wording'

const facts = { gain: { perWeekGrams: 120 }, loss: { perWeekGrams: -120 }, fromBirth: -5.8, percentile: 59, low: 2, z: -1.24 }
const answer = (text: string, numbers: Answer['numbers']): Answer => ({ kind: 'answer', text, numbers })

describe('the sign of a number (CORE-05)', () => {
  it('passes numbers whose direction matches the fact', () => {
    for (const [text, said, fact] of [
      ['Weight went up by 120 g a week.', '120 g a week', 'gain.perWeekGrams'],
      ['Your baby gained 120 g a week.', '120 g a week', 'gain.perWeekGrams'],
      ['Your baby lost 120 g a week.', '120 g a week', 'loss.perWeekGrams'],
      ['That was −120 g a week.', '−120 g a week', 'loss.perWeekGrams'],
      ['Weight went down by about 120 g a week.', '120 g a week', 'loss.perWeekGrams'],
      ['At the lowest, weight was 5.8% below birth weight.', '5.8%', 'fromBirth'],
      ['The lowest weight was a loss of 5.8% from birth weight.', '5.8%', 'fromBirth'],
      ['Weight fell to the 2nd percentile.', '2nd percentile', 'low'],
      ['Weight moved down from about the 59th percentile.', '59th percentile', 'percentile'],
      ['A z-score of −1.24.', '−1.24', 'z'],
    ] as const) {
      expect(checkAnswer(answer(text, [{ text: said, fact }]), facts), text).toEqual({ ok: true, problems: [] })
    }
  })

  it('withholds a gain described as a loss, and a loss described as a gain', () => {
    const lostGain = checkAnswer(answer('Your baby lost 120 g a week.', [{ text: '120 g a week', fact: 'gain.perWeekGrams' }]), facts)
    expect(lostGain.ok).toBe(false)
    expect(lostGain.problems.join()).toMatch(/opposite of gain\.perWeekGrams/)
    expect(checkAnswer(answer('Your baby gained 120 g a week.', [{ text: '120 g a week', fact: 'loss.perWeekGrams' }]), facts).ok).toBe(false)
    expect(checkAnswer(answer('The weekly gain was 120 g a week.', [{ text: '120 g a week', fact: 'loss.perWeekGrams' }]), facts).ok).toBe(false)
    expect(checkAnswer(answer('Weight changed by +120 g a week.', [{ text: '+120 g a week', fact: 'loss.perWeekGrams' }]), facts).ok).toBe(false)
  })

  it('withholds an undeclared copy of a number with the opposite sign', () => {
    const a = answer('Your baby gained 120 g a week, then lost 120 g a week.', [{ text: '120 g a week', fact: 'gain.perWeekGrams' }])
    expect(checkAnswer(a, facts).problems.join()).toMatch(/isn't one of the declared numbers/)
  })

  it('reads a dash between numbers as a range, not a minus', () => {
    expect(firstNumber('1.1-1.5 kg', 3)).toMatchObject({ value: 1.5, signed: false })
    expect(measurementNumbers('between 1.1-1.5 kg').map((t) => t.value)).toEqual([1.5])
    expect(measurementNumbers('a change of -120 g').map((t) => t.value)).toEqual([-120])
  })
})

describe('the shared banned list (CORE-04)', () => {
  it('catches judgments, reassurance and alarm', () => {
    for (const text of [
      'Your baby is healthy.',
      'This is completely normal.',
      'That looks fine.',
      'Her weight is good.',
      'This is good news.',
      'There is nothing serious here.',
      'Nothing to worry about.',
      'This is reassuring.',
      'A worrying drop.',
      'Your baby is thriving.',
      'This puts your baby at risk.',
    ]) {
      expect(bannedPhrase(text), text).toBeDefined()
      expect(checkAnswer(answer(text, []), {}).ok, text).toBe(false)
    }
  })

  it("doesn't catch the same words where they don't judge", () => {
    for (const text of ['Fine motor skills are a separate topic.', 'A good time to ask is at the next check-up.', 'The 50th percentile line is the middle one.']) {
      expect(bannedPhrase(text), text).toBeUndefined()
    }
  })

  it("can let a document's own quoted words through, for document summaries", () => {
    expect(bannedPhrase('The note says "normal development".')).toBe('normal')
    expect(bannedPhrase('The note says "normal development".', [], { allowQuoted: true })).toBeUndefined()
    expect(bannedPhrase('The note says “normal development”, which is reassuring.', [], { allowQuoted: true })).toBe('reassuring')
  })

  it('always applies, with any extra phrases the app adds', () => {
    const extra = [/\boptimal\b/i]
    expect(checkAnswer(answer('Optimal.', []), {}, extra).ok).toBe(false)
    expect(checkAnswer(answer('Healthy.', []), {}, extra).ok).toBe(false)
    expect(BANNED_PHRASES.length).toBeGreaterThan(0)
    expect(BANNED_WORDS_TEXT).toMatch(/^"healthy", .* or "thriving"$/)
  })
})
