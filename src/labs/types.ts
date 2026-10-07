// LabTrails' records (SPEC.md section 7). Stored inside the encrypted vault as app-defined
// collections. Values are kept exactly as printed; conversions, flags and trends are computed.

import type { Comparator } from './units/parse'

export type Profile = { id: string; name: string; sex?: 'female' | 'male'; dateOfBirth?: string; createdAt: string }

export type Recently = 'illness' | 'hard-exercise' | 'alcohol' | 'poor-sleep'

export type TestContext = {
  fasting?: 'yes' | 'no' | 'unknown'
  medications?: string
  recently?: Recently[]
  notes?: string
  /** When the blood was drawn relative to doses of timeline entries where timing matters (SPEC.md 18.1). */
  doseTiming?: DoseTiming[]
}

export type DoseTiming = {
  entryId: string
  /** The entry's label when this was recorded, so the test reads the same if the entry changes. */
  name: string
  when: 'before-dose' | 'after-dose' | 'between'
  /** For "between": the day of the last dose before the test. */
  lastDose?: string
  /** The entry's schedule when this was recorded ("every month"), for context. */
  every?: string
}

export type Report = {
  id: string
  profileId: string
  date: string
  time?: string // time of the blood draw, HH:MM
  lab?: string
  country?: string
  documentId?: string
  source: 'manual' | 'extracted'
  context?: TestContext
  createdAt: string
  updatedAt: string
}

export type Result = {
  /** Set for a result that isn't from blood (a urinalysis row), so it's never charted as a blood test. */
  specimen?: 'urine' | 'other'
  id: string
  reportId: string
  profileId: string
  markerId?: string
  nameAsPrinted: string
  value?: number
  comparator?: Comparator
  textValue?: string
  unitAsPrinted?: string
  range?: { low?: number; high?: number; text: string }
  flagAsPrinted?: string
  createdAt: string
  updatedAt: string
}

export type Alias = { id: string; nameAsPrinted: string; unitAsPrinted?: string; markerId: string }

export type Summary = {
  id: string
  profileId: string
  kind: 'after-report' | 'overall'
  reportId?: string
  model: string
  createdAt: string
  text: string
  inputsDigest: string
}

export const COLLECTIONS = ['profiles', 'reports', 'results', 'aliases', 'summaries', 'askThreads', 'timeline'] as const
export type Collection = (typeof COLLECTIONS)[number]
