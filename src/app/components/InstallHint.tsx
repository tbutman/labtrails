// Invites installing the app. On iPhone this matters for more than convenience: Safari can delete a
// website's stored data after 7 days of use without visiting it, but not an app added to the Home
// Screen (WebKit, March 2020: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).

import { Download, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Callout } from '../../trails-ui/components'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(standalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (prompt)
    return (
      <Callout icon={Download} tone="accent">
        Install LabTrails to open it like an app, even offline.{' '}
        <button
          className="button small"
          onClick={async () => {
            await prompt.prompt()
            setPrompt(null)
          }}
        >
          Install
        </button>
      </Callout>
    )
  if (iOS())
    return (
      <Callout icon={Smartphone} tone="accent">
        <strong>On iPhone, add LabTrails to your Home Screen</strong> (Share, then "Add to Home Screen"). Safari can delete a website's data after
        7 days without a visit; an app on the Home Screen keeps it. Keep a backup either way.
      </Callout>
    )
  return null
}
