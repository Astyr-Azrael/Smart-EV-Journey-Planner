import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import JourneyDetailPage from './pages/JourneyDetailPage'
import JourneysPage from './pages/JourneysPage'
import NetworkPage from './pages/NetworkPage'
import PlannerPage from './pages/PlannerPage'
import SourcesPage from './pages/SourcesPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="plan" element={<PlannerPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="journeys" element={<JourneysPage />} />
        <Route path="journeys/:journeyId" element={<JourneyDetailPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
