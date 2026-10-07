import type { Marker, Panel, Source, UnitDef } from './types'
import { SOURCES } from './sources'

export const PANELS: Panel[] = [
  { id: 'blood-count', name: 'Blood count' },
  { id: 'glucose', name: 'Glucose' },
  { id: 'lipids', name: 'Lipids' },
  { id: 'liver', name: 'Liver' },
  { id: 'kidney', name: 'Kidney and electrolytes' },
  { id: 'thyroid', name: 'Thyroid' },
  { id: 'iron', name: 'Iron' },
  { id: 'vitamins', name: 'Vitamins' },
  { id: 'hormones', name: 'Hormones' },
  { id: 'inflammation', name: 'Inflammation' },
]

/** The canonical unit itself. */
const base = (unit: string): UnitDef => ({ unit, toCanonical: (v) => v, fromCanonical: (v) => v, factor: 1 })

/** A unit converted to the canonical one by multiplying by `factor`. */
const linear = (unit: string, factor: number, source: Source): UnitDef => ({
  unit,
  factor,
  source,
  toCanonical: (v) => v * factor,
  fromCanonical: (v) => v / factor,
})

/** A different spelling of the same quantity (mIU/L and µIU/mL), so the factor is exactly 1. */
const same = (unit: string): UnitDef => linear(unit, 1, SOURCES.siPrefixes)

const cells = (canonical = '10⁹/L') => [base(canonical), same('10³/µL'), linear('/µL', 0.001, SOURCES.siPrefixes)]

// HbA1c: IFCC (mmol/mol) = (NGSP % − 2.15) × 10.929, the IFCC–NGSP master equation.
const hba1cPercent: UnitDef = {
  unit: '%',
  source: SOURCES.hba1c,
  toCanonical: (v) => (v - 2.15) * 10.929,
  fromCanonical: (v) => v / 10.929 + 2.15,
}

const differential = (id: string, name: string, aliases: string[]): Marker[] => [
  { id, name, panel: 'blood-count', aliases, units: cells() },
  { id: `${id}-pct`, name: `${name} (%)`, panel: 'blood-count', aliases, units: [base('%')] },
]

export const MARKERS: Marker[] = [
  // Blood count
  { id: 'haemoglobin', name: 'Haemoglobin', panel: 'blood-count', aliases: ['haemoglobin', 'hemoglobin', 'hemoglobina', 'hgb', 'hb'], units: [base('g/L'), linear('g/dL', 10, SOURCES.siPrefixes)] },
  { id: 'haematocrit', name: 'Haematocrit', panel: 'blood-count', aliases: ['haematocrit', 'hematocrit', 'hematocrito', 'hct', 'ht'], units: [base('%'), linear('L/L', 100, SOURCES.siPrefixes)] },
  { id: 'rbc', name: 'Red blood cells', panel: 'blood-count', aliases: ['red blood cells', 'red cells', 'rbc', 'erythrocytes', 'eritrocitos', 'globulos vermelhos', 'hemacias'], units: [base('10¹²/L'), same('10⁶/µL')] },
  { id: 'mcv', name: 'MCV', panel: 'blood-count', aliases: ['mcv', 'mean corpuscular volume', 'vgm', 'volume globular medio', 'vcm', 'volume corpuscular medio'], units: [base('fL')] },
  { id: 'mch', name: 'MCH', panel: 'blood-count', aliases: ['mch', 'mean corpuscular haemoglobin', 'mean corpuscular hemoglobin', 'hgm', 'hemoglobina globular media', 'hcm', 'hemoglobina corpuscular media'], units: [base('pg')] },
  { id: 'mchc', name: 'MCHC', panel: 'blood-count', aliases: ['mchc', 'mean corpuscular haemoglobin concentration', 'mean corpuscular hemoglobin concentration', 'chgm', 'concentracao de hemoglobina globular media', 'chcm', 'concentracao de hemoglobina corpuscular media', 'cmhg'], units: [base('g/L'), linear('g/dL', 10, SOURCES.siPrefixes)] },
  { id: 'rdw', name: 'RDW', panel: 'blood-count', aliases: ['rdw', 'rdw cv', 'red cell distribution width', 'amplitude de distribuicao eritrocitaria', 'indice de anisocitose'], units: [base('%')] },
  { id: 'wbc', name: 'White blood cells', panel: 'blood-count', aliases: ['white blood cells', 'white cells', 'wbc', 'leukocytes', 'leucocitos', 'globulos brancos'], units: cells() },
  ...differential('neutrophils', 'Neutrophils', ['neutrophils', 'neutrofilos', 'neut', 'neutrofilos segmentados']),
  ...differential('lymphocytes', 'Lymphocytes', ['lymphocytes', 'linfocitos', 'lymph', 'lymphs']),
  ...differential('monocytes', 'Monocytes', ['monocytes', 'monocitos', 'mono']),
  ...differential('eosinophils', 'Eosinophils', ['eosinophils', 'eosinofilos', 'eos']),
  ...differential('basophils', 'Basophils', ['basophils', 'basofilos', 'baso']),
  { id: 'platelets', name: 'Platelets', panel: 'blood-count', aliases: ['platelets', 'platelet count', 'plt', 'plaquetas', 'contagem de plaquetas'], units: cells() },
  { id: 'mpv', name: 'MPV', panel: 'blood-count', aliases: ['mpv', 'mean platelet volume', 'vpm', 'volume plaquetario medio'], units: [base('fL')] },

  // Glucose
  { id: 'glucose', name: 'Glucose', panel: 'glucose', aliases: ['glucose', 'fasting glucose', 'glucose fasting', 'glicose', 'glicemia', 'glicemia em jejum', 'glucose serum', 'glucose plasma'], units: [base('mmol/L'), linear('mg/dL', 0.0555, SOURCES.glucose)] },
  { id: 'hba1c', name: 'HbA1c', panel: 'glucose', aliases: ['hba1c', 'a1c', 'haemoglobin a1c', 'hemoglobin a1c', 'glycated haemoglobin', 'glycated hemoglobin', 'glycohemoglobin', 'hemoglobina glicada', 'hemoglobina glicosilada', 'hemoglobina a1c'], units: [base('mmol/mol'), hba1cPercent] },
  { id: 'insulin', name: 'Insulin', panel: 'glucose', aliases: ['insulin', 'fasting insulin', 'insulina', 'insulina em jejum'], units: [base('pmol/L'), linear('µIU/mL', 6.0, SOURCES.insulin), linear('mIU/L', 6.0, SOURCES.insulin)] },

  // Lipids
  { id: 'cholesterol-total', name: 'Total cholesterol', panel: 'lipids', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol', 'colesterol total', 'colesterol'], units: [base('mmol/L'), linear('mg/dL', 0.02586, SOURCES.cholesterol)] },
  { id: 'hdl', name: 'HDL cholesterol', panel: 'lipids', aliases: ['hdl', 'hdl cholesterol', 'cholesterol hdl', 'hdl c', 'colesterol hdl', 'hdl colesterol', 'colesterol das hdl'], units: [base('mmol/L'), linear('mg/dL', 0.02586, SOURCES.cholesterol)] },
  { id: 'ldl', name: 'LDL cholesterol', panel: 'lipids', aliases: ['ldl', 'ldl cholesterol', 'cholesterol ldl', 'ldl c', 'ldl calculated', 'colesterol ldl', 'ldl colesterol', 'colesterol das ldl', 'colesterol ldl directo', 'colesterol ldl direto', 'ldl directo', 'ldl direto', 'direct ldl', 'ldl direct', 'ldl cholesterol direct'], units: [base('mmol/L'), linear('mg/dL', 0.02586, SOURCES.cholesterol)] },
  { id: 'non-hdl', name: 'Non-HDL cholesterol', panel: 'lipids', aliases: ['non hdl cholesterol', 'non hdl', 'colesterol nao hdl', 'colesterol nao-hdl'], units: [base('mmol/L'), linear('mg/dL', 0.02586, SOURCES.cholesterol)] },
  { id: 'triglycerides', name: 'Triglycerides', panel: 'lipids', aliases: ['triglycerides', 'triglyceride', 'trigliceridos', 'triglicerideos', 'triglicerides', 'tg'], units: [base('mmol/L'), linear('mg/dL', 0.01129, SOURCES.triglycerides)] },
  { id: 'apob', name: 'ApoB', panel: 'lipids', aliases: ['apob', 'apo b', 'apolipoprotein b', 'apolipoproteina b'], units: [base('g/L'), linear('mg/dL', 0.01, SOURCES.siPrefixes)] },
  {
    id: 'lpa', name: 'Lp(a)', panel: 'lipids', aliases: ['lp a', 'lipoprotein a', 'lipoproteina a', 'lipoproteina pequeno a'],
    units: [base('nmol/L'), base('mg/dL')],
    noConversion: { reason: 'Lp(a) in mg/dL and nmol/L measure different things, so one factor can\'t convert between them. Results are only compared in the same unit.', source: SOURCES.lpa },
  },

  // Liver
  { id: 'alt', name: 'ALT', panel: 'liver', aliases: ['alt', 'alt tgp', 'tgp', 'tgp alt', 'alanine aminotransferase', 'alanina aminotransferase', 'sgpt', 'alat'], units: [base('U/L')] },
  { id: 'ast', name: 'AST', panel: 'liver', aliases: ['ast', 'ast tgo', 'tgo', 'tgo ast', 'aspartate aminotransferase', 'aspartato aminotransferase', 'sgot', 'asat'], units: [base('U/L')] },
  { id: 'ggt', name: 'GGT', panel: 'liver', aliases: ['ggt', 'gamma gt', 'gama gt', 'gamma glutamyl transferase', 'gama glutamil transferase', 'gamaglutamiltransferase', 'y gt'], units: [base('U/L')] },
  { id: 'alp', name: 'Alkaline phosphatase', panel: 'liver', aliases: ['alkaline phosphatase', 'alp', 'alk phos', 'fosfatase alcalina', 'fa'], units: [base('U/L')] },
  { id: 'bilirubin-total', name: 'Total bilirubin', panel: 'liver', aliases: ['total bilirubin', 'bilirubin total', 'bilirubin', 'bilirrubina total', 'bilirrubina', 'bilirrubinemia total', 'bilirrubinas total'], units: [base('µmol/L'), linear('mg/dL', 17.1, SOURCES.bilirubin)] },
  { id: 'bilirubin-direct', name: 'Direct bilirubin', panel: 'liver', aliases: ['direct bilirubin', 'bilirubin direct', 'conjugated bilirubin', 'bilirrubina directa', 'bilirrubina direta', 'bilirrubina conjugada', 'bilirrubinemia directa', 'bilirrubinemia direta', 'bilirrubinas directa', 'bilirrubinas direta'], units: [base('µmol/L'), linear('mg/dL', 17.1, SOURCES.bilirubin)] },
  { id: 'albumin', name: 'Albumin', panel: 'liver', aliases: ['albumin', 'albumina', 'albumin serum'], units: [base('g/L'), linear('g/dL', 10, SOURCES.siPrefixes)] },
  { id: 'total-protein', name: 'Total protein', panel: 'liver', aliases: ['total protein', 'protein total', 'proteinas totais', 'proteinas totais sericas'], units: [base('g/L'), linear('g/dL', 10, SOURCES.siPrefixes)] },

  // Kidney and electrolytes
  { id: 'creatinine', name: 'Creatinine', panel: 'kidney', aliases: ['creatinine', 'creatinina', 'creatinine serum', 'creatinina serica', 'creatininemia'], units: [base('µmol/L'), linear('mg/dL', 88.4, SOURCES.creatinine)] },
  { id: 'egfr', name: 'eGFR', panel: 'kidney', aliases: ['egfr', 'estimated gfr', 'gfr estimated', 'tfg', 'tfg estimada', 'taxa de filtracao glomerular', 'taxa de filtracao glomerular estimada', 'tfge'], units: [base('mL/min/1.73m²')] },
  {
    id: 'urea', name: 'Urea', panel: 'kidney', aliases: ['urea', 'ureia', 'urea serum', 'ureia serica', 'uremia'],
    units: [base('mmol/L'), linear('mg/dL', 0.1665, SOURCES.urea), linear('g/L', 16.65, SOURCES.urea)],
  },
  {
    id: 'bun', name: 'BUN (urea nitrogen)', panel: 'kidney', aliases: ['bun', 'blood urea nitrogen', 'urea nitrogen', 'azoto ureico', 'nitrogenio ureico'],
    // Canonical unit is mmol/L of urea, the same as the urea marker, so the two can be charted together.
    units: [base('mmol/L'), linear('mg/dL', 0.357, SOURCES.bun)],
    sameAnalyteAs: { markerId: 'urea', unit: 'mmol/L', note: 'BUN counts only the nitrogen in urea; converted to urea in mmol/L.' },
  },
  { id: 'uric-acid', name: 'Uric acid', panel: 'kidney', aliases: ['uric acid', 'urate', 'acido urico', 'uricemia'], units: [base('µmol/L'), linear('mg/dL', 59.48, SOURCES.uricAcid)] },
  { id: 'sodium', name: 'Sodium', panel: 'kidney', aliases: ['sodium', 'sodio', 'na', 'na+', 'natremia'], units: [base('mmol/L'), same('mEq/L')] },
  { id: 'potassium', name: 'Potassium', panel: 'kidney', aliases: ['potassium', 'potassio', 'k', 'k+', 'kaliemia', 'caliemia'], units: [base('mmol/L'), same('mEq/L')] },
  { id: 'chloride', name: 'Chloride', panel: 'kidney', aliases: ['chloride', 'cloro', 'cloreto', 'cl', 'cl-', 'cloremia'], units: [base('mmol/L'), same('mEq/L')] },
  { id: 'calcium', name: 'Calcium', panel: 'kidney', aliases: ['calcium', 'calcio', 'calcium total', 'calcio total', 'ca', 'calcemia'], units: [base('mmol/L'), linear('mg/dL', 0.2495, SOURCES.calcium)] },
  { id: 'magnesium', name: 'Magnesium', panel: 'kidney', aliases: ['magnesium', 'magnesio', 'mg'], units: [base('mmol/L'), linear('mg/dL', 0.4114, SOURCES.magnesium)] },
  { id: 'phosphate', name: 'Phosphate', panel: 'kidney', aliases: ['phosphate', 'phosphorus', 'fosforo', 'fosfato', 'fosforo inorganico', 'p', 'fosfatemia'], units: [base('mmol/L'), linear('mg/dL', 0.3229, SOURCES.phosphate)] },

  // Thyroid
  { id: 'tsh', name: 'TSH', panel: 'thyroid', aliases: ['tsh', 'thyrotropin', 'thyroid stimulating hormone', 'tirotropina', 'hormona estimulante da tiroide', 'tsh ultrassensivel', 'tsh 3a geracao'], units: [base('mIU/L'), same('µIU/mL')] },
  { id: 'free-t4', name: 'Free T4', panel: 'thyroid', aliases: ['free t4', 'ft4', 't4 free', 'free thyroxine', 't4 livre', 'tiroxina livre'], units: [base('pmol/L'), linear('ng/dL', 12.87, SOURCES.freeT4)] },
  { id: 'free-t3', name: 'Free T3', panel: 'thyroid', aliases: ['free t3', 'ft3', 't3 free', 'free triiodothyronine', 't3 livre', 'triiodotironina livre'], units: [base('pmol/L'), linear('pg/mL', 1.536, SOURCES.freeT3)] },
  { id: 'anti-tpo', name: 'Anti-TPO antibodies', panel: 'thyroid', aliases: ['anti tpo', 'tpo antibodies', 'thyroid peroxidase antibodies', 'anticorpos anti tpo', 'anticorpos anti peroxidase', 'ac anti tpo'], units: [base('IU/mL')] },

  // Iron
  { id: 'iron', name: 'Iron', panel: 'iron', aliases: ['iron', 'serum iron', 'iron serum', 'ferro', 'ferro serico', 'sideremia'], units: [base('µmol/L'), linear('µg/dL', 0.1791, SOURCES.iron)] },
  { id: 'ferritin', name: 'Ferritin', panel: 'iron', aliases: ['ferritin', 'ferritina'], units: [base('µg/L'), same('ng/mL')] },
  { id: 'transferrin', name: 'Transferrin', panel: 'iron', aliases: ['transferrin', 'transferrina'], units: [base('g/L'), linear('mg/dL', 0.01, SOURCES.siPrefixes)] },
  { id: 'transferrin-saturation', name: 'Transferrin saturation', panel: 'iron', aliases: ['transferrin saturation', 'iron saturation', 'tsat', 'saturacao da transferrina', 'indice de saturacao da transferrina'], units: [base('%')] },
  { id: 'tibc', name: 'TIBC', panel: 'iron', aliases: ['tibc', 'total iron binding capacity', 'ctff', 'capacidade total de fixacao do ferro'], units: [base('µmol/L'), linear('µg/dL', 0.1791, SOURCES.iron)] },

  // Vitamins
  { id: 'vitamin-d', name: 'Vitamin D (25-OH)', panel: 'vitamins', aliases: ['vitamin d', '25 oh vitamin d', '25 hydroxyvitamin d', '25 hydroxy vitamin d', 'vitamin d 25 hydroxy', 'vitamin d 25 hydroxy total', 'vitamin d total 25 hydroxy', 'vitamin d 25 oh', '25 oh d', 'vitamina d', '25 oh vitamina d', '25 hidroxivitamina d', 'vitamina d 25 oh'], units: [base('nmol/L'), linear('ng/mL', 2.496, SOURCES.vitaminD)] },
  { id: 'vitamin-b12', name: 'Vitamin B12', panel: 'vitamins', aliases: ['vitamin b12', 'b12', 'cobalamin', 'vitamina b12', 'cobalamina'], units: [base('pmol/L'), linear('pg/mL', 0.7378, SOURCES.vitaminB12)] },
  { id: 'folate', name: 'Folate', panel: 'vitamins', aliases: ['folate', 'folic acid', 'serum folate', 'acido folico', 'folato'], units: [base('nmol/L'), linear('ng/mL', 2.266, SOURCES.folate)] },

  // Hormones
  { id: 'testosterone', name: 'Total testosterone', panel: 'hormones', aliases: ['total testosterone', 'testosterone total', 'testosterone', 'testosterona total', 'testosterona'], units: [base('nmol/L'), linear('ng/dL', 0.03467, SOURCES.testosterone), linear('ng/mL', 0.3467, SOURCES.testosterone)] },
  {
    id: 'free-testosterone',
    name: 'Free testosterone',
    panel: 'hormones',
    aliases: ['free testosterone', 'testosterone free', 'free t', 'testosterona livre', 'testosterona livre calculada', 'calculated free testosterone'],
    units: [base('pmol/L'), linear('pg/mL', 3.467, SOURCES.testosterone), linear('ng/dL', 34.67, SOURCES.testosterone)],
  },
  { id: 'shbg', name: 'SHBG', panel: 'hormones', aliases: ['shbg', 'sex hormone binding globulin', 'globulina de ligacao as hormonas sexuais'], units: [base('nmol/L')] },
  { id: 'oestradiol', name: 'Oestradiol', panel: 'hormones', aliases: ['oestradiol', 'estradiol', 'e2', '17 beta estradiol'], units: [base('pmol/L'), linear('pg/mL', 3.671, SOURCES.oestradiol)] },
  { id: 'lh', name: 'LH', panel: 'hormones', aliases: ['lh', 'luteinising hormone', 'luteinizing hormone', 'hormona luteinizante', 'hormonio luteinizante'], units: [base('U/L'), same('mIU/mL')] },
  { id: 'fsh', name: 'FSH', panel: 'hormones', aliases: ['fsh', 'follicle stimulating hormone', 'hormona folículo estimulante', 'hormona foliculo estimulante', 'hormonio foliculo estimulante'], units: [base('U/L'), same('mIU/mL')] },
  { id: 'prolactin', name: 'Prolactin', panel: 'hormones', aliases: ['prolactin', 'prolactina', 'prl'], units: [base('ng/mL'), same('µg/L')] },
  { id: 'cortisol', name: 'Cortisol', panel: 'hormones', aliases: ['cortisol', 'cortisol am', 'morning cortisol', 'cortisol serico', 'cortisol matinal'], units: [base('nmol/L'), linear('µg/dL', 27.59, SOURCES.cortisol)] },
  { id: 'dhea-s', name: 'DHEA-S', panel: 'hormones', aliases: ['dhea s', 'dheas', 'dhea sulfate', 'dhea sulphate', 'sulfato de dhea', 'dhea so4'], units: [base('µmol/L'), linear('µg/dL', 0.02714, SOURCES.dheas)] },
  { id: 'psa', name: 'PSA', panel: 'hormones', aliases: ['psa', 'total psa', 'psa total', 'prostate specific antigen', 'antigenio especifico da prostata'], units: [base('µg/L'), same('ng/mL')] },

  // Inflammation
  { id: 'crp', name: 'CRP', panel: 'inflammation', aliases: ['crp', 'c reactive protein', 'pcr', 'proteina c reactiva', 'proteina c reativa'], units: [base('mg/L'), linear('mg/dL', 10, SOURCES.siPrefixes)] },
  { id: 'hs-crp', name: 'hs-CRP', panel: 'inflammation', aliases: ['hs crp', 'hscrp', 'high sensitivity crp', 'high sensitivity c reactive protein', 'pcr ultrassensivel', 'pcr alta sensibilidade', 'proteina c reactiva ultrassensivel', 'proteina c reativa ultrassensivel'], units: [base('mg/L'), linear('mg/dL', 10, SOURCES.siPrefixes)] },
  { id: 'esr', name: 'ESR', panel: 'inflammation', aliases: ['esr', 'erythrocyte sedimentation rate', 'sed rate', 'vs', 'velocidade de sedimentacao', 'velocidade de sedimentacao eritrocitaria', 'vhs', 'VS à 1ª hora', 'velocidade de sedimentacao 1a hora'], units: [base('mm/h')] },
  { id: 'homocysteine', name: 'Homocysteine', panel: 'inflammation', aliases: ['homocysteine', 'homocisteina'], units: [base('µmol/L')] },
]

export const MARKERS_BY_ID: ReadonlyMap<string, Marker> = new Map(MARKERS.map((m) => [m.id, m]))

export function getMarker(id: string): Marker | undefined {
  return MARKERS_BY_ID.get(id)
}

export type CatalogueId = (typeof MARKERS)[number]['id']
