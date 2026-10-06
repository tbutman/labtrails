import { describe, expect, it } from 'vitest'
import { checkAnswer, GROWTH_UNITS, type Answer } from '../../src/core/ask/model'
import { DEMO_ANSWERS, DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS } from '../../src/app/demo'
import { ASK_BANNED, askFacts, askFactsText, askSuggestions, LAB_UNITS, namedMarkers } from '../../src/labs/ai/ask'
import type { Profile, Report, Result } from '../../src/labs/types'

const TODAY = '2026-10-06'

describe('which markers a question is about', () => {
  it('finds markers by English or Portuguese name, and whole panels by a word', () => {
    expect(namedMarkers('How has my ferritin changed?')).toEqual(['ferritin'])
    expect(namedMarkers('Como está a minha glicose?')).toEqual(['glucose'])
    expect(namedMarkers('What about my cholesterol?')).toEqual(expect.arrayContaining(['cholesterol-total', 'hdl', 'ldl', 'triglycerides']))
    expect(namedMarkers('What changed since last time?')).toEqual([])
  })

  it('sends the named markers, a follow-up keeps the earlier ones, and a general question gets the flagged ones', () => {
    const named = askFacts(DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, 'How has my glucose changed?', {}, TODAY)
    expect(named.selection).toBe('named in the question')
    expect(named.markers.map((m) => m.marker)).toEqual(['Glucose'])
    expect(named.otherMarkers).toContain('Ferritin')

    const followUp = askFacts(DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, ['How has my glucose changed?', 'And in 2024?'], {}, TODAY)
    expect(followUp.markers.map((m) => m.marker)).toEqual(['Glucose'])

    const general = askFacts(DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, 'What changed?', {}, TODAY)
    expect(general.selection).toBe('flagged by LabTrails')
    expect(general.markers.length).toBeGreaterThan(3)
  })

  it("carries each lab's range, and never the name or date of birth", () => {
    const facts = askFacts(DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, 'my glucose', {}, TODAY)
    expect(facts.markers[0].results.at(-1)).toMatchObject({ value: 112, range: { low: 70, high: 110 }, outsideRange: 'above' })
    const text = askFactsText(facts)
    expect(text).not.toContain(DEMO_PROFILE.name)
    if (DEMO_PROFILE.dateOfBirth) expect(text).not.toContain(DEMO_PROFILE.dateOfBirth)
  })
})

describe('values in another unit', () => {
  const profile: Profile = { id: 'p', name: 'Alex Example', createdAt: TODAY }
  const reports: Report[] = [{ id: 'r1', profileId: 'p', date: '2026-01-10', source: 'manual', createdAt: TODAY, updatedAt: TODAY }]
  const results: Result[] = [
    { id: 'x', reportId: 'r1', profileId: 'p', markerId: 'glucose', nameAsPrinted: 'Glucose', value: 5.4, unitAsPrinted: 'mmol/L', range: { text: '3.9 - 6.1', low: 3.9, high: 6.1 }, createdAt: TODAY, updatedAt: TODAY },
  ]

  it('gives the value in the unit shown, and as printed', () => {
    const facts = askFacts(profile, reports, results, 'glucose', { glucose: 'mg/dL' }, TODAY)
    const r = facts.markers[0].results[0]
    expect(facts.markers[0].unit).toBe('mg/dL')
    expect(r.value).toBeCloseTo(97.3, 1)
    expect(r.printed).toEqual({ value: 5.4, unit: 'mmol/L' })
  })

  it('checks lab units: an undeclared number is caught with LabTrails\' units, and missed with growth units', () => {
    const facts = askFacts(profile, reports, results, 'glucose', { glucose: 'mg/dL' }, TODAY)
    const cited: Answer = { kind: 'answer', text: 'Your glucose was 5.4 mmol/L.', numbers: [{ text: '5.4 mmol/L', fact: 'markers[0].results[0].printed.value' }] }
    expect(checkAnswer(cited, facts, ASK_BANNED, LAB_UNITS).ok).toBe(true)
    const invented: Answer = { kind: 'answer', text: 'Your glucose was 5.4 mmol/L; many labs use up to 5.6 mmol/L.', numbers: [{ text: '5.4 mmol/L', fact: 'markers[0].results[0].printed.value' }] }
    expect(checkAnswer(invented, facts, ASK_BANNED, LAB_UNITS).ok).toBe(false)
    expect(checkAnswer(invented, facts, ASK_BANNED, GROWTH_UNITS).ok).toBe(true)
    expect(LAB_UNITS).toEqual(expect.arrayContaining(['mg/dL', 'mmol/L', 'g/L', 'µIU/mL', 'uIU/mL', 'µmol/L', 'umol/L', 'ng/mL', '%']))
  })

  it('withholds reassurance', () => {
    const facts = askFacts(profile, reports, results, 'glucose', {}, TODAY)
    expect(checkAnswer({ kind: 'answer', text: 'This looks normal.', numbers: [] }, facts, ASK_BANNED, LAB_UNITS).ok).toBe(false)
  })
})

describe('the demo', () => {
  it("offers three questions, and each prepared answer passes the core's numbers check", () => {
    const suggestions = askSuggestions(DEMO_REPORTS, DEMO_RESULTS)
    expect(suggestions.map((s) => s.id)).toEqual(['trend', 'outside', 'changed'])
    for (const s of suggestions) {
      const facts = askFacts(DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, s.text, {}, TODAY)
      expect(checkAnswer(DEMO_ANSWERS[s.id], facts, ASK_BANNED, LAB_UNITS), s.text).toEqual({ ok: true, problems: [] })
    }
  })
})
