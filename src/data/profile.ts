import type { Profile, Report, Result, Summary } from '../labs/types'
import { DEMO_PROFILE, DEMO_REPORTS, DEMO_RESULTS, DEMO_SUMMARIES } from '../app/demo'
import type { RecordStore } from './store'

export type ProfileData = { profile: Profile; reports: Report[]; results: Result[]; summaries: Summary[] }

export async function seedDemo(store: RecordStore): Promise<void> {
  await store.put('profiles', DEMO_PROFILE)
  for (const r of DEMO_REPORTS) await store.put('reports', r)
  for (const r of DEMO_RESULTS) await store.put('results', r)
  for (const s of DEMO_SUMMARIES) await store.put('summaries', s)
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
  }
}
