import { createContext, use } from 'react'
import type { ProfileData } from '../data/profile'

export const ProfileContext = createContext<ProfileData | null>(null)

export function useProfileData(): ProfileData {
  const data = use(ProfileContext)
  if (!data) throw new Error('useProfileData outside ProfileLayout')
  return data
}

/** The URL prefix for the current person's screens. */
export function useBase(): string {
  return `/p/${useProfileData().profile.id}`
}
