import { useEffect, useState } from 'react'
import type { GameConfig } from '../game/types'

interface ResultScreenProps {
  config: GameConfig
  score: number
  totalPairs: number
  timeTaken: number
  onNext: () => void
}

export function ResultScreen({ config, score, totalPairs, timeTaken, onNext }: ResultScreenProps) {
  const isVictory = score === totalPairs
  const autoResetSeconds = config.game.autoResetSeconds ?? 30
  const [countdown, setCountdown] = useState(autoResetSeconds)

  useEffect(() => {
    if (countdown <= 0) {
      onNext()
      return
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, onNext])

  function handleTouch() {
    setCountdown(autoResetSeconds)
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full p-8 gap-8 select-none"
      style={{ backgroundColor: config.event.backgroundColor }}
      onClick={handleTouch}
    >
      <div className="text-8xl">{isVictory ? '🏆' : '🎯'}</div>

      {isVictory ? (
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4" style={{ color: config.event.primaryColor }}>
            Parabéns!
          </h1>
          <p className="text-white text-2xl">
            Você encontrou todos os pares em {timeTaken}s!
          </p>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Boa tentativa!</h1>
          <p className="text-gray-300 text-2xl">
            Você encontrou {score} de {totalPairs} pares.
          </p>
        </div>
      )}

      <button
        className="mt-4 rounded-xl font-bold text-white text-xl px-10 py-4 transition-opacity active:opacity-80"
        style={{ backgroundColor: config.event.primaryColor, minHeight: '64px' }}
        onClick={(e) => {
          e.stopPropagation()
          onNext()
        }}
      >
        Próximo participante
      </button>

      <p className="text-gray-400 text-lg">
        Reiniciando em {countdown}s...
      </p>
    </div>
  )
}
