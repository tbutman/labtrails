// Demo mode: a fictional person with three years of results from two fictional labs, one in the US
// and one in Portugal, so the demo shows unit conversion, Portuguese names and ranges that differ
// between labs. Every name, value and lab here is made up.

import { matchMarker } from '../labs/match/match'
import type { Extraction } from '../labs/extraction/schema'
import type { Profile, Report, Result, Summary, TestContext } from '../labs/types'
import { parseRange, parseValue } from '../labs/units/parse'
import { normaliseUnit } from '../labs/units/normalise'

export const DEMO_PROFILE: Profile = { id: 'demo-sam', name: 'Sam (demo)', sex: 'male', dateOfBirth: '1988-05-01', createdAt: '2023-09-14T08:00:00Z' }

const US_LAB = 'Example Clinical Lab, Boston (fictional)'
const PT_LAB = 'Laboratório Exemplo, Lisboa (fictional)'

type ReportSpec = { id: string; date: string; time: string; lab: typeof US_LAB | typeof PT_LAB; context: TestContext }

const REPORTS: ReportSpec[] = [
  { id: 'r1', date: '2023-09-14', time: '08:10', lab: US_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r2', date: '2024-03-21', time: '08:25', lab: US_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r3', date: '2024-10-08', time: '08:40', lab: PT_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r4', date: '2025-04-15', time: '08:05', lab: PT_LAB, context: { fasting: 'yes', medications: 'None', recently: ['hard-exercise'], notes: 'Long trail run two days before.' } },
  { id: 'r5', date: '2025-11-04', time: '10:30', lab: PT_LAB, context: { fasting: 'no', medications: 'Ibuprofen as needed last week', recently: ['illness'], notes: 'Had a cold the week before.' } },
  { id: 'r6', date: '2026-06-09', time: '08:15', lab: PT_LAB, context: { fasting: 'yes', medications: 'None' } },
]

// Per marker: how each lab prints it (name, unit, range), then the value at r1…r6 as printed.
// Null means the marker wasn't tested that time.
type Printed = [name: string, unit: string, range: string]
type Row = { us?: Printed; pt?: Printed; values: (string | null)[] }

const ROWS: Row[] = [
  { us: ['Glucose', 'mg/dL', '65 - 99'], pt: ['Glicose', 'mg/dL', '70 - 110'], values: ['88', '92', '95', '97', '104', '112'] },
  { us: ['Hemoglobin A1c', '%', '4.8 - 5.6'], pt: ['Hemoglobina glicada (HbA1c)', '%', '4,0 - 6,0'], values: ['5.2', '5.3', '5,3', '5,4', '5,5', '5,6'] },
  { us: ['Cholesterol, Total', 'mg/dL', '100 - 199'], pt: ['Colesterol total', 'mg/dL', '< 190'], values: ['185', '192', '198', '204', '211', '219'] },
  { us: ['LDL Cholesterol Calc', 'mg/dL', '0 - 99'], pt: ['Colesterol LDL', 'mg/dL', '< 116'], values: ['108', '112', '118', '125', '131', '138'] },
  { us: ['HDL Cholesterol', 'mg/dL', '> 39'], pt: ['Colesterol HDL', 'mg/dL', '> 40'], values: ['52', '50', '55', '53', '51', '54'] },
  { us: ['Triglycerides', 'mg/dL', '0 - 149'], pt: ['Triglicéridos', 'mg/dL', '< 150'], values: ['110', '135', '98', '104', '162', '101'] },
  { us: ['ALT (SGPT)', 'IU/L', '0 - 44'], pt: ['TGP/ALT', 'U/L', '< 41'], values: ['24', '27', '22', '58', '25', '26'] },
  { us: ['AST (SGOT)', 'IU/L', '0 - 40'], pt: ['TGO/AST', 'U/L', '< 40'], values: ['21', '23', '20', '49', '22', '23'] },
  { us: ['Creatinine', 'mg/dL', '0.76 - 1.27'], pt: ['Creatinina', 'mg/dL', '0,70 - 1,20'], values: ['0.98', '1.01', '0,95', '1,04', '0,99', '1,02'] },
  { us: ['BUN', 'mg/dL', '6 - 24'], values: ['15', '17', null, null, null, null] },
  { pt: ['Ureia', 'mg/dL', '17 - 43'], values: [null, null, '34', '38', '31', '36'] },
  { us: ['eGFR', 'mL/min/1.73m2', '> 59'], pt: ['TFG estimada', 'mL/min/1,73m2', '> 60'], values: ['98', '95', '101', '93', '97', '95'] },
  { us: ['TSH', 'uIU/mL', '0.450 - 4.500'], pt: ['TSH', 'mUI/L', '0,27 - 4,20'], values: ['2.10', '1.80', '2,40', '2,00', '2,60', '2,20'] },
  { us: ['Free T4', 'ng/dL', '0.82 - 1.77'], pt: ['T4 livre', 'ng/dL', '0,93 - 1,70'], values: ['1.24', '1.20', '1,21', '1,18', '1,25', '1,19'] },
  { us: ['Ferritin', 'ng/mL', '30 - 400'], pt: ['Ferritina', 'ng/mL', '30 - 400'], values: ['142', '118', '96', '74', '51', '38'] },
  { us: ['Vitamin D, 25-Hydroxy', 'ng/mL', '30.0 - 100.0'], pt: ['25-OH Vitamina D', 'ng/mL', '30 - 100'], values: ['24.1', '33.0', '21', '27', '34', '38'] },
  { us: ['Vitamin B12', 'pg/mL', '232 - 1245'], pt: ['Vitamina B12', 'pg/mL', '197 - 771'], values: ['455', '470', '412', '438', '395', '421'] },
  { us: ['Hemoglobin', 'g/dL', '13.0 - 17.7'], pt: ['Hemoglobina', 'g/dL', '13,0 - 17,5'], values: ['15.1', '14.9', '15,2', '14,8', '14,6', '14,7'] },
  { us: ['WBC', 'x10E3/uL', '3.4 - 10.8'], pt: ['Leucócitos', 'x10^9/L', '4,0 - 10,0'], values: ['6.2', '5.8', '6,6', '7,9', '6,1', '6,4'] },
  { us: ['Platelets', 'x10E3/uL', '150 - 450'], pt: ['Plaquetas', 'x10^9/L', '150 - 400'], values: ['245', '262', '238', '251', '229', '240'] },
  { us: ['C-Reactive Protein', 'mg/L', '0.0 - 4.9'], pt: ['Proteína C reactiva', 'mg/L', '< 5,0'], values: ['1.2', '0.8', '<0,5', '1,1', '6,8', '0,9'] },
  // A marker outside the catalogue, kept as printed so it can be mapped later.
  { pt: ['Cistatina C', 'mg/L', '0,61 - 0,95'], values: [null, null, '0,78', '0,81', '0,79', '0,82'] },
]

function buildResults(): Result[] {
  const results: Result[] = []
  REPORTS.forEach((report, i) => {
    const pt = report.lab === PT_LAB
    const decimal = pt ? ',' : '.'
    for (const row of ROWS) {
      const printed = pt ? row.pt : row.us
      const raw = row.values[i]
      if (!printed || raw === null) continue
      const [name, unit, rangeText] = printed
      const value = parseValue(raw, decimal)
      const range = parseRange(rangeText, decimal)
      const match = matchMarker(name, normaliseUnit(unit))
      results.push({
        id: `${report.id}-${results.length}`,
        reportId: report.id,
        profileId: DEMO_PROFILE.id,
        ...(match.status === 'matched' ? { markerId: match.markerId } : {}),
        nameAsPrinted: name,
        ...(value.kind === 'number' ? { value: value.value, ...(value.comparator ? { comparator: value.comparator } : {}) } : { textValue: value.text }),
        unitAsPrinted: unit,
        range: range ?? { text: rangeText },
        createdAt: `${report.date}T12:00:00Z`,
        updatedAt: `${report.date}T12:00:00Z`,
      })
    }
  })
  return results
}

export const DEMO_REPORTS: Report[] = REPORTS.map((r) => ({
  id: r.id,
  profileId: DEMO_PROFILE.id,
  date: r.date,
  time: r.time,
  lab: r.lab,
  country: r.lab === PT_LAB ? 'PT' : 'US',
  source: 'manual',
  context: r.context,
  createdAt: `${r.date}T12:00:00Z`,
  updatedAt: `${r.date}T12:00:00Z`,
}))

export const DEMO_RESULTS: Result[] = buildResults()

// Pre-written examples of the two AI summaries, written to the same rules the real prompts use: they
// explain what the code flagged and never diagnose or advise treatment.
export const DEMO_SUMMARIES: Summary[] = [
  {
    id: 'demo-after-r6',
    profileId: DEMO_PROFILE.id,
    kind: 'after-report',
    reportId: 'r6',
    model: 'example (pre-written for the demo)',
    createdAt: '2026-06-09T12:00:00Z',
    inputsDigest: 'demo',
    text: [
      'Compared with the previous test in November 2025:',
      '',
      '- **Glucose** is now 112 mg/dL, just above this lab\'s range of 70–110. It has risen at each of the last six tests, from 88 in 2023. This one was a fasting test; the November one wasn\'t.',
      '- **Ferritin** fell from 51 to 38 ng/mL. It\'s still inside the lab\'s range of 30–400, but it has fallen at every test since 2023, from 142.',
      '- **LDL cholesterol** (138 mg/dL) and **total cholesterol** (219 mg/dL) are above this lab\'s ranges, and both have risen at each test. LDL has been above the range at every test since 2023, total cholesterol since October 2024.',
      '- **CRP** is back inside the range (0.9 mg/L) after 6.8 in November, when you noted a cold the week before.',
      '- **Triglycerides** are back inside the range (101 mg/dL); November\'s higher value was from a non-fasting test.',
      '',
      'Glucose, ferritin and the cholesterol results are worth discussing with your doctor, especially the steady direction of each.',
    ].join('\n'),
  },
  {
    id: 'demo-overall',
    profileId: DEMO_PROFILE.id,
    kind: 'overall',
    model: 'example (pre-written for the demo)',
    createdAt: '2026-06-09T12:05:00Z',
    inputsDigest: 'demo',
    text: [
      '**Glucose:** glucose has risen steadily over six tests and is now just above the lab\'s range. HbA1c has also edged up, from 5.2% to 5.6%, and is inside the range.',
      '',
      '**Lipids:** LDL and total cholesterol have risen at every test. LDL has been above the lab\'s range at every test, and total cholesterol since October 2024. HDL has stayed steady.',
      '',
      '**Liver:** ALT and AST were above the range once, in April 2025, two days after a long run you noted, and have been inside it since.',
      '',
      '**Iron:** ferritin has fallen at every test, from 142 to 38 ng/mL, and is now near the bottom of the range.',
      '',
      '**Vitamins:** vitamin D was below the range three times, most recently in April 2025, and has risen at each test since October 2024; it\'s now inside the range. B12 is steady.',
      '',
      '**Kidney, thyroid and blood count:** steady and inside the ranges throughout.',
      '',
      'Questions you could ask your doctor:',
      '',
      '1. My glucose has risen at every test for three years. Is that something to look into?',
      '2. My LDL cholesterol keeps rising. What would you want to check or watch?',
      '3. My ferritin has fallen steadily. Should it be followed up?',
      '4. Does it matter that my vitamin D was low in the past?',
      '5. How often should I repeat these tests?',
    ].join('\n'),
  },
]

// The demo's "AI answer" for reading a report, prepared in advance from the fictional sample report
// image (public/demo/sample-report.png). No AI is called in the demo; this goes through the same
// matching and review code as a real answer. One name ("Glic. hemoglobina A1c") isn't in the
// catalogue's aliases, so the AI's suggestion is used and marked for checking.
export const DEMO_EXTRACTION: Extraction = {
  sampleDate: { printed: '15/09/2026', guessedFormat: 'DMY' },
  lab: 'Laboratório Exemplo, Lisboa (fictional)',
  fastingPrinted: 'sim',
  rows: [
    ['Glicose', '108', 'mg/dL', '70 - 110', null, 'glucose', 'high'],
    ['Glic. hemoglobina A1c', '5,7', '%', '4,0 - 6,0', null, 'hba1c', 'high'],
    ['Colesterol total', '214', 'mg/dL', '< 190', 'H', 'cholesterol-total', 'high'],
    ['Colesterol HDL', '55', 'mg/dL', '> 40', null, 'hdl', 'high'],
    ['Colesterol LDL', '133', 'mg/dL', '< 116', 'H', 'ldl', 'high'],
    ['Triglicéridos', '112', 'mg/dL', '< 150', null, 'triglycerides', 'high'],
    ['TGP/ALT', '24', 'U/L', '< 41', null, 'alt', 'high'],
    ['Creatinina', '0,98', 'mg/dL', '0,70 - 1,20', null, 'creatinine', 'high'],
    ['Ferritina', '41', 'ng/mL', '30 - 400', null, 'ferritin', 'medium'],
    ['25-OH Vitamina D', '36', 'ng/mL', '30 - 100', null, 'vitamin-d', 'high'],
    ['Proteína C reactiva', '<0,5', 'mg/L', '< 5,0', null, 'crp', 'high'],
    ['Cistatina C', '0,80', 'mg/L', '0,61 - 0,95', null, 'unknown', 'high'],
  ].map(([nameAsPrinted, valuePrinted, unitPrinted, rangePrinted, flagPrinted, suggestedMarkerId, confidence]) => ({
    nameAsPrinted: nameAsPrinted!,
    valuePrinted: valuePrinted!,
    unitPrinted,
    rangePrinted,
    flagPrinted,
    suggestedMarkerId: suggestedMarkerId!,
    confidence: confidence as Extraction['rows'][number]['confidence'],
    page: 1,
    samplePrinted: null,
  })),
}
