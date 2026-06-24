import { StrictMode, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, useConfig } from './ConfigLoader'
import { SplashScreen } from './SplashScreen'
import { LeadForm } from './LeadForm'
import { MemoryGame } from '../game/index'
import { ResultScreen } from './ResultScreen'
import { AdminPanel } from './AdminPanel'
import { useLeadPersistence } from './hooks/useLeadPersistence'
import './styles.css'

type AppScreen = 'splash' | 'lead-form' | 'game' | 'result' | 'admin'

interface GameResult {
  score: number
  timeTaken: number
}

function App() {
  const config = useConfig()
  const { saveLead } = useLeadPersistence()

  const [screen, setScreen] = useState<AppScreen>('splash')
  const [leadData, setLeadData] = useState<Record<string, string>>({})
  const [gameResult, setGameResult] = useState<GameResult>({ score: 0, timeTaken: 0 })
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('splash')

  const handleStart = useCallback(() => {
    setScreen('lead-form')
  }, [])

  const handleAdminAccess = useCallback(() => {
    setPreviousScreen(screen)
    setScreen('admin')
  }, [screen])

  const handleLeadSubmit = useCallback((formData: Record<string, string>) => {
    setLeadData(formData)
    setScreen('game')
  }, [])

  const handleGameComplete = useCallback(
    async (score: number, timeTaken: number) => {
      setGameResult({ score, timeTaken })
      await saveLead({
        eventId: config.event.id,
        formData: leadData,
        score,
        timeTaken,
      })
      setScreen('result')
    },
    [config.event.id, leadData, saveLead]
  )

  const handleNext = useCallback(() => {
    setLeadData({})
    setGameResult({ score: 0, timeTaken: 0 })
    setScreen('splash')
  }, [])

  const handleAdminClose = useCallback(() => {
    setScreen(previousScreen === 'admin' ? 'splash' : previousScreen)
  }, [previousScreen])

  return (
    <div className="w-full h-full">
      {screen === 'splash' && (
        <SplashScreen
          config={config}
          onStart={handleStart}
          onAdminAccess={handleAdminAccess}
        />
      )}
      {screen === 'lead-form' && (
        <LeadForm config={config} onSubmit={handleLeadSubmit} />
      )}
      {screen === 'game' && (
        <MemoryGame config={config} onComplete={handleGameComplete} />
      )}
      {screen === 'result' && (
        <ResultScreen
          config={config}
          score={gameResult.score}
          totalPairs={config.game.pairs}
          timeTaken={gameResult.timeTaken}
          onNext={handleNext}
        />
      )}
      {screen === 'admin' && (
        <AdminPanel config={config} onClose={handleAdminClose} />
      )}
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </StrictMode>
)
