import { COLLECTIONS } from '../labs/types'

export const APP_ID = 'labtrails'
export const APP_COLLECTIONS = COLLECTIONS

/** LabTrails' part of the encrypted settings (the core keeps theme, auto-lock, the AI key and backups). */
export type AppSettings = { preferredUnit: Record<string, string> }
export const DEFAULT_APP_SETTINGS: AppSettings = { preferredUnit: {} }
