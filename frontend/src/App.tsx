import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout'
import CrawlerPage from './pages/CrawlerPage'
import DashboardPage from './pages/DashboardPage'
import JourneysPage from './pages/JourneysPage'
import NetworkPage from './pages/NetworkPage'
import PlannerPage from './pages/PlannerPage'
import SourcesPage from './pages/SourcesPage'
import { Loading } from './components/Ui'

const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="plan" element={<PlannerPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="crawler" element={<CrawlerPage />} />
        <Route path="analytics" element={<Suspense fallback={<Loading label="Loading analytics engine…" />}><AnalyticsPage /></Suspense>} />
        <Route path="journeys" element={<JourneysPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
