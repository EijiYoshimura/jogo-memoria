import { useEffect, useState } from 'react'
import type { GameConfig } from '../game/types'

interface ResultScreenProps {
  config: GameConfig
  score: number
  totalPairs: number
  timeTaken: number
  onNext: () => void
}

const DEFAULT_ACCENT_COLOR = '#FCFC30'
const CTA_TEXT_COLOR = '#0333BD'

export function ResultScreen({ config, score, totalPairs, onNext }: ResultScreenProps) {
  const isVictory = score === totalPairs
  const accent = config.event.accentColor ?? DEFAULT_ACCENT_COLOR
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
      className="flex flex-col h-full w-full p-8 select-none"
      style={{ backgroundColor: config.event.backgroundColor }}
      onClick={handleTouch}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center gap-12">
        {isVictory ? (
          <>
            <h1
              className="font-bb-titulos font-extrabold uppercase text-[clamp(2.5rem,13vw,7rem)]"
              style={{ color: accent }}
            >
              PARABÉNS!
            </h1>
            <p
              className="font-bb-titulos text-[clamp(1.5rem,7vw,3.75rem)]"
              style={{ color: accent }}
            >
              Você ganhou!
            </p>
            <p className="font-bb-textos text-white text-[clamp(1.1rem,4.5vw,2.25rem)] whitespace-pre-line leading-snug">
              {'Retire seu brinde\nna loja BB Seguros'}
            </p>
          </>
        ) : (
          /*
           * Fallback gracioso: o jogo só chega ao resultado ao completar todos
           * os pares (vitória — timer desativado), então este ramo é defensivo.
           * Mantemos um título neutro, sem prometer brinde indevidamente.
           */
          <h1 className="font-bb-titulos font-extrabold uppercase text-5xl text-white">
            Obrigado por jogar!
          </h1>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          className="rounded-full border-4 border-white font-bb-titulos font-extrabold uppercase text-2xl min-h-[56px] px-10 transition-opacity active:opacity-80"
          style={{ backgroundColor: accent, color: CTA_TEXT_COLOR }}
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
        >
          Próximo participante
        </button>

        <p className="font-bb-textos text-white/70 text-lg">
          Reiniciando em {countdown}s...
        </p>
      </div>
    </div>
  )
}
