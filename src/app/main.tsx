import '../core/ui/tokens.css'
import '../core/ui/components.css'
import './styles/accent.css'
import './styles/app.css'

import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, type LazyRouteFunction, type RouteObject } from 'react-router'
import { LegacyProfile, ProfileLayout, Root } from './components/Layout'
import { SessionProvider } from './session'
import { Landing } from './screens/Landing'

// The landing page loads first and alone; each screen of the app is fetched when it's first opened
// (and precached by the service worker, so it works offline once the app has been visited).
const screen =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): LazyRouteFunction<RouteObject> =>
  async () => ({ Component: (await load())[name] as ComponentType })

/** Shown instead of a screen that fails, in place of the router's developer page (BABY-05). */
function ScreenError() {
  return (
    <main id="main" className="container narrow">
      <h1>Something went wrong on this screen.</h1>
      <p>Your records are safe.</p>
      <p>
        <a className="button primary" href="/app">
          Back to the start
        </a>
      </p>
    </main>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <ScreenError />,
    children: [
      {
        // A failing screen shows the message inside the app's frame.
        errorElement: <ScreenError />,
        children: [
          { path: '/', element: <Landing /> },
          { path: '/how-flags-work', lazy: screen(() => import('./screens/HowFlagsWork'), 'HowFlagsWork') },
          { path: '/app', lazy: screen(() => import('./screens/Home'), 'Home') },
          { path: '/app/settings', lazy: screen(() => import('./screens/Settings'), 'Settings') },
          { path: '/app/profiles/new', lazy: screen(() => import('./screens/ProfileForm'), 'ProfileForm') },
          { path: '/app/profiles/:profileId', lazy: screen(() => import('./screens/ProfileForm'), 'ProfileForm') },
          {
            path: '/app/p/:profileId',
            element: <ProfileLayout />,
            children: [
              { index: true, lazy: screen(() => import('./screens/Overview'), 'Overview') },
              { path: 'marker/:id', lazy: screen(() => import('./screens/MarkerDetail'), 'MarkerDetail') },
              { path: 'table', lazy: screen(() => import('./screens/TableView'), 'TableView') },
              { path: 'reports', lazy: screen(() => import('./screens/Reports'), 'Reports') },
              { path: 'reports/new', lazy: screen(() => import('./screens/ReportForm'), 'ReportForm') },
              { path: 'reports/read', lazy: screen(() => import('./screens/ImportReports'), 'ImportReports') },
              { path: 'reports/:reportId/edit', lazy: screen(() => import('./screens/ReportEdit'), 'ReportEdit') },
              { path: 'reports/:reportId/results/new', lazy: screen(() => import('./screens/ResultEdit'), 'ResultEdit') },
              { path: 'reports/:reportId/results/:resultId', lazy: screen(() => import('./screens/ResultEdit'), 'ResultEdit') },
              { path: 'next-test', lazy: screen(() => import('./screens/NextTest'), 'NextTest') },
              { path: 'timeline', lazy: screen(() => import('./screens/Timeline'), 'Timeline') },
              { path: 'timeline/new', lazy: screen(() => import('./screens/Timeline'), 'TimelineEdit') },
              { path: 'timeline/:entryId', lazy: screen(() => import('./screens/Timeline'), 'TimelineEdit') },
              { path: 'summaries', lazy: screen(() => import('./screens/Summaries'), 'Summaries') },
              { path: 'ask', lazy: screen(() => import('./screens/Ask'), 'Ask') },
              { path: 'doctor', lazy: screen(() => import('./screens/DoctorReport'), 'DoctorReport') },
            ],
          },
          { path: '/p/:profileId/*', element: <LegacyProfile /> },
          { path: '/settings', element: <Navigate to="/app/settings" replace /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
)
