import { ExperienceProvider } from './context/ExperienceContext'
import Home from './pages/Home'

export default function App() {
  return (
    <ExperienceProvider>
      <Home />
    </ExperienceProvider>
  )
}
