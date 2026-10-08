// The router's error screen (BABY-05): shown instead of React Router's developer page when a screen
// fails. Records live in the encrypted store, so a screen failing never touches them.

import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { AppIcon } from './components'

export function RouteError({ home }: { home: string }) {
  const error = useRouteError()
  useEffect(() => {
    // For whoever is debugging; nothing leaves the browser.
    console.error(error)
  }, [error])
  return (
    <main id="main" className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <AppIcon />
          <h1>Something went wrong</h1>
          <p role="alert">Something went wrong on this screen. Your records are safe.</p>
        </div>
        <p>
          <Link className="button primary block" to={home} reloadDocument>
            Back to the start
          </Link>
        </p>
      </div>
    </main>
  )
}
