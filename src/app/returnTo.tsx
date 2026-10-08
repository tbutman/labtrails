// Where you were when the vault locked or the page reloaded (X-05). A screen that needs the vault
// sends you to the start; this remembers the address for this tab (sessionStorage, never the vault's
// contents), so unlocking takes you back. A reloaded demo can't come back, because nothing in it was
// saved, so the start says the demo ended instead.

import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router'
import { getMarker } from '../labs/catalogue/catalogue'
import { APP } from './brand'
import { DEMO_PROFILE } from './demo'
import { useSession } from './sessionContext'

const RETURN = 'labtrails-return'
const DEMO_ENDED = 'labtrails-demo-ended'

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private windows); the app works without it.
  }
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** Sends a screen that needs the vault to the start, remembering where it was. */
export function ToStart() {
  const { mode } = useSession()
  const { pathname, search } = useLocation()
  if (pathname.startsWith(`${APP}/p/${DEMO_PROFILE.id}`)) {
    if (mode !== 'demo') write(DEMO_ENDED, '1')
  } else if (mode === 'locked' || mode === 'loading') {
    write(RETURN, pathname + search)
  }
  return <Navigate to={APP} replace />
}

/** The remembered address, if any, without clearing it. */
export const returnPath = () => read(RETURN)

/** The remembered address, cleared: for right after unlocking. */
export function takeReturnPath(): string | null {
  const path = read(RETURN)
  write(RETURN, null)
  return path
}

export const forgetReturnPath = () => write(RETURN, null)

/** Whether the demo just ended with a reload. */
export const demoEnded = () => read(DEMO_ENDED) === '1'

/** Clears that, once the note has been shown. */
export const clearDemoEnded = () => write(DEMO_ENDED, null)

/** "Add results", "Ferritin", "the overview": the screen an address is, for "You were on …". */
export function placeName(path: string): string {
  const p = path.split('?')[0].replace(/\/$/, '')
  if (p === `${APP}/settings`) return 'Settings'
  if (p === `${APP}/profiles/new`) return 'Add a person'
  if (p.startsWith(`${APP}/profiles/`)) return 'Edit a person'
  const m = p.match(/^\/app\/p\/[^/]+(?:\/(.*))?$/)
  if (!m) return 'the app'
  const rest = m[1] ?? ''
  const marker = rest.match(/^marker\/([^/]+)$/)
  if (marker) return getMarker(marker[1])?.name ?? 'a marker'
  const names: [RegExp, string][] = [
    [/^$/, 'the overview'],
    [/^table$/, 'All results'],
    [/^reports$/, 'Reports'],
    [/^reports\/new$/, 'Add results'],
    [/^reports\/read$/, 'Import reports'],
    [/^reports\/[^/]+\/edit$/, 'Edit report details'],
    [/^reports\/[^/]+\/results\//, 'Correct a result'],
    [/^next-test$/, 'Before your next test'],
    [/^timeline$/, 'Timeline'],
    [/^timeline\//, 'a timeline entry'],
    [/^summaries$/, 'Summaries'],
    [/^ask$/, 'Ask about your results'],
    [/^doctor$/, 'Doctor report'],
  ]
  return names.find(([re]) => re.test(rest))?.[1] ?? 'the app'
}

/** Warns before the page is closed or reloaded while a form has typed values that aren't saved. */
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
