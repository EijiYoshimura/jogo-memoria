import { useState, useCallback } from 'react'
import { useConfig } from './ConfigLoader'
import { SplashScreen } from './SplashScreen'
import { LeadForm } from './LeadForm'
import { MemoryGame } from '../game/index'
import { ResultScreen } from './ResultScreen'
import { AdminPanel } from './AdminPanel'
import { useLeadPersistence } from './hooks/useLeadPersistence'
import { DEFAULT_CONSENT_VERSION } from './lib/lgpd'

type AppScreen = 'splash' | 'lead-form' | 'game' | 'result' | 'admin'

interface GameResult {
  score: number
  timeTaken: number
}

export function App() {
  const config = useConfig()
  const { saveLead } = useLeadPersistence()

  const [screen, setScreen] = useState<AppScreen>('splash')
  const [leadData, setLeadData] = useState<Record<string, string>>({})
  const [gameResult, setGameResult] = useState<GameResult>({ score: 0, timeTaken: 0 })
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('splash')
  const [consentedAt, setConsentedAt] = useState<string>('')

  const handleStart = useCallback(() => {
    setScreen('lead-form')
  }, [])

  const handleAdminAccess = useCallback(() => {
    setPreviousScreen(screen)
    setScreen('admin')
  }, [screen])

  // O gating do LeadForm garante que o submit só ocorre com consentimento;
  // o instante do submit é o instante do consentimento.
  const handleLeadSubmit = useCallback((formData: Record<string, string>) => {
    setLeadData(formData)
    setConsentedAt(new Date().toISOString())
    setScreen('game')
  }, [])

  const handleGameComplete = useCallback(
    async (score: number, timeTaken: number) => {
      setGameResult({ score, timeTaken })

      const consentVersion = config.lgpd?.consentVersion ?? DEFAULT_CONSENT_VERSION
      await saveLead({
        eventId: config.event.id,
        formData: leadData,
        score,
        timeTaken,
        consentedAt,
        consentVersion,
      })

      setScreen('result')
    },
    [config.event.id, config.lgpd?.consentVersion, consentedAt, leadData, saveLead]
  )

  const handleNext = useCallback(() => {
    setLeadData({})
    setGameResult({ score: 0, timeTaken: 0 })
    setConsentedAt('')
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
