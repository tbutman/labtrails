import { describe, expect, it } from 'vitest'
import { getMarker } from '../../src/labs/catalogue/catalogue'
import { INFLUENCES } from '../../src/labs/influences-data'
import { contextInfluences, entryInfluences, matchInfluences, matchedSentence } from '../../src/labs/influences'
import { DEMO_REPORTS, DEMO_TIMELINE } from '../../src/app/demo'

describe('what a timeline entry stands for', () => {
  it('recognises common medicine names, in English and Portuguese', () => {
    const cases: [string, string][] = [
      ['Sustanon 250', 'testosterone'],
      ['Testosterone enanthate', 'testosterone'],
      ['Mounjaro', 'glp1'],
      ['Ozempic 0.5 mg', 'glp1'],
      ['Atorvastatina', 'statin'],
      ['Euthyrox', 'thyroid-hormone'],
      ['Prednisolona', 'corticosteroid'],
      ['Ibuprofeno', 'nsaid'],
      ['Ferro (sulfato ferroso)', 'iron'],
      ['Vitamin D3', 'vitamin-d'],
      ['Biotina', 'biotin'],
      ['Smoking', 'smoking'],
    ]
    for (const [name, id] of cases) expect(entryInfluences({ name }), name).toContain(id)
  })

  it('never counts a "stopped" entry as the thing itself', () => {
    expect(entryInfluences({ name: 'Stopped alcohol' })).toEqual([])
    expect(entryInfluences({ name: 'Quit smoking' })).toEqual([])
    expect(entryInfluences({ name: 'Deixei de fumar' })).toEqual([])
  })

  it("doesn't read unrelated names as medicines, or ongoing training as exercise right before a test", () => {
    expect(entryInfluences({ name: 'Moved to Lisbon' })).toEqual([])
    expect(entryInfluences({ name: 'Marathon training' })).toEqual([])
    expect(entryInfluences({ name: 'Omega-3' })).toEqual([])
  })

  it("reads a test's notes", () => {
    expect(contextInfluences({ fasting: 'no', recently: ['illness', 'poor-sleep', 'hard-exercise'] })).toEqual(['eating', 'illness', 'hard-exercise'])
    expect(contextInfluences({ fasting: 'yes' })).toEqual([])
  })
})

describe('the influence table', () => {
  it('cites only MedlinePlus, the NHS or testing.com, for catalogue markers, with a quote, each pair once', () => {
    const seen = new Set<string>()
    for (const i of INFLUENCES) {
      expect(i.source.url, i.source.title).toMatch(/^https:\/\/(medlineplus\.gov\/lab-tests|www\.nhs\.uk|www\.testing\.com\/tests)\//)
      expect(i.source.quote.length).toBeGreaterThan(20)
      for (const m of i.markers) {
        expect(getMarker(m), m).toBeDefined()
        const key = `${m}|${i.influence}|${i.effect}`
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
    }
  })

  it("doesn't claim what the sources don't say", () => {
    const has = (marker: string, influence: string) => INFLUENCES.some((i) => i.markers.includes(marker) && i.influence === influence)
    expect(has('rbc', 'testosterone')).toBe(true)
    expect(has('haematocrit', 'testosterone')).toBe(false)
    expect(has('haemoglobin', 'testosterone')).toBe(false)
    expect(has('ferritin', 'iron')).toBe(false)
    expect(has('tsh', 'biotin')).toBe(false)
  })
})

describe('matching the timeline and a test\'s notes', () => {
  const when = (iso: string) => iso
  it('matches an active timeline entry, and a test that came after hard exercise', () => {
    const latest = DEMO_REPORTS.at(-1)!
    const vitd = matchInfluences('vitamin-d', DEMO_TIMELINE, latest)
    expect(vitd.map((m) => matchedSentence(m, 'vitamin D', when))).toEqual(['Your timeline includes Vitamin D3 (from 2024-11); vitamin D supplements are known to raise vitamin D.'])
    const run = DEMO_REPORTS.find((r) => r.context?.recently?.includes('hard-exercise'))!
    expect(matchInfluences('alt', DEMO_TIMELINE, run).map((m) => matchedSentence(m, 'ALT', when))).toEqual([`The ${run.date} test came after hard exercise; hard exercise before the test is known to raise ALT.`])
    expect(matchInfluences('ferritin', DEMO_TIMELINE, latest)).toEqual([])
  })
})
