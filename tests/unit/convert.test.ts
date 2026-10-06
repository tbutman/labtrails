import { describe, expect, it } from 'vitest'
import { MARKERS, getMarker } from '../../src/labs/catalogue/catalogue'
import { convert, convertibleUnits } from '../../src/labs/units/convert'

// Expected factors derived here independently from PubChem molar masses (g/mol), so a typo in the
// catalogue fails. Tolerance 0.1%: the catalogue rounds to four significant figures.
const fromMolarMass: [string, string, string, number][] = [
  ['glucose', 'mg/dL', 'mmol/L', 10 / 180.16],
  ['cholesterol-total', 'mg/dL', 'mmol/L', 10 / 386.66],
  ['hdl', 'mg/dL', 'mmol/L', 10 / 386.66],
  ['ldl', 'mg/dL', 'mmol/L', 10 / 386.66],
  ['non-hdl', 'mg/dL', 'mmol/L', 10 / 386.66],
  ['triglycerides', 'mg/dL', 'mmol/L', 10 / 885.45],
  ['creatinine', 'mg/dL', 'µmol/L', 10000 / 113.12],
  ['urea', 'mg/dL', 'mmol/L', 10 / 60.056],
  ['bun', 'mg/dL', 'mmol/L', 10 / 28.014],
  ['uric-acid', 'mg/dL', 'µmol/L', 10000 / 168.11],
  ['bilirubin-total', 'mg/dL', 'µmol/L', 10000 / 584.67],
  ['bilirubin-direct', 'mg/dL', 'µmol/L', 10000 / 584.67],
  ['calcium', 'mg/dL', 'mmol/L', 10 / 40.078],
  ['magnesium', 'mg/dL', 'mmol/L', 10 / 24.305],
  ['phosphate', 'mg/dL', 'mmol/L', 10 / 30.974],
  ['iron', 'µg/dL', 'µmol/L', 10 / 55.845],
  ['tibc', 'µg/dL', 'µmol/L', 10 / 55.845],
  ['vitamin-d', 'ng/mL', 'nmol/L', 1000 / 400.65],
  ['vitamin-b12', 'pg/mL', 'pmol/L', 1000 / 1355.39],
  ['folate', 'ng/mL', 'nmol/L', 1000 / 441.4],
  ['free-t4', 'ng/dL', 'pmol/L', 10000 / 776.87],
  ['free-t3', 'pg/mL', 'pmol/L', 1000 / 650.98],
  ['testosterone', 'ng/dL', 'nmol/L', 10 / 288.43],
  ['testosterone', 'ng/mL', 'nmol/L', 100 / 288.43],
  ['oestradiol', 'pg/mL', 'pmol/L', 1000 / 272.39],
  ['cortisol', 'µg/dL', 'nmol/L', 10000 / 362.47],
  ['dhea-s', 'µg/dL', 'µmol/L', 10 / 368.49],
]

describe('conversion factors from molar masses', () => {
  it.each(fromMolarMass)('%s: 1 %s → %s', (id, from, to, factor) => {
    expect(convert(id, 1, from, to)! / factor).toBeCloseTo(1, 3)
    // and back again
    expect(convert(id, convert(id, 100, from, to)!, to, from)).toBeCloseTo(100, 9)
  })
})

describe('conversions by definition', () => {
  it.each([
    ['haemoglobin', 14.2, 'g/dL', 'g/L', 142],
    ['albumin', 4.5, 'g/dL', 'g/L', 45],
    ['total-protein', 7, 'g/dL', 'g/L', 70],
    ['crp', 0.5, 'mg/dL', 'mg/L', 5],
    ['apob', 90, 'mg/dL', 'g/L', 0.9],
    ['transferrin', 250, 'mg/dL', 'g/L', 2.5],
    ['haematocrit', 0.42, 'L/L', '%', 42],
    ['wbc', 6.5, '10³/µL', '10⁹/L', 6.5],
    ['platelets', 250000, '/µL', '10⁹/L', 250],
    ['rbc', 4.8, '10⁶/µL', '10¹²/L', 4.8],
    ['tsh', 2.1, 'µIU/mL', 'mIU/L', 2.1],
    ['ferritin', 80, 'ng/mL', 'µg/L', 80],
    ['sodium', 140, 'mEq/L', 'mmol/L', 140],
    ['psa', 1.2, 'ng/mL', 'µg/L', 1.2],
  ])('%s: %s %s = %s %s', (id, value, from, to, expected) => {
    expect(convert(id, value, from, to)).toBeCloseTo(expected, 9)
  })
})

describe('special cases', () => {
  it('converts insulin with 6.00 pmol/L per µIU/mL', () => {
    expect(convert('insulin', 10, 'µIU/mL', 'pmol/L')).toBeCloseTo(60, 9)
    expect(convert('insulin', 10, 'mIU/L', 'pmol/L')).toBeCloseTo(60, 9)
  })

  it('converts HbA1c with the IFCC-NGSP master equation', () => {
    expect(convert('hba1c', 7, '%', 'mmol/mol')).toBeCloseTo(53.0, 1)
    expect(convert('hba1c', 6.5, '%', 'mmol/mol')).toBeCloseTo(47.5, 1)
    expect(convert('hba1c', 48, 'mmol/mol', '%')).toBeCloseTo(6.54, 2)
  })

  it('relates BUN to urea through the urea molecule', () => {
    // 1 mg/dL of urea nitrogen is 60.056 / 28.014 ≈ 2.14 mg/dL of urea
    const asUrea = convert('urea', convert('bun', 1, 'mg/dL', 'mmol/L')!, 'mmol/L', 'mg/dL')!
    expect(asUrea).toBeCloseTo(2.14, 2)
  })

  it('accepts printed spellings of units', () => {
    expect(convert('glucose', 90, 'mg/dl', 'mmol/l')).toBeCloseTo(4.995, 3)
    expect(convert('creatinine', 1, 'MG/DL', 'umol/L')).toBeCloseTo(88.4, 6)
  })

  it('refuses units the marker does not use, and Lp(a) across units', () => {
    expect(convert('glucose', 90, 'g/L', 'mmol/L')).toBeNull()
    expect(convert('lpa', 30, 'mg/dL', 'nmol/L')).toBeNull()
    expect(convert('lpa', 30, 'mg/dL', 'mg/dL')).toBe(30)
    expect(convertibleUnits(getMarker('lpa')!, 'nmol/L')).toEqual(['nmol/L'])
    expect(convert('no-such-marker', 1, 'mg/dL', 'mg/dL')).toBeNull()
  })
})

describe('every conversion cites a source', () => {
  it('has a source with a link for every unit other than the canonical one', () => {
    for (const marker of MARKERS) {
      for (const unit of marker.units.slice(1)) {
        if (marker.noConversion) continue
        expect(unit.source?.url, `${marker.id} ${unit.unit}`).toMatch(/^https:\/\//)
      }
      if (marker.noConversion) expect(marker.noConversion.source?.url).toMatch(/^https:\/\//)
    }
  })
})
