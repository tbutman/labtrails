// Demo mode: a fictional person with three years of results from two fictional labs, one in the US
// (mg/dL) and one in the UK (mmol/L and other SI units), so the demo shows a history across countries
// and units, ranges that differ between labs, and a range printed in bands. Every name, value and lab
// here is made up.

import { matchMarker } from '../labs/match/match'
import type { Answer } from '../core/ask/model'
import type { Suggestion } from '../labs/ai/ask'
import type { Extraction } from '../labs/extraction/schema'
import type { TimelineEntry } from '../labs/timeline'
import type { Profile, Report, Result, Summary, TestContext } from '../labs/types'
import { parseRange, parseValue } from '../labs/units/parse'
import { normaliseUnit } from '../labs/units/normalise'
import { personAt } from '../labs/person'

export const DEMO_PROFILE: Profile = { id: 'demo-sam', name: 'Sam (demo)', sex: 'male', dateOfBirth: '1988-05-01', createdAt: '2023-09-14T08:00:00Z' }

const US_LAB = 'Example Clinical Lab, Boston (fictional)'
const UK_LAB = 'Northfield Laboratory, London (fictional)'

type ReportSpec = { id: string; date: string; time: string; lab: typeof US_LAB | typeof UK_LAB; context: TestContext }

const REPORTS: ReportSpec[] = [
  { id: 'r1', date: '2023-09-14', time: '08:10', lab: US_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r2', date: '2024-03-21', time: '08:25', lab: US_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r3', date: '2024-10-08', time: '08:40', lab: UK_LAB, context: { fasting: 'yes', medications: 'None' } },
  { id: 'r4', date: '2025-04-15', time: '08:05', lab: UK_LAB, context: { fasting: 'yes', medications: 'None', recently: ['hard-exercise'], notes: 'Long trail run two days before.' } },
  { id: 'r5', date: '2025-11-04', time: '10:30', lab: UK_LAB, context: { fasting: 'no', medications: 'Ibuprofen as needed last week', recently: ['illness'], notes: 'Had a cold the week before.' } },
  { id: 'r6', date: '2026-06-09', time: '08:15', lab: UK_LAB, context: { fasting: 'yes', medications: 'None' } },
]

// Per marker: how each lab prints it (name, unit, range), then the value at r1…r6 as printed. The UK
// values are the same quantities as the US ones would be, in SI units. Null means not tested.
type Printed = [name: string, unit: string, range: string]
type Row = { us?: Printed; uk?: Printed; values: (string | null)[] }

const ROWS: Row[] = [
  { us: ['Glucose', 'mg/dL', '65 - 99'], uk: ['Glucose (fasting)', 'mmol/L', '3.6 - 6.0'], values: ['88', '92', '5.3', '5.4', '5.8', '6.2'] },
  { us: ['Hemoglobin A1c', '%', '4.8 - 5.6'], uk: ['HbA1c (IFCC)', 'mmol/mol', '20 - 41'], values: ['5.2', '5.3', '34', '36', '37', '38'] },
  { us: ['Cholesterol, Total', 'mg/dL', '100 - 199'], uk: ['Total cholesterol', 'mmol/L', '< 5.0'], values: ['185', '192', '5.1', '5.3', '5.5', '5.7'] },
  { us: ['LDL Cholesterol Calc', 'mg/dL', '0 - 99'], uk: ['LDL cholesterol', 'mmol/L', '< 3.0'], values: ['108', '112', '3.1', '3.2', '3.4', '3.6'] },
  { us: ['HDL Cholesterol', 'mg/dL', '> 39'], uk: ['HDL cholesterol', 'mmol/L', '> 1.0'], values: ['52', '50', '1.42', '1.37', '1.32', '1.40'] },
  { us: ['Triglycerides', 'mg/dL', '0 - 149'], uk: ['Triglycerides', 'mmol/L', '< 1.7'], values: ['110', '135', '1.11', '1.17', '1.83', '1.14'] },
  { us: ['ALT (SGPT)', 'IU/L', '0 - 44'], uk: ['ALT', 'U/L', '< 41'], values: ['24', '27', '22', '58', '25', '26'] },
  { us: ['AST (SGOT)', 'IU/L', '0 - 40'], uk: ['AST', 'U/L', '< 40'], values: ['21', '23', '20', '49', '22', '23'] },
  { us: ['Creatinine', 'mg/dL', '0.76 - 1.27'], uk: ['Creatinine', 'µmol/L', '64 - 104'], values: ['0.98', '1.01', '84', '92', '88', '90'] },
  { us: ['BUN', 'mg/dL', '6 - 24'], values: ['15', '17', null, null, null, null] },
  { uk: ['Urea', 'mmol/L', '2.5 - 7.8'], values: [null, null, '5.7', '6.3', '5.2', '6.0'] },
  { us: ['eGFR', 'mL/min/1.73m2', '> 59'], uk: ['eGFR', 'mL/min/1.73m2', '> 60'], values: ['98', '95', '101', '93', '97', '95'] },
  { us: ['TSH', 'uIU/mL', '0.450 - 4.500'], uk: ['TSH', 'mU/L', '0.27 - 4.20'], values: ['2.10', '1.80', '2.40', '2.00', '2.60', '2.20'] },
  { us: ['Free T4', 'ng/dL', '0.82 - 1.77'], uk: ['Free T4', 'pmol/L', '12.0 - 22.0'], values: ['1.24', '1.20', '15.6', '15.2', '16.1', '15.3'] },
  { us: ['Ferritin', 'ng/mL', '30 - 400'], uk: ['Ferritin', 'µg/L', '30 - 400'], values: ['142', '118', '96', '74', '51', '38'] },
  { us: ['Vitamin D, 25-Hydroxy', 'ng/mL', '30.0 - 100.0'], uk: ['Vitamin D (25-OH)', 'nmol/L', 'Deficient: < 25; Insufficient: 25 - 74; Sufficient: 75 - 200'], values: ['24.1', '33.0', '52', '67', '85', '95'] },
  { us: ['Vitamin B12', 'pg/mL', '232 - 1245'], uk: ['Vitamin B12', 'ng/L', '180 - 900'], values: ['455', '470', '412', '438', '395', '421'] },
  { us: ['Hemoglobin', 'g/dL', '13.0 - 17.7'], uk: ['Haemoglobin', 'g/L', '130 - 175'], values: ['15.1', '14.9', '152', '148', '146', '147'] },
  { us: ['WBC', 'x10E3/uL', '3.4 - 10.8'], uk: ['White cell count', 'x10^9/L', '4.0 - 11.0'], values: ['6.2', '5.8', '6.6', '7.9', '6.1', '6.4'] },
  { us: ['Platelets', 'x10E3/uL', '150 - 450'], uk: ['Platelets', 'x10^9/L', '150 - 400'], values: ['245', '262', '238', '251', '229', '240'] },
  { us: ['C-Reactive Protein', 'mg/L', '0.0 - 4.9'], uk: ['CRP', 'mg/L', '< 5'], values: ['1.2', '0.8', '<0.5', '1.1', '6.8', '0.9'] },
  // A marker outside the catalogue, kept as printed so it can be mapped later.
  { uk: ['Cystatin C', 'mg/L', '0.61 - 0.95'], values: [null, null, '0.78', '0.81', '0.79', '0.82'] },
]

function buildResults(): Result[] {
  const results: Result[] = []
  REPORTS.forEach((report, i) => {
    const uk = report.lab === UK_LAB
    for (const row of ROWS) {
      const printed = uk ? row.uk : row.us
      const raw = row.values[i]
      if (!printed || raw === null) continue
      const [name, unit, rangeText] = printed
      const value = parseValue(raw, '.')
      const range = parseRange(rangeText, '.', personAt(DEMO_PROFILE, report.date))
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
  country: r.lab === UK_LAB ? 'GB' : 'US',
  source: 'manual',
  context: r.context,
  createdAt: `${r.date}T12:00:00Z`,
  updatedAt: `${r.date}T12:00:00Z`,
}))

export const DEMO_RESULTS: Result[] = buildResults()

// Sam's timeline (SPEC.md section 18.9): what started between tests. Vitamin D rises after the
// supplement; ferritin keeps falling through marathon training (on the chart, not a matched influence).
export const DEMO_TIMELINE: TimelineEntry[] = [
  { id: 'demo-t1', profileId: DEMO_PROFILE.id, kind: 'supplement', name: 'Vitamin D3', dose: '2,000 IU', every: { n: 1, unit: 'day' }, start: '2024-11', createdAt: '2024-11-02T09:00:00Z', updatedAt: '2024-11-02T09:00:00Z' },
  { id: 'demo-t2', profileId: DEMO_PROFILE.id, kind: 'lifestyle', name: 'Marathon training', start: '2025-01-06', notes: 'Four runs a week.', createdAt: '2025-01-06T09:00:00Z', updatedAt: '2025-01-06T09:00:00Z' },
]

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
      '- **Glucose** is now 6.2 mmol/L, just above this lab\'s range of 3.6–6.0. It has risen at each of the last six tests, from 4.9 in 2023 (88 mg/dL, as the Boston lab printed it). This one was a fasting test; the November one wasn\'t.',
      '- **Ferritin** fell from 51 to 38 µg/L. It\'s still inside the lab\'s range of 30–400, but it has fallen at every test since 2023, from 142.',
      '- **LDL cholesterol** (3.6 mmol/L) and **total cholesterol** (5.7 mmol/L) are above this lab\'s ranges, and both have risen at each test. LDL has been above the range at every test since 2023, total cholesterol since October 2024.',
      '- **CRP** is back inside the range (0.9 mg/L) after 6.8 in November, when you noted a cold the week before.',
      '- **Triglycerides** are back inside the range (1.14 mmol/L). The November test wasn\'t fasting, and eating before a test can raise triglycerides.',
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
      '**Glucose:** glucose has risen steadily over six tests and is now just above the lab\'s range. HbA1c has also edged up, from 33 to 38 mmol/mol (5.2% as the Boston lab printed it), and is inside the range.',
      '',
      '**Lipids:** LDL and total cholesterol have risen at every test. LDL has been above the lab\'s range at every test, and total cholesterol since October 2024. HDL has stayed steady.',
      '',
      '**Liver:** ALT and AST were above the range once, in April 2025, two days after a long run you noted, and have been inside it since.',
      '',
      '**Iron:** ferritin has fallen at every test, from 142 to 38 µg/L, and is now near the bottom of the range.',
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
// matching and review code as a real answer. One name ("Glyc. haemoglobin (IFCC)") isn't in the
// catalogue's aliases, so the AI's suggestion is used and marked for checking; the urinalysis row
// shows that urine results are kept apart from blood tests.
export const DEMO_EXTRACTION: Extraction = {
  sampleDate: { printed: '15/09/2026 08:20', guessedFormat: 'DMY' },
  lab: 'Northfield Laboratory, London (fictional)',
  fastingPrinted: 'Yes',
  rows: (
    [
      ['Glucose (fasting)', '6.0', 'mmol/L', '3.6 - 6.0', null, 'glucose', 'high'],
      ['Glyc. haemoglobin (IFCC)', '39', 'mmol/mol', '20 - 41', null, 'hba1c', 'high'],
      ['Total cholesterol', '5.5', 'mmol/L', '< 5.0', 'H', 'cholesterol-total', 'high'],
      ['HDL cholesterol', '1.42', 'mmol/L', '> 1.0', null, 'hdl', 'high'],
      ['LDL cholesterol', '3.4', 'mmol/L', '< 3.0', 'H', 'ldl', 'high'],
      ['Triglycerides', '1.26', 'mmol/L', '< 1.7', null, 'triglycerides', 'high'],
      ['ALT', '24', 'U/L', '< 41', null, 'alt', 'high'],
      ['Creatinine', '87', 'µmol/L', '64 - 104', null, 'creatinine', 'high'],
      ['Ferritin', '41', 'µg/L', '30 - 400', null, 'ferritin', 'medium'],
      ['Vitamin D (25-OH)', '90', 'nmol/L', 'Deficient < 25 · Insufficient 25 - 74 · Sufficient 75 - 200', null, 'vitamin-d', 'high'],
      ['CRP', '<0.5', 'mg/L', '< 5', null, 'crp', 'high'],
      ['Cystatin C', '0.80', 'mg/L', '0.61 - 0.95', null, 'unknown', 'high'],
      ['Glucose', 'Negative', null, null, null, 'unknown', 'high', 'urine'],
    ] as [string, string, string | null, string | null, string | null, string, Extraction['rows'][number]['confidence'], ('urine' | undefined)?][]
  ).map(([nameAsPrinted, valuePrinted, unitPrinted, rangePrinted, flagPrinted, suggestedMarkerId, confidence, specimen]) => ({
    nameAsPrinted,
    valuePrinted,
    unitPrinted,
    rangePrinted,
    flagPrinted,
    suggestedMarkerId,
    confidence,
    page: 1,
    samplePrinted: null,
    specimen: specimen ?? 'blood',
  })),
}

// "Ask about the numbers" in the demo: answers to the suggested questions, prepared in advance in the
// style of the AI's answers, with every number declared against the facts LabTrails sends for that
// question. A test runs each one through the core's numbers check.
export const DEMO_ANSWERS: Record<Suggestion['id'], Answer> = {
  trend: {
    kind: 'answer',
    text: "Your glucose has gone up at each of your six tests, from **4.9 mmol/L** in September 2023 to **6.2 mmol/L** in June 2026. That's why LabTrails marks it as rising. The two Boston results were printed in mg/dL (88 mg/dL in 2023); LabTrails converts them so every result is on one chart.\n\nThe latest result is just above the London lab's range, which goes up to 6.0 mmol/L, so it's also flagged as outside the range. Each result is compared with its own lab's range, and the Boston lab's was different.\n\nA steady rise over several tests is worth asking your doctor about, including what it means for you.",
    numbers: [
      { text: '4.9 mmol/L', fact: 'markers[0].results[0].value' },
      { text: '6.2 mmol/L', fact: 'markers[0].results[5].value' },
      { text: '88 mg/dL', fact: 'markers[0].results[0].printed.value' },
      { text: '6.0 mmol/L', fact: 'markers[0].results[5].range.high' },
    ],
  },
  outside: {
    kind: 'answer',
    text: "Your latest total cholesterol was **5.7 mmol/L**, in June 2026. The London lab prints a range below 5.0 mmol/L, so LabTrails flags the result as above the range.\n\nIt has gone up at every test since 4.8 mmol/L in September 2023 (185 mg/dL, as the Boston lab printed it), which is why it's marked as rising. Your LDL cholesterol shows the same pattern, from 2.8 mmol/L to 3.6 mmol/L, while your HDL cholesterol has stayed between 1.3 mmol/L and 1.4 mmol/L.\n\nA result above the lab's range is a reason to look more closely, not a diagnosis; your doctor can explain what it means for you.",
    numbers: [
      { text: '5.7 mmol/L', fact: 'markers[0].results[5].value' },
      { text: '5.0 mmol/L', fact: 'markers[0].results[5].range.high' },
      { text: '4.8 mmol/L', fact: 'markers[0].results[0].value' },
      { text: '185 mg/dL', fact: 'markers[0].results[0].printed.value' },
      { text: '2.8 mmol/L', fact: 'markers[2].results[0].value' },
      { text: '3.6 mmol/L', fact: 'markers[2].results[5].value' },
      { text: '1.3 mmol/L', fact: 'markers[1].results[1].value' },
      { text: '1.4 mmol/L', fact: 'markers[1].results[5].value' },
    ],
  },
  changed: {
    kind: 'answer',
    text: "Since your previous test in November 2025, the biggest changes LabTrails flagged were:\n\n- **CRP** fell from 6.8 mg/L to 0.9 mg/L, back inside the lab's range (below 5 mg/L).\n- **Triglycerides** fell from 1.83 mmol/L to 1.14 mmol/L, also back inside the range (below 1.7 mmol/L).\n- **Glucose** rose from 5.8 mmol/L to 6.2 mmol/L, just above the range (up to 6.0 mmol/L).\n\nOver a longer time, your ferritin has fallen at every test, from 142 µg/L to 38 µg/L, still inside its lab's range. These could be good to go through with your doctor.",
    numbers: [
      { text: '6.8 mg/L', fact: 'markers[7].results[4].value' },
      { text: '0.9 mg/L', fact: 'markers[7].results[5].value' },
      { text: '5 mg/L', fact: 'markers[7].results[5].range.high' },
      { text: '1.83 mmol/L', fact: 'markers[4].results[4].value' },
      { text: '1.14 mmol/L', fact: 'markers[4].results[5].value' },
      { text: '1.7 mmol/L', fact: 'markers[4].results[5].range.high' },
      { text: '5.8 mmol/L', fact: 'markers[0].results[4].value' },
      { text: '6.2 mmol/L', fact: 'markers[0].results[5].value' },
      { text: '6.0 mmol/L', fact: 'markers[0].results[5].range.high' },
      { text: '142 µg/L', fact: 'markers[5].results[0].value' },
      { text: '38 µg/L', fact: 'markers[5].results[5].value' },
    ],
  },
}
