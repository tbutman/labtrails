import '@fontsource/quicksand/600.css'
import '@fontsource/quicksand/700.css'
import '../core/ui/tokens.css'
import './styles/accent.css'
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ProfileLayout, Root } from './components/Layout'
import { SessionProvider } from './session'
import { Home } from './screens/Home'
import { DoctorReport } from './screens/DoctorReport'
import { HowFlagsWork } from './screens/HowFlagsWork'
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
  { path: '/', element: <Home /> },
  { path: '/how-flags-work', element: <HowFlagsWork /> },
  { path: '/settings', element: <Settings /> },
  { path: '/profiles/new', element: <ProfileForm /> },
  {
    path: '/p/:profileId',
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
  { path: '*', element: <Home /> },
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
