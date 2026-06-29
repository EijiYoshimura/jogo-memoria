import { useState, useCallback, useEffect, useRef } from 'react'
import type { GameConfig } from './types'
import type { GameSession } from './domain/entities/GameSession'
import { startGame } from './domain/use-cases/StartGame'
import { beginPlay } from './domain/use-cases/BeginPlay'
import { flipCard, resetFlippedCards } from './domain/use-cases/FlipCard'
import { Board } from './components/Board'
import { Timer } from './components/Timer'
import { PreviewBanner } from './components/PreviewBanner'

interface MemoryGameProps {
  config: GameConfig
  onComplete: (score: number, timeTaken: number) => void
}

const DEFAULT_SHOW_BEFORE = { enabled: false, seconds: 2 } as const
const FALLBACK_PREVIEW_SECONDS = 2

/** Clamp defensivo: `seconds` inválido (≤0 / não-finito) cai no default, evitando
 *  preview infinito ou negativo por config malformada. */
function clampPreviewSeconds(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : FALLBACK_PREVIEW_SECONDS
}

export function MemoryGame({ config, onComplete }: MemoryGameProps) {
  const showBefore = config.game.showBefore ?? DEFAULT_SHOW_BEFORE
  const previewSeconds = clampPreviewSeconds(showBefore.seconds)

  const [session, setSession] = useState<GameSession>(() =>
    startGame(config.game.pairs, config.game.cardImages, config.game.timeLimitSeconds, showBefore.enabled)
  )
  // Ancorado no início do 'playing' (não no mount) para o preview não entrar no timeTaken.
  // No caminho sem preview, o valor do mount já é o correto (joga imediatamente).
  const startTimeRef = useRef<number>(Date.now())
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    if (session.status !== 'preview') return
    const id = setTimeout(() => {
      startTimeRef.current = Date.now()
      setSession((prev) => beginPlay(prev))
    }, previewSeconds * 1000)
    return () => clearTimeout(id)
  }, [session.status, previewSeconds])

  const handleCardClick = useCallback(
    (cardId: string) => {
      if (isLocked || session.status !== 'playing') return

      const next = flipCard(session, cardId)
      setSession(next)

      if (next.status === 'won') {
        const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
        onComplete(next.matchedPairs, timeTaken)
        return
      }

      if (next.flippedCards.length === 2) {
        const firstCard = next.cards.find((c) => c.id === next.flippedCards[0])
        const secondCard = next.cards.find((c) => c.id === next.flippedCards[1])
        const isMatch = firstCard?.pairId === secondCard?.pairId

        if (!isMatch) {
          setIsLocked(true)
          setTimeout(() => {
            setSession((prev) => resetFlippedCards(prev))
            setIsLocked(false)
          }, 1000)
        }
      }
    },
    [session, isLocked, onComplete]
  )

  const handleTick = useCallback((remaining: number) => {
    setSession((prev) => ({ ...prev, timeRemaining: remaining }))
  }, [])

  const handleTimeout = useCallback(() => {
    setSession((prev) => ({ ...prev, status: 'lost' }))
    onComplete(session.matchedPairs, config.game.timeLimitSeconds)
  }, [config.game.timeLimitSeconds, session.matchedPairs, onComplete])

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden rounded-[2.25rem] border-8 border-white px-[4%] pt-[7%] pb-[4%]"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div className="flex flex-col items-center gap-2">
        <img
          src="/images/logo_jogo_memoria.png"
          alt="Jogo da Memória — BB Seguros"
          className="w-3/4 mx-auto object-contain"
          draggable={false}
        />
        {config.game.timerEnabled && session.status === 'playing' && (
          <Timer
            status={session.status}
            timeRemaining={session.timeRemaining}
            onTick={handleTick}
            onTimeout={handleTimeout}
          />
        )}
      </div>
      {/* Espaçadores em razão 3:8 ancoram o grid na faixa ~20%–84% da altura,
          deixando mais respiro abaixo (reservado à indicação de preview / futuro botão COMEÇAR). */}
      <div aria-hidden className="grow-[3]" />
      <div className="w-full" aria-busy={session.status === 'preview'}>
        <Board
          cards={session.cards}
          cardBack={config.game.cardBack}
          onCardClick={handleCardClick}
        />
      </div>
      <div className="grow-[8] flex items-center justify-center">
        <PreviewBanner status={session.status} seconds={previewSeconds} />
      </div>
    </div>
  )
}

export default MemoryGame
