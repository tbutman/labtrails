// Where every conversion factor comes from (SPEC.md section 8). Factors for single substances are
// derived from molar masses in PubChem (checked 6 October 2026) and cross-checked against the AMA
// Manual of Style's table of SI conversion factors, which rounds to about three significant figures.
//
// Derivations, with M the molar mass in g/mol:
//   mg/dL → mmol/L = 10 / M      mg/dL → µmol/L = 10,000 / M     µg/dL → µmol/L = 10 / M
//   ng/mL → nmol/L = 1,000 / M   ng/dL → pmol/L = 10,000 / M     pg/mL → pmol/L = 1,000 / M
//   µg/dL → nmol/L = 10,000 / M

import type { Source } from './types'

const AMA = 'cross-checked against the AMA Manual of Style SI conversion table (https://academic.oup.com/amamanualofstyle/si-conversion-calculator)'

const pubchem = (name: string, cid: number, mass: string, derivation: string): Source => ({
  title: `PubChem: ${name} (CID ${cid}), molar mass ${mass} g/mol`,
  url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
  note: `${derivation}; ${AMA}`,
})

export const SOURCES = {
  siPrefixes: {
    title: 'BIPM, The International System of Units (SI Brochure), SI prefixes',
    url: 'https://www.bipm.org/en/publications/si-brochure',
    note: 'Factors that are powers of ten (1 g/dL = 10 g/L, 1 mg/dL = 0.01 g/L, 10³/µL = 10⁹/L) or exactly 1 (mIU/L = µIU/mL, mmol/L = mEq/L for ions with one charge).',
  },
  glucose: pubchem('glucose', 5793, '180.16', '10 / 180.16 = 0.0555'),
  cholesterol: pubchem('cholesterol', 5997, '386.7', '10 / 386.7 = 0.02586'),
  triglycerides: pubchem('triolein', 5497163, '885.4', '10 / 885.4 = 0.01129; triglycerides are conventionally converted as triolein'),
  creatinine: pubchem('creatinine', 588, '113.12', '10,000 / 113.12 = 88.4'),
  urea: pubchem('urea', 1176, '60.056', '10 / 60.056 = 0.1665'),
  bun: {
    title: 'PubChem: nitrogen, standard atomic weight 14.007',
    url: 'https://pubchem.ncbi.nlm.nih.gov/element/Nitrogen',
    note: `BUN measures the two nitrogen atoms in each urea molecule (2 × 14.007 = 28.014 g/mol): 10 / 28.014 = 0.357 mmol/L of urea per mg/dL. So urea mg/dL ≈ BUN mg/dL × 60.056 / 28.014 = 2.14. ${AMA}`,
  },
  uricAcid: pubchem('uric acid', 1175, '168.11', '10,000 / 168.11 = 59.48'),
  bilirubin: pubchem('bilirubin', 5280352, '584.7', '10,000 / 584.7 = 17.1'),
  calcium: pubchem('calcium', 5460341, '40.08', '10 / 40.08 = 0.2495'),
  magnesium: pubchem('magnesium', 5462224, '24.305', '10 / 24.305 = 0.4114'),
  phosphate: pubchem('phosphorus', 5462309, '30.974', '10 / 30.974 = 0.3229; inorganic phosphate is reported as phosphorus'),
  iron: pubchem('iron', 23925, '55.84', '10 / 55.84 = 0.1791'),
  vitaminD: pubchem('calcifediol (25-hydroxyvitamin D3)', 5283731, '400.6', '1,000 / 400.6 = 2.496; total 25-OH vitamin D is conventionally converted as D3 (D2 alone would give 2.423)'),
  vitaminB12: pubchem('cyanocobalamin', 166596686, '1355.4', '1,000 / 1355.4 = 0.7378'),
  folate: pubchem('folic acid', 135398658, '441.4', '1,000 / 441.4 = 2.266'),
  freeT4: pubchem('thyroxine', 5819, '776.87', '10,000 / 776.87 = 12.87'),
  freeT3: pubchem('triiodothyronine', 5920, '650.97', '1,000 / 650.97 = 1.536'),
  testosterone: pubchem('testosterone', 6013, '288.4', '10 / 288.4 = 0.03467 per ng/dL, so 0.3467 per ng/mL; for free testosterone in pmol/L, 1,000 / 288.4 = 3.467 per pg/mL and 34.67 per ng/dL'),
  oestradiol: pubchem('estradiol', 5757, '272.4', '1,000 / 272.4 = 3.671'),
  cortisol: pubchem('cortisol (hydrocortisone)', 5754, '362.5', '10,000 / 362.5 = 27.59'),
  dheas: pubchem('DHEA sulfate', 12594, '368.5', '10 / 368.5 = 0.02714'),
  insulin: {
    title: 'Knopp JL, Holder-Pearson L, Chase JG. Insulin units and conversion factors: a story of truth, boots, and faster half-truths. J Diabetes Sci Technol 2019;13(3):597-600',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6501531/',
    note: '1 µIU/mL = 6.00 pmol/L, from the current WHO insulin standard and human insulin\'s molar mass. The often-quoted 6.945 (also in the AMA table) comes from a superseded 1959 standard and overstates by about 15%.',
  },
  hba1c: {
    title: 'Hoelzel W et al. IFCC reference system for measurement of hemoglobin A1c in human blood and the national standardization schemes in the United States, Japan, and Sweden: a method-comparison study. Clin Chem 2004;50(1):166-174',
    url: 'https://pubmed.ncbi.nlm.nih.gov/14709644/',
    note: 'The IFCC-NGSP master equation NGSP (%) = 0.915 × IFCC (%) + 2.15, which with IFCC in mmol/mol gives IFCC = (NGSP − 2.15) × 10.929. NGSP\'s own page (https://ngsp.org/ifcc.asp) gives slightly different constants; at 7% the two differ by 0.01 mmol/mol.',
  },
  lpa: {
    title: 'Kronenberg F et al. Lipoprotein(a) in atherosclerotic cardiovascular disease and aortic stenosis: a European Atherosclerosis Society consensus statement. Eur Heart J 2022;43:3925-3946',
    url: 'https://doi.org/10.1093/eurheartj/ehac361',
    note: 'The panel does not recommend a standard factor to convert between mg/dL and nmol/L, because assays vary extensively.',
  },
} satisfies Record<string, Source>
