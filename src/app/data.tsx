// Provides one person's records to the screens. In demo mode the store is in memory and seeded with
// the fictional demo person; with the shared core it will be the encrypted vault.

import { useEffect, useState, type ReactNode } from 'react'
import { loadProfile, seedDemo, type ProfileData } from '../data/profile'
import { memoryStore } from '../data/store'
import { DEMO_PROFILE } from './demo'
import { ProfileContext } from './profileContext'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProfileData | null>(null)
  useEffect(() => {
    let cancelled = false
    const store = memoryStore()
    seedDemo(store)
      .then(() => loadProfile(store, DEMO_PROFILE.id))
      .then((d) => !cancelled && setData(d))
    return () => {
      cancelled = true
    }
  }, [])
  if (!data) return <p className="muted">Loading the demo…</p>
  return <ProfileContext value={data}>{children}</ProfileContext>
}
