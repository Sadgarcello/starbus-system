import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import OverviewPage from './pages/OverviewPage'
import ComponentsPage from './pages/ComponentsPage'
import CircuitsPage from './pages/CircuitsPage'
import TestingPage from './pages/TestingPage'
import ProblemsPage from './pages/ProblemsPage'
import TimelinePage from './pages/TimelinePage'
import NotesPage from './pages/NotesPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="components" element={<ComponentsPage />} />
        <Route path="circuits" element={<CircuitsPage />} />
        <Route path="testing" element={<TestingPage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="notes" element={<NotesPage />} />
      </Route>
    </Routes>
  )
}
