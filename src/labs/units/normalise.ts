// Labs spell the same unit many ways ("mg/dl", "mg/dL", "umol/L", "μmol/l", "x10^3/uL", "/mm3").
// normaliseUnit turns a printed unit into one canonical spelling, so the catalogue only has to list
// each unit once. Different units that happen to be numerically equal (mIU/L and µIU/mL) are not
// merged here; the catalogue lists them as conversions with a factor of 1.

const CANONICAL: Record<string, string> = {
  'g/dl': 'g/dL',
  'g/l': 'g/L',
  'mg/dl': 'mg/dL',
  'mg/l': 'mg/L',
  'µg/dl': 'µg/dL',
  'µg/l': 'µg/L',
  'µg/ml': 'µg/mL',
  'ng/dl': 'ng/dL',
  'ng/ml': 'ng/mL',
  'pg/ml': 'pg/mL',
  'mmol/l': 'mmol/L',
  'mmol/mol': 'mmol/mol',
  'µmol/l': 'µmol/L',
  'nmol/l': 'nmol/L',
  'pmol/l': 'pmol/L',
  'meq/l': 'mEq/L',
  'u/l': 'U/L',
  'iu/l': 'U/L',
  'ui/l': 'U/L',
  'miu/l': 'mIU/L',
  'mu/l': 'mIU/L', // milli-units, as UK labs print TSH
  'µu/ml': 'µIU/mL',
  'mui/l': 'mIU/L',
  'µiu/ml': 'µIU/mL',
  'µui/ml': 'µIU/mL',
  'miu/ml': 'mIU/mL',
  'mui/ml': 'mIU/mL',
  'iu/ml': 'IU/mL',
  'ui/ml': 'IU/mL',
  'fl': 'fL',
  'pg': 'pg',
  '%': '%',
  'l/l': 'L/L',
  'u/ml': 'U/mL',
  'mm/h': 'mm/h',
  'mm/1h': 'mm/h',
  'mm/1ªh': 'mm/h',
  'mm/1ahora': 'mm/h',
  'ml/min/1.73m2': 'mL/min/1.73m²',
  'ml/min/1,73m2': 'mL/min/1.73m²',
  'ml/min': 'mL/min/1.73m²',
  '10³/µl': '10³/µL',
  '10⁶/µl': '10⁶/µL',
  '10⁹/l': '10⁹/L',
  '10¹²/l': '10¹²/L',
  '/µl': '/µL',
}

/** Returns the canonical spelling of a printed unit, or the trimmed input if it's not recognised. */
export function normaliseUnit(printed: string): string {
  let u = printed
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[μu](?=(g|mol|l|iu|ui)\b|g\/|mol\/|iu\/|ui\/|l$)/g, 'µ') // micro written as u or Greek mu
    .replace(/mcg/g, 'µg')
    .replace(/²/g, '2')
    .replace(/\/mm3$|\/mm³$/, '/µl') // per cubic millimetre is per microlitre

  // Powers of ten: "x10^3/uL", "x10E3/µL", "10*3/ul", "x 10³/µL", "10^9/L", "G/L" (giga per litre)
  // A count printed with its denominator cut off ("x 10³/") is per µL for 10³ and 10⁶ (as blood
  // counts are printed per µL) and per L for 10⁹ and 10¹².
  const power = u.match(/^(?:x|×)?10(?:\^|e|\*)?([0-9]+|[³⁶⁹]|¹²)(?:\/)(µl|l)?$/)
  if (power) {
    const exp = ({ '³': '3', '⁶': '6', '⁹': '9', '¹²': '12' } as Record<string, string>)[power[1]] ?? power[1]
    const sup = ({ '3': '³', '6': '⁶', '9': '⁹', '12': '¹²' } as Record<string, string>)[exp]
    const per = power[2] ?? (exp === '3' || exp === '6' ? 'µl' : 'l')
    if (sup) u = `10${sup}/${per}`
  }
  if (u === 'g/l' && printed.trim() === 'G/L') u = '10⁹/l' // "G/L" in capitals means 10⁹ per litre
  if (u === 't/l' && printed.trim() === 'T/L') u = '10¹²/l'

  return CANONICAL[u] ?? printed.trim()
}
