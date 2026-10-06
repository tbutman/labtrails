import '@fontsource/quicksand/500.css'
import '@fontsource/quicksand/600.css'
import './styles/tokens.css'
import './styles/accent.css'
import './styles/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { DemoLayout } from './components/Layout'
import { HowFlagsWork } from './screens/HowFlagsWork'
import { MarkerDetail } from './screens/MarkerDetail'
import { Overview } from './screens/Overview'
import { Reports } from './screens/Reports'
import { Summaries } from './screens/Summaries'
import { TableView } from './screens/TableView'
import { Welcome } from './screens/Welcome'

const router = createBrowserRouter([
  { path: '/', element: <Welcome /> },
  { path: '/how-flags-work', element: <HowFlagsWork /> },
  {
    path: '/demo',
    element: <DemoLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'marker/:id', element: <MarkerDetail /> },
      { path: 'table', element: <TableView /> },
      { path: 'reports', element: <Reports /> },
      { path: 'summaries', element: <Summaries /> },
    ],
  },
  { path: '*', element: <Welcome /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
