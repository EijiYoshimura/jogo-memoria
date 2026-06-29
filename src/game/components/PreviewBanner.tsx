import { useEffect, useState } from 'react'
import type { GameStatus } from '../domain/entities/GameSession'

const PREVIEW_ANNOUNCEMENT = 'Memorize as cartas. Aguarde, o jogo vai começar.'
const PLAYING_ANNOUNCEMENT = 'O jogo começou. Pode jogar.'
const COUNTDOWN_COLOR = '#FCFC30'

interface PreviewBannerProps {
  status: GameStatus
  seconds: number
}

/**
 * Indicação da fase de preview "show before" (HUB-76), na faixa inferior do board.
 * Mostra o rótulo "Memorize as cartas" e um contador regressivo (1x/s) apenas
 * enquanto `status === 'preview'`. A região `role="status"` / `aria-live="polite"`
 * anuncia a fase ao leitor de tela e a liberação do jogo na transição para 'playing'.
 * O contador é visual (aria-hidden) para não gerar anúncio a cada segundo.
 */
export function PreviewBanner({ status, seconds }: PreviewBannerProps) {
  const isPreview = status === 'preview'
  const [remainingSeconds, setRemainingSeconds] = useState(seconds)

  useEffect(() => {
    if (!isPreview) return
    setRemainingSeconds(seconds)
    const id = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [isPreview, seconds])

  const announcement = isPreview ? PREVIEW_ANNOUNCEMENT : PLAYING_ANNOUNCEMENT

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3"
    >
      <span className="sr-only">{announcement}</span>
      {isPreview && (
        <div aria-hidden="true" className="flex flex-col items-center gap-3">
          <span className="font-bb-titulos text-4xl font-bold text-white">
            Memorize as cartas
          </span>
          <span
            className="font-bb-titulos text-6xl font-bold tabular-nums"
            style={{ color: COUNTDOWN_COLOR }}
          >
            {remainingSeconds}
          </span>
        </div>
      )}
    </div>
  )
}
