// Fictional lab reports for testing extraction, rendered to PDF and photos by
// scripts/render-test-reports.mjs. They reproduce the hard cases found on real Portuguese and US
// reports (October 2026) in English, with a made-up person, lab and values:
//
// - a previous-results column whose date differs on one page, and a sample time;
// - absolute white-cell counts with their unit cut off ("x 10³/");
// - ranges printed in bands: by age (free testosterone, PSA) and by category (vitamin D);
// - a urinalysis page whose rows share names with blood tests, with text and numeric results;
// - a US report photographed as two pages, month-first dates, a table continuing across the pages.
//
// Each row: [name as printed, value, unit, range, specimen, catalogue marker or '' if none,
// previous value or null]. The expected extraction is derived from the same data.

export const PERSON = { name: 'Alex Example', dateOfBirth: '1982-04-12', sex: 'male' }

export const REPORTS = [
  {
    id: 'riverside-cumulative',
    file: 'riverside-cumulative.pdf',
    kind: 'pdf',
    lab: 'Riverside Diagnostics (fictional)',
    sample: { printed: '14/04/2026 08:52', iso: '2026-04-14', time: '08:52' },
    order: 'dmy',
    pages: [
      {
        title: 'Haematology',
        previous: { printed: '12/01/2026', iso: '2026-01-12' },
        rows: [
          ['Haemoglobin', '17.6', 'g/dL', '13.0 - 17.0', 'blood', 'haemoglobin', '17.1'],
          ['Red cell count', '6.12', 'x 10⁶/µL', '4.50 - 5.50', 'blood', 'rbc', '5.98'],
          ['Haematocrit', '52.1', '%', '40.0 - 50.0', 'blood', 'haematocrit', '51.3'],
          ['M.C.V.', '85.1', 'fL', '80.0 - 97.0', 'blood', 'mcv', '85.8'],
          ['M.C.H.', '28.8', 'pg', '27.0 - 32.0', 'blood', 'mch', '28.6'],
          ['R.D.W.', '13.1', '%', '11.6 - 14.0', 'blood', 'rdw', '12.9'],
          ['White cell count', '7.4', 'x 10³/µL', '4.0 - 10.0', 'blood', 'wbc', '8.1'],
          ['Neutrophils', '58.2', '%', '40.0 - 80.0', 'blood', 'neutrophils-pct', '55.0'],
          ['Neutrophils', '4.31', 'x 10³/', '', 'blood', 'neutrophils', null],
          ['Lymphocytes', '31.6', '%', '20.0 - 40.0', 'blood', 'lymphocytes-pct', '33.9'],
          ['Lymphocytes', '2.34', 'x 10³/', '', 'blood', 'lymphocytes', null],
          ['Platelets', '468', 'x 10³/µL', '150 - 400', 'blood', 'platelets', '489'],
        ],
      },
      {
        title: 'Clinical chemistry',
        previous: { printed: '12/01/2026', iso: '2026-01-12' },
        rows: [
          ['Glucose', '91', 'mg/dL', '70 - 110', 'blood', 'glucose', '96'],
          ['Total cholesterol', '182', 'mg/dL', '< 190', 'blood', 'cholesterol-total', '241'],
          ['Triglycerides', '128', 'mg/dL', '< 150', 'blood', 'triglycerides', '204'],
          ['Urea', '36', 'mg/dL', '< 50', 'blood', 'urea', null],
          ['Creatinine', '1.19', 'mg/dL', '0.70 - 1.30', 'blood', 'creatinine', '1.36'],
          ['eGFR [CKD-EPI 2021]', '76', 'mL/min/1.73 m2', '>= 60', 'blood', 'egfr', '64'],
        ],
      },
      {
        title: 'Liver and hormones',
        // A different date on this page: these were last measured at another visit.
        previous: { printed: '05/02/2026', iso: '2026-02-05' },
        rows: [
          ['AST', '28', 'U/L', '< 34', 'blood', 'ast', '26'],
          ['ALT', '61', 'U/L', '10 - 49', 'blood', 'alt', '35'],
          ['GGT', '52', 'U/L', '< 73', 'blood', 'ggt', '58'],
          ['Alkaline phosphatase', '119', 'U/L', '46 - 116', 'blood', 'alp', '104'],
          ['Total testosterone', '418.0', 'ng/dL', '241.0 - 827.0', 'blood', 'testosterone', '596.4'],
          ['Free testosterone', '6.10', 'pg/mL', '15 - 39 years: 5.4 - 40.0 · 40 - 59 years: 3.6 - 25.7 · 60 years and over: 1.5 - 28.8', 'blood', 'free-testosterone', '11.20'],
          ['PSA, total', '0.72', 'ng/mL', '40 - 49 years: 0 - 2.5 · 50 - 59 years: 0 - 3.5 · 60 - 69 years: 0 - 4.5', 'blood', 'psa', null],
        ],
      },
      {
        title: 'Vitamins and electrolytes',
        previous: null,
        rows: [
          ['25-Hydroxyvitamin D', '22.0', 'ng/mL', 'Deficiency: < 10 · Insufficiency: 10 - 30 · Sufficiency: 30 - 100 · Toxicity: > 100', 'blood', 'vitamin-d', null],
          ['Sodium', '140', 'mmol/L', '132 - 146', 'blood', 'sodium', null],
          ['Potassium', '4.6', 'mmol/L', '3.5 - 5.5', 'blood', 'potassium', null],
          ['TSH', '2.84', 'mIU/L', '0.35 - 5.50', 'blood', 'tsh', null],
        ],
      },
      {
        title: 'Urinalysis',
        previous: null,
        rows: [
          ['Specific gravity', '1.027', '', '1.010 - 1.025', 'urine', '', null],
          ['Glucose', 'Negative', '', '', 'urine', '', null],
          ['Protein', '10', 'mg/dL', '<= 20', 'urine', '', null],
          ['Haemoglobin', 'Negative', '', '', 'urine', '', null],
          ['Leucocytes', 'Negative', '', '', 'urine', '', null],
          ['White cells (sediment)', '< 1', '/HPF', '< 5', 'urine', '', null],
          ['Red cells (sediment)', '< 1', '/HPF', '< 5', 'urine', '', null],
        ],
      },
    ],
  },
  {
    id: 'lakeside-photos',
    files: ['lakeside-photo-1.jpg', 'lakeside-photo-2.jpg'],
    kind: 'photos',
    lab: 'Lakeside Medical Laboratory (fictional)',
    // Month first, as US labs print it: 03/05/2026 is 5 March.
    sample: { printed: '03/05/2026', iso: '2026-03-05' },
    order: 'mdy',
    pages: [
      {
        title: 'Comprehensive metabolic panel',
        previous: null,
        rows: [
          ['Glucose', '94', 'mg/dL', '65 - 99', 'blood', 'glucose', null],
          ['BUN', '17', 'mg/dL', '6 - 24', 'blood', 'bun', null],
          ['Creatinine', '1.08', 'mg/dL', '0.76 - 1.27', 'blood', 'creatinine', null],
          ['Sodium', '139', 'mmol/L', '134 - 144', 'blood', 'sodium', null],
          ['Potassium', '4.4', 'mmol/L', '3.5 - 5.2', 'blood', 'potassium', null],
          ['Calcium', '9.6', 'mg/dL', '8.7 - 10.2', 'blood', 'calcium', null],
          ['ALT (SGPT)', '31', 'IU/L', '0 - 44', 'blood', 'alt', null],
          ['AST (SGOT)', '24', 'IU/L', '0 - 40', 'blood', 'ast', null],
        ],
      },
      {
        // The lipid table starts at the bottom of page 1 (its first row) and continues here.
        title: 'Lipid panel',
        carryOver: 1,
        previous: null,
        rows: [
          ['Cholesterol, Total', '229', 'mg/dL', '100 - 199', 'blood', 'cholesterol-total', null],
          ['HDL Cholesterol', '31', 'mg/dL', '> 39', 'blood', 'hdl', null],
          ['LDL Chol Calc (NIH)', '151', 'mg/dL', '0 - 99', 'blood', 'ldl', null],
          ['Triglycerides', '236', 'mg/dL', '0 - 149', 'blood', 'triglycerides', null],
          ['Hemoglobin A1c', '5.9', '%', '4.8 - 5.6', 'blood', 'hba1c', null],
        ],
      },
    ],
  },
]

/** The rows a correct extraction contains, one per value and date. */
export function expectedRows(report) {
  const out = []
  report.pages.forEach((page, i) => {
    page.rows.forEach(([name, value, unit, range, specimen, marker, previous], j) => {
      // Rows carried over are printed at the bottom of the page before.
      const n = j < (page.carryOver ?? 0) ? i : i + 1
      out.push({ page: n, date: report.sample.iso, name, value, unit, range, specimen, marker })
      if (previous !== null && page.previous) out.push({ page: n, date: page.previous.iso, name, value: previous, unit, range, specimen, marker, previous: true })
    })
  })
  return out
}
