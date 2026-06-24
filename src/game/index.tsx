import { useState, useCallback } from 'react'
import type { GameConfig } from './types'
import type { GameSession } from './domain/entities/GameSession'
import { startGame } from './domain/use-cases/StartGame'
import { flipCard, resetFlippedCards } from './domain/use-cases/FlipCard'
import { Board } from './components/Board'
import { Timer } from './components/Timer'

interface MemoryGameProps {
  config: GameConfig
  onComplete: (score: number, timeTaken: number) => void
}

export function MemoryGame({ config, onComplete }: MemoryGameProps) {
  const [session, setSession] = useState<GameSession>(() =>
    startGame(config.game.pairs, config.game.cardImages, config.game.timeLimitSeconds)
  )
  const [startTime] = useState(() => Date.now())
  const [isLocked, setIsLocked] = useState(false)

  const handleCardClick = useCallback(
    (cardId: string) => {
      if (isLocked || session.status !== 'playing') return

      const next = flipCard(session, cardId)
      setSession(next)

      if (next.status === 'won') {
        const timeTaken = Math.round((Date.now() - startTime) / 1000)
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
    [session, isLocked, startTime, onComplete]
  )

  const handleTick = useCallback((remaining: number) => {
    setSession((prev) => ({ ...prev, timeRemaining: remaining }))
  }, [])

  const handleTimeout = useCallback(() => {
    setSession((prev) => ({ ...prev, status: 'lost' }))
    const timeTaken = config.game.timeLimitSeconds
    onComplete(session.matchedPairs, timeTaken)
  }, [config.game.timeLimitSeconds, session.matchedPairs, onComplete])

  return (
    <div
      className="flex flex-col h-full w-full p-4 gap-4"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div className="flex items-center justify-between px-2">
        <div className="text-white text-xl font-semibold">
          Pares: {session.matchedPairs} / {session.totalPairs}
        </div>
        <Timer
          status={session.status}
          timeRemaining={session.timeRemaining}
          onTick={handleTick}
          onTimeout={handleTimeout}
        />
      </div>
      <div className="flex-1 min-h-0">
        <Board
          cards={session.cards}
          cardBack={config.game.cardBack}
          totalPairs={session.totalPairs}
          onCardClick={handleCardClick}
        />
      </div>
    </div>
  )
}

export default MemoryGame
