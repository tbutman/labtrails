// Tells the user when a new version of the app has been downloaded, and switches to it only when
// they tap Reload. Without this, a new version waits until every tab (or the installed app) is
// closed, so fixes can take a long time to arrive. It never reloads by itself: a reload drops
// whatever the user is typing and locks the vault.
//
// Needs vite-plugin-pwa with registerType 'prompt' and injectRegister false (see vite.config.ts).

import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

const CHECK_EVERY_MS = 30 * 60_000

export function UpdatePrompt({ appName, locksVault }: { appName: string; locksVault: boolean }) {
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let timer: ReturnType<typeof setInterval> | undefined
    let registration: ServiceWorkerRegistration | undefined
    // Installed apps can stay open for days, so look for updates now and then, and on return.
    const check = () => void registration?.update().catch(() => undefined)
    const onVisible = () => document.visibilityState === 'visible' && check()
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => updateSW),
      onRegisteredSW: (_url, reg) => {
        registration = reg
        timer = setInterval(check, CHECK_EVERY_MS)
      },
    })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!update) return null
  return (
    <div className="update-banner" role="status">
      <span>
        A new version of {appName} is ready.{locksVault ? ' Reloading locks your vault; your records are kept.' : ''}
      </span>
      <button
        type="button"
        className="button small"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void update(true)
        }}
      >
        {busy ? 'Reloading…' : 'Reload'}
      </button>
    </div>
  )
}
