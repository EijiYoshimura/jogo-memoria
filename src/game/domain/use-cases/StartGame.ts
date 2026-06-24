import type { Card } from '../entities/Card'
import type { GameSession } from '../entities/GameSession'

function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }
  return result
}

export function startGame(pairs: number, cardImages: string[], timeLimitSeconds: number): GameSession {
  const pairedCards: Card[] = cardImages.slice(0, pairs).flatMap((imageUrl, index) => {
    const pairId = `pair-${index}`
    return [
      { id: `${pairId}-a`, pairId, imageUrl, state: 'hidden' as const },
      { id: `${pairId}-b`, pairId, imageUrl, state: 'hidden' as const },
    ]
  })

  const shuffledCards = fisherYatesShuffle(pairedCards)

  return {
    cards: shuffledCards,
    flippedCards: [],
    matchedPairs: 0,
    totalPairs: pairs,
    timeRemaining: timeLimitSeconds,
    status: 'playing',
  }
}
