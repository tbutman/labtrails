import { createContext, use } from 'react'
import type { ProfileData } from '../data/profile'

export const ProfileContext = createContext<ProfileData | null>(null)

export function useProfileData(): ProfileData {
  const data = use(ProfileContext)
  if (!data) throw new Error('useProfileData outside a profile provider')
  return data
}
