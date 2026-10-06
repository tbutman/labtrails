// Keyboard and screen-reader help for single-page apps, shared by the Trails apps (from LabTrails,
// coordination request 16): a "Skip to content" link, and on every screen change the tab's title names
// the screen and focus moves to its heading, so screen readers announce the new page instead of
// staying on the link that was used. Render both once, in the router's root.

import { useEffect, useRef, type MouseEvent } from 'react'
import { useLocation } from 'react-router'

const mainOf = () => document.querySelector<HTMLElement>('main')

function focusWithin(el: HTMLElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

/** The first thing a keyboard user reaches: jumps past the navigation to the page itself. */
export function SkipLink() {
  function skip(e: MouseEvent) {
    e.preventDefault()
    const main = mainOf()
    if (main) focusWithin(main)
  }
  return (
    <a className="skip-link" href="#main" onClick={skip}>
      Skip to content
    </a>
  )
}

/**
 * After moving to another screen: "<heading> · <app>" as the tab's title, and focus on the heading.
 * Not on the first load, where the browser already starts at the top. The home page keeps the
 * document's own title.
 */
export function PageChange({ appName, home = '/' }: { appName: string; home?: string }) {
  const { pathname } = useLocation()
  const first = useRef(true)
  const baseTitle = useRef(document.title)
  useEffect(() => {
    const initial = first.current
    first.current = false
    // Screens that load their data or code show a placeholder first; wait for the real heading.
    let tries = 0
    const timer = window.setInterval(() => {
      const heading = mainOf()?.querySelector<HTMLElement>('h1')
      if (!heading && ++tries < 40) return
      window.clearInterval(timer)
      const name = heading?.textContent?.trim()
      document.title = pathname === home || !name ? baseTitle.current : `${name} · ${appName}`
      if (initial) return
      const target = heading ?? mainOf()
      if (target) focusWithin(target)
    }, 50)
    return () => window.clearInterval(timer)
  }, [pathname, appName, home])
  return null
}
