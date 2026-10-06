import { describe, expect, it } from 'vitest'
import { MARKERS, PANELS } from '../../src/labs/catalogue/catalogue'
import { matchMarker, normaliseName } from '../../src/labs/match/match'

const id = (name: string, unit?: string) => {
  const m = matchMarker(name, unit)
  return m.status === 'matched' ? m.markerId : m.status
}

describe('the catalogue', () => {
  it('has about 70 markers, each in a known panel, with unique IDs', () => {
    expect(MARKERS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(MARKERS.map((m) => m.id)).size).toBe(MARKERS.length)
    const panels = new Set(PANELS.map((p) => p.id))
    for (const m of MARKERS) expect(panels.has(m.panel)).toBe(true)
  })

  it('has no alias that means two markers, except count/percentage pairs told apart by unit', () => {
    const seen = new Map<string, string>()
    for (const m of MARKERS) {
      for (const alias of new Set([m.name, ...m.aliases].map(normaliseName))) {
        const other = seen.get(alias)
        if (other && other.replace(/-pct$/, '') !== m.id.replace(/-pct$/, '')) {
          throw new Error(`"${alias}" means both ${other} and ${m.id}`)
        }
        seen.set(alias, m.id)
      }
    }
  })
})

describe('matchMarker: English names', () => {
  it.each([
    ['Glucose', 'glucose'],
    ['Fasting Glucose', 'glucose'],
    ['Hemoglobin A1c', 'hba1c'],
    ['LDL Cholesterol', 'ldl'],
    ['HDL-C', 'hdl'],
    ['Triglycerides', 'triglycerides'],
    ['ALT', 'alt'],
    ['Creatinine, Serum', 'creatinine'],
    ['BUN', 'bun'],
    ['Vitamin D, 25-Hydroxy', 'vitamin-d'],
    ['TSH', 'tsh'],
    ['Free T4', 'free-t4'],
    ['Ferritin', 'ferritin'],
    ['hs-CRP', 'hs-crp'],
    ['LDL Cholesterol Calc', 'ldl'],
    ['Bilirubin, Direct', 'bilirubin-direct'],
    ['Bilirubin, Total', 'bilirubin-total'],
  ])('%s → %s', (name, expected) => {
    expect(id(name)).toBe(expected)
  })
})

describe('matchMarker: Portuguese names', () => {
  it.each([
    ['Glicose', 'glucose'],
    ['Glicemia em jejum', 'glucose'],
    ['Glicose (jejum)', 'glucose'],
    ['Hemoglobina glicada', 'hba1c'],
    ['Hemoglobina glicada (HbA1c)', 'hba1c'],
    ['Colesterol total', 'cholesterol-total'],
    ['Colesterol HDL', 'hdl'],
    ['Colesterol LDL', 'ldl'],
    ['Triglicéridos', 'triglycerides'],
    ['Triglicerideos', 'triglycerides'],
    ['TGO/AST', 'ast'],
    ['AST (TGO)', 'ast'],
    ['TGP', 'alt'],
    ['Gama-GT', 'ggt'],
    ['Fosfatase alcalina', 'alp'],
    ['Bilirrubina directa', 'bilirubin-direct'],
    ['Bilirrubina direta', 'bilirubin-direct'],
    ['Creatinina', 'creatinine'],
    ['Ureia', 'urea'],
    ['Ácido úrico', 'uric-acid'],
    ['Sódio', 'sodium'],
    ['Potássio', 'potassium'],
    ['T4 livre', 'free-t4'],
    ['Ferro sérico', 'iron'],
    ['Ferritina', 'ferritin'],
    ['Saturação da transferrina', 'transferrin-saturation'],
    ['25-OH Vitamina D', 'vitamin-d'],
    ['Vitamina B12', 'vitamin-b12'],
    ['Ácido fólico', 'folate'],
    ['Testosterona total', 'testosterone'],
    ['Proteína C reactiva', 'crp'],
    ['Velocidade de sedimentação', 'esr'],
    ['Hemoglobina', 'haemoglobin'],
    ['Leucócitos', 'wbc'],
    ['Plaquetas', 'platelets'],
    ['VGM', 'mcv'],
  ])('%s → %s', (name, expected) => {
    expect(id(name)).toBe(expected)
  })
})

describe('matchMarker: units, unknowns and user mappings', () => {
  it('uses the unit to tell a count from a percentage', () => {
    expect(id('Neutrófilos', '%')).toBe('neutrophils-pct')
    expect(id('Neutrófilos', '10^9/L')).toBe('neutrophils')
    expect(id('Lymphocytes', 'x10^3/uL')).toBe('lymphocytes')
  })

  it('asks when the unit does not decide', () => {
    expect(matchMarker('Neutrophils', undefined)).toEqual({ status: 'ambiguous', candidates: ['neutrophils', 'neutrophils-pct'] })
  })

  it('keeps unknown markers unknown rather than guessing', () => {
    expect(matchMarker('Cistatina C', 'mg/L')).toEqual({ status: 'unknown' })
    expect(matchMarker('Glicose na urina', undefined).status).not.toBe('matched')
  })

  it("prefers the user's own mappings", () => {
    const aliases = [{ nameAsPrinted: 'Glic. jejum', markerId: 'glucose' }]
    expect(matchMarker('Glic. jejum', 'mg/dL', aliases)).toEqual({ status: 'matched', markerId: 'glucose', via: 'user' })
  })
})
