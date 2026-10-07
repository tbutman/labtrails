import type { PersonalLine } from '../labs/lines'
import type { TimelineEntry } from '../labs/timeline'
import type { Profile, Report, Result, Summary } from '../labs/types'
import { DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, DEMO_SUMMARIES, DEMO_TIMELINE } from '../app/demo'
import type { RecordStore } from '../core'
import { deleteDocument } from '../core/documents/documents'

export type ProfileData = { profile: Profile; reports: Report[]; results: Result[]; summaries: Summary[]; timeline: TimelineEntry[]; lines: PersonalLine[] }

export async function seedDemo(store: RecordStore): Promise<void> {
  await store.put('profiles', DEMO_PROFILE)
  for (const r of DEMO_REPORTS) await store.put('reports', r)
  for (const r of DEMO_RESULTS) await store.put('results', r)
  for (const s of DEMO_SUMMARIES) await store.put('summaries', s)
  for (const t of DEMO_TIMELINE) await store.put('timeline', t)
}

export async function loadProfile(store: RecordStore, profileId: string): Promise<ProfileData | null> {
  const profile = await store.get<Profile>('profiles', profileId)
  if (!profile) return null
  const mine = <T extends { profileId: string }>(xs: T[]) => xs.filter((x) => x.profileId === profileId)
  return {
    profile,
    reports: mine(await store.list<Report>('reports')),
    results: mine(await store.list<Result>('results')),
    summaries: mine(await store.list<Summary>('summaries')),
    timeline: mine(await store.list<TimelineEntry>('timeline')),
    lines: mine(await store.list<PersonalLine>('lines')),
  }
}

/**
 * Deletes a person and everything kept about them: reports, results, documents, summaries, Ask
 * conversations, timeline entries and lines (LAB-08). Name mappings (aliases) are shared, so they stay.
 */
export async function deleteProfile(store: RecordStore, profileId: string): Promise<void> {
  for (const c of ['results', 'reports', 'summaries', 'askThreads', 'timeline', 'lines'] as const) {
    for (const x of await store.list<{ id: string; profileId: string }>(c)) if (x.profileId === profileId) await store.delete(c, x.id)
  }
  for (const d of await store.list<{ id: string; profileId?: string; blobId: string }>('documents')) if (d.profileId === profileId) await deleteDocument(store, d)
  await store.delete('profiles', profileId)
}
