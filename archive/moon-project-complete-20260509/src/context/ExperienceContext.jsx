import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { STARS_TO_UNLOCK_FINAL, memories } from '../data/memories'

const ExperienceContext = createContext(null)

export function ExperienceProvider({ children }) {
  const [entered, setEntered] = useState(false)
  const [activeMemoryId, setActiveMemoryId] = useState(null)
  const [openedIds, setOpenedIds] = useState(() => new Set())
  const [finalApologyOpen, setFinalApologyOpen] = useState(false)
  const [secretOpen, setSecretOpen] = useState(false)
  const [moonClicks, setMoonClicks] = useState(0)
  const [muted, setMuted] = useState(false)
  const [hoverLabel, setHoverLabel] = useState(null)
  const [finaleMode, setFinaleMode] = useState(false)
  const [cameraHome, setCameraHome] = useState(true)

  const regularOpenedCount = useMemo(() => {
    let n = 0
    for (const id of openedIds) {
      if (id !== 'final') n += 1
    }
    return n
  }, [openedIds])

  const finalUnlocked = regularOpenedCount >= STARS_TO_UNLOCK_FINAL

  const activeMemory = useMemo(
    () => memories.find((m) => m.id === activeMemoryId) ?? null,
    [activeMemoryId],
  )

  const markOpened = useCallback((id) => {
    setOpenedIds((prev) => new Set(prev).add(id))
  }, [])

  const openMemory = useCallback(
    (id) => {
      const m = memories.find((x) => x.id === id)
      if (!m) return
      if (m.hiddenUntilUnlocked && !finalUnlocked && id === 'final') return
      if (id === 'final') {
        setFinaleMode(true)
        setFinalApologyOpen(true)
        markOpened('final')
        setActiveMemoryId(null)
        setCameraHome(true)
        return
      }
      setCameraHome(false)
      setActiveMemoryId(id)
      markOpened(id)
    },
    [finalUnlocked, markOpened],
  )

  const closeMemory = useCallback(() => {
    setActiveMemoryId(null)
    setCameraHome(true)
  }, [])

  const onMoonClick = useCallback(() => {
    setMoonClicks((c) => {
      const next = c + 1
      if (next >= 5) setSecretOpen(true)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      entered,
      setEntered,
      activeMemoryId,
      activeMemory,
      openMemory,
      closeMemory,
      openedIds,
      regularOpenedCount,
      finalUnlocked,
      finalApologyOpen,
      setFinalApologyOpen,
      secretOpen,
      setSecretOpen,
      moonClicks,
      muted,
      setMuted,
      hoverLabel,
      setHoverLabel,
      finaleMode,
      cameraHome,
      setCameraHome,
      onMoonClick,
      STARS_TO_UNLOCK_FINAL,
    }),
    [
      entered,
      activeMemoryId,
      activeMemory,
      openMemory,
      closeMemory,
      openedIds,
      regularOpenedCount,
      finalUnlocked,
      finalApologyOpen,
      secretOpen,
      moonClicks,
      muted,
      hoverLabel,
      finaleMode,
      cameraHome,
      onMoonClick,
    ],
  )

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  )
}

// Fast refresh: hooks colocated with provider is intentional here.
// eslint-disable-next-line react-refresh/only-export-components
export function useExperience() {
  const ctx = useContext(ExperienceContext)
  if (!ctx) throw new Error('useExperience must be used inside ExperienceProvider')
  return ctx
}
