// Locks the vault after a period without interaction, and when the page has been hidden for that
// long (timers are throttled in background tabs, so the hidden time is checked on return too).

import type { Vault } from './vault'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

export function startAutoLock(vault: Vault, minutes: number, doc: Document = document): () => void {
  const limit = minutes * 60_000
  let timer: ReturnType<typeof setTimeout> | undefined
  let hiddenAt: number | null = null

  const arm = () => {
    clearTimeout(timer)
    if (vault.isUnlocked) timer = setTimeout(() => vault.lock(), limit)
  }
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else {
      if (hiddenAt !== null && Date.now() - hiddenAt >= limit) vault.lock()
      hiddenAt = null
      arm()
    }
  }

  for (const event of ACTIVITY_EVENTS) doc.addEventListener(event, arm, { passive: true, capture: true })
  doc.addEventListener('visibilitychange', onVisibility)
  const unsubscribe = vault.subscribe(arm)
  arm()

  return () => {
    clearTimeout(timer)
    for (const event of ACTIVITY_EVENTS) doc.removeEventListener(event, arm, { capture: true })
    doc.removeEventListener('visibilitychange', onVisibility)
    unsubscribe()
  }
}
