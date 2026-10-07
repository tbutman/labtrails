// Before your next test (SPEC.md section 18.6): what was measured last time, what wasn't repeated,
// notes from the history, and a request for the tests the user ticks, in English or Portuguese. The
// list is the user's; the app never chooses tests. Built from the catalogue, not by the AI.

import { analyse } from './analysis'
import { MARKERS, getMarker } from './catalogue/catalogue'
import { influencesFor, type Influence } from './influences'
import { timedOn, type TimelineEntry } from './timeline'
import type { Report, Result } from './types'

export type RequestLanguage = 'en' | 'pt'

/** European Portuguese names as labs print them, for the request. */
export const PORTUGUESE_NAMES: Record<string, string> = {
  haemoglobin: 'Hemoglobina',
  haematocrit: 'Hematócrito',
  rbc: 'Eritrócitos',
  mcv: 'VGM',
  mch: 'HGM',
  mchc: 'CHGM',
  rdw: 'RDW',
  wbc: 'Leucócitos',
  neutrophils: 'Neutrófilos',
  'neutrophils-pct': 'Neutrófilos (%)',
  lymphocytes: 'Linfócitos',
  'lymphocytes-pct': 'Linfócitos (%)',
  monocytes: 'Monócitos',
  'monocytes-pct': 'Monócitos (%)',
  eosinophils: 'Eosinófilos',
  'eosinophils-pct': 'Eosinófilos (%)',
  basophils: 'Basófilos',
  'basophils-pct': 'Basófilos (%)',
  platelets: 'Plaquetas',
  mpv: 'VPM',
  glucose: 'Glicose',
  hba1c: 'Hemoglobina glicada (HbA1c)',
  insulin: 'Insulina',
  'cholesterol-total': 'Colesterol total',
  hdl: 'Colesterol HDL',
  ldl: 'Colesterol LDL',
  'non-hdl': 'Colesterol não-HDL',
  triglycerides: 'Triglicéridos',
  apob: 'Apolipoproteína B',
  lpa: 'Lipoproteína (a)',
  alt: 'ALT (TGP)',
  ast: 'AST (TGO)',
  ggt: 'GGT',
  alp: 'Fosfatase alcalina',
  'bilirubin-total': 'Bilirrubina total',
  'bilirubin-direct': 'Bilirrubina direta',
  albumin: 'Albumina',
  'total-protein': 'Proteínas totais',
  creatinine: 'Creatinina',
  egfr: 'Taxa de filtração glomerular estimada',
  urea: 'Ureia',
  bun: 'Azoto ureico (BUN)',
  'uric-acid': 'Ácido úrico',
  sodium: 'Sódio',
  potassium: 'Potássio',
  chloride: 'Cloro',
  calcium: 'Cálcio',
  magnesium: 'Magnésio',
  phosphate: 'Fósforo',
  tsh: 'TSH',
  'free-t4': 'T4 livre',
  'free-t3': 'T3 livre',
  'anti-tpo': 'Anticorpos anti-TPO',
  iron: 'Ferro',
  ferritin: 'Ferritina',
  transferrin: 'Transferrina',
  'transferrin-saturation': 'Saturação da transferrina',
  tibc: 'Capacidade total de fixação do ferro',
  'vitamin-d': 'Vitamina D (25-OH)',
  'vitamin-b12': 'Vitamina B12',
  folate: 'Ácido fólico',
  testosterone: 'Testosterona total',
  'free-testosterone': 'Testosterona livre',
  shbg: 'SHBG',
  oestradiol: 'Estradiol',
  lh: 'LH',
  fsh: 'FSH',
  prolactin: 'Prolactina',
  cortisol: 'Cortisol',
  'dhea-s': 'DHEA-S',
  psa: 'PSA total',
  crp: 'Proteína C reativa',
  'hs-crp': 'Proteína C reativa de alta sensibilidade',
  esr: 'Velocidade de sedimentação',
  homocysteine: 'Homocisteína',
}

/** "Total testosterone" → "total testosterone"; "HbA1c" and "TSH" keep their capitals. */
const inSentence = (name: string) => (/^[A-ZÁÉÍÓÚ][a-záéíóúãõâêôç]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name)

export function requestName(markerId: string, lang: RequestLanguage): string {
  const name = lang === 'pt' ? (PORTUGUESE_NAMES[markerId] ?? getMarker(markerId)?.name ?? markerId) : (getMarker(markerId)?.name ?? markerId)
  return inSentence(name)
}

const list = (items: string[], and: string) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`)

/** The request for the ticked tests, in catalogue order. */
export function requestSentence(markerIds: string[], lang: RequestLanguage): string {
  const ids = MARKERS.map((m) => m.id).filter((id) => markerIds.includes(id))
  if (!ids.length) return ''
  const names = ids.map((id) => requestName(id, lang))
  return lang === 'pt' ? `Gostaria de fazer análises a: ${list(names, 'e')}, por favor.` : `I'd like these blood tests, please: ${list(names, 'and')}.`
}

export type HistoryNotes = {
  /** Markers measured before that vary through the day, with the times of earlier draws. */
  timeOfDay: { markerId: string; name: string; times: string[]; influence: Influence }[]
  /** Timeline entries active now whose test timing around a dose matters. */
  timed: TimelineEntry[]
  /** How many earlier tests were fasting, of those where it's known. */
  fasting: { yes: number; known: number }
  /** Markers measured before that eating before the test is known to affect. */
  eating: { markerId: string; name: string; influence: Influence }[]
}

/** Facts from the history worth having in mind before the next test. */
export function historyNotes(results: Result[], reports: Report[], timeline: TimelineEntry[], today: string): HistoryNotes {
  const markers = analyse(results, reports).flatMap((p) => p.markers)
  const byId = new Map(reports.map((r) => [r.id, r]))
  const timeOfDay = markers.flatMap((a) => {
    const influence = influencesFor(a.marker.id).find((i) => i.influence === 'time-of-day')
    if (!influence) return []
    const times = [...new Set(a.series.points.map((p) => byId.get(p.reportId)?.time).filter((t): t is string => !!t))].sort()
    return [{ markerId: a.marker.id, name: a.marker.name, times, influence }]
  })
  const eating = markers.flatMap((a) => {
    const influence = influencesFor(a.marker.id).find((i) => i.influence === 'eating')
    return influence ? [{ markerId: a.marker.id, name: a.marker.name, influence }] : []
  })
  const known = reports.filter((r) => r.context?.fasting === 'yes' || r.context?.fasting === 'no')
  return { timeOfDay, timed: timedOn(timeline, today), fasting: { yes: known.filter((r) => r.context?.fasting === 'yes').length, known: known.length }, eating }
}
