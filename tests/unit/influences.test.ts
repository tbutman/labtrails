import { describe, expect, it } from 'vitest'
import { getMarker } from '../../src/labs/catalogue/catalogue'
import { INFLUENCES } from '../../src/labs/influences-data'
import { contextInfluences, entryInfluences, lowerFirst, matchInfluences, matchedSentence } from '../../src/labs/influences'
import { DEMO_REPORTS, DEMO_TIMELINE } from '../../src/app/demo'

describe('what a timeline entry stands for', () => {
  it('recognizes common medicine names, in English and Portuguese', () => {
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

  it('counts levothyroxine but not liothyronine, and no steroid creams, sprays or inhalers', () => {
    expect(entryInfluences({ name: 'Levothyroxine 50 mcg' })).toContain('thyroid-hormone')
    expect(entryInfluences({ name: 'Liothyronine' })).toEqual([])
    expect(entryInfluences({ name: 'Prednisolone 5 mg' })).toContain('corticosteroid')
    for (const name of ['Hydrocortisone cream', 'Budesonide inhaler', 'Corticosteroid nasal spray', 'Dexamethasone eye drops']) expect(entryInfluences({ name }), name).toEqual([])
  })

  it("reads a test's notes", () => {
    expect(contextInfluences({ fasting: 'no', recently: ['illness', 'poor-sleep', 'hard-exercise'] })).toEqual(['eating', 'illness', 'hard-exercise'])
    expect(contextInfluences({ fasting: 'yes' })).toEqual([])
  })
})

describe('the influence table', () => {
  it('cites only MedlinePlus, the NHS, Lab Tests Online UK or testing.com, for catalog markers, with a quote, each pair once', () => {
    const seen = new Set<string>()
    for (const i of INFLUENCES) {
      expect(i.source.url, i.source.title).toMatch(/^https:\/\/(medlineplus\.gov\/|www\.nhs\.uk\/|labtestsonline\.org\.uk\/tests\/|www\.testing\.com\/tests\/)/)
      if (i.source.url.includes('testing.com')) expect(i.source.title).toMatch(/^Testing\.com \(formerly Lab Tests Online\): /)
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

  it('keeps each sentence no stronger than its source', () => {
    const q = (marker: string, influence: string) => INFLUENCES.find((i) => i.markers.includes(marker) && i.influence === influence)?.qualifier
    expect(q('glucose', 'statin')).toBe('in some people')
    expect(q('free-t4', 'biotin')).toBe('at high doses, on some lab machines')
    expect(q('free-t4', 'thyroid-hormone')).toBe('for a few hours after a dose')
    expect(q('alt', 'alcohol')).toBe('with heavy drinking in the day or two before')
  })
})

describe('matching the timeline and a test\'s notes', () => {
  const when = (iso: string) => iso
  it('matches an active timeline entry, and a test that came after hard exercise', () => {
    const latest = DEMO_REPORTS.at(-1)!
    const vitd = matchInfluences('vitamin-d', DEMO_TIMELINE, latest)
    expect(vitd.map((m) => matchedSentence(m, 'vitamin D', when))).toEqual(['Your timeline includes Vitamin D3 (from 2024-11); vitamin D supplements can raise vitamin D.'])
    const run = DEMO_REPORTS.find((r) => r.context?.recently?.includes('hard-exercise'))!
    expect(matchInfluences('alt', DEMO_TIMELINE, run).map((m) => matchedSentence(m, 'ALT', when))).toEqual([`The ${run.date} test came after hard exercise; hard exercise before the test can raise ALT when it was strenuous.`])
    expect(matchInfluences('ferritin', DEMO_TIMELINE, latest)).toEqual([])
  })

  it('says "can", with the source\'s limits, and shows an ended entry\'s span', () => {
    const statin = { id: 's', profileId: 'p', kind: 'medication' as const, name: 'Atorvastatin', start: '2025-11-01', end: '2026-03-01', createdAt: '', updatedAt: '' }
    const [m] = matchInfluences('glucose', [statin], { date: '2026-01-10' })
    expect(matchedSentence(m, 'glucose', when)).toBe('Your timeline includes Atorvastatin (2025-11-01 to 2026-03-01); statins can raise glucose in some people.')
  })

  it('matches alcohol to ALT and AST only from the test\'s "recent alcohol" note', () => {
    const wine = { id: 'w', profileId: 'p', kind: 'lifestyle' as const, name: 'Wine with dinner', start: '2025-01-01', createdAt: '', updatedAt: '' }
    expect(matchInfluences('alt', [wine], { date: '2026-01-10' })).toEqual([])
    expect(matchInfluences('alt', [], { date: '2026-01-10', context: { recently: ['alcohol'] } })).toHaveLength(1)
    expect(matchInfluences('triglycerides', [wine], { date: '2026-01-10' })).toHaveLength(1)
  })
})

describe('influence names mid-sentence (LAB-20)', () => {
  it('lowers a leading "A"', () => {
    expect(lowerFirst('A recent illness or infection')).toBe('a recent illness or infection')
    expect(lowerFirst('GLP-1 medicines (semaglutide, tirzepatide)')).toBe('GLP-1 medicines (semaglutide, tirzepatide)')
  })
})
