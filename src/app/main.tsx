import '../core/ui/tokens.css'
import '../core/ui/components.css'
import './styles/accent.css'
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { LegacyProfile, ProfileLayout, Root } from './components/Layout'
import { SessionProvider } from './session'
import { DoctorReport } from './screens/DoctorReport'
import { Home } from './screens/Home'
import { HowFlagsWork } from './screens/HowFlagsWork'
import { Landing } from './screens/Landing'
import { MarkerDetail } from './screens/MarkerDetail'
import { Overview } from './screens/Overview'
import { ProfileForm } from './screens/ProfileForm'
import { ReadReport } from './screens/ReadReport'
import { ReportForm } from './screens/ReportForm'
import { Reports } from './screens/Reports'
import { Settings } from './screens/Settings'
import { Summaries } from './screens/Summaries'
import { TableView } from './screens/TableView'

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/how-flags-work', element: <HowFlagsWork /> },
      { path: '/app', element: <Home /> },
      { path: '/app/settings', element: <Settings /> },
      { path: '/app/profiles/new', element: <ProfileForm /> },
      {
        path: '/app/p/:profileId',
        element: <ProfileLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'marker/:id', element: <MarkerDetail /> },
          { path: 'table', element: <TableView /> },
          { path: 'reports', element: <Reports /> },
          { path: 'reports/new', element: <ReportForm /> },
          { path: 'reports/read', element: <ReadReport /> },
          { path: 'summaries', element: <Summaries /> },
          { path: 'doctor', element: <DoctorReport /> },
        ],
      },
      { path: '/p/:profileId/*', element: <LegacyProfile /> },
      { path: '/settings', element: <Navigate to="/app/settings" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
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
