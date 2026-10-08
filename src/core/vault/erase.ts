// "Erase this vault" (CORE-01): deletes everything the app keeps in this browser, for someone who
// forgot the passphrase or wants to start again. It needs no passphrase, because it only destroys.
// Backups already downloaded aren't touched. The caller then locks and reloads, for a fresh start.

import { deleteDB } from 'idb'
import { dbName, type Db } from '../store/db'
import type { VaultChannel } from './channel'

const erasedKey = (appId: string) => `${appId}-erased`

export async function eraseEverything({ appId, db, channel }: { appId: string; db: Db; channel?: VaultChannel }): Promise<void> {
  db.close()
  // Other tabs step aside when asked (store/db.ts), so this isn't blocked for long.
  await deleteDB(dbName(appId))
  if (typeof caches !== 'undefined') {
    for (const name of await caches.keys()) await caches.delete(name)
  }
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()
  }
  try {
    localStorage.clear()
    sessionStorage.clear()
    // One flag survives the reload, so the start screen can say it's done.
    sessionStorage.setItem(erasedKey(appId), '1')
  } catch {
    // Storage can be unavailable (private modes); nothing of the vault is kept there.
  }
  channel?.post({ type: 'erased' })
}

/** True once after an erase, for "Everything is deleted from this browser." */
export function takeErasedNotice(appId: string): boolean {
  try {
    const erased = sessionStorage.getItem(erasedKey(appId)) === '1'
    // Cleared after this render, so a double render (React's StrictMode) reads the same answer.
    if (erased) setTimeout(() => sessionStorage.removeItem(erasedKey(appId)), 0)
    return erased
  } catch {
    return false
  }
}
