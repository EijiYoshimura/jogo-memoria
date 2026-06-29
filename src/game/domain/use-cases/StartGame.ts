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

export function startGame(
  pairs: number,
  cardImages: string[],
  timeLimitSeconds: number,
  showBefore = false,
): GameSession {
  const initialCardState: Card['state'] = showBefore ? 'flipped' : 'hidden'
  const pairedCards: Card[] = cardImages.slice(0, pairs).flatMap((imageUrl, index) => {
    const pairId = `pair-${index}`
    return [
      { id: `${pairId}-a`, pairId, imageUrl, state: initialCardState },
      { id: `${pairId}-b`, pairId, imageUrl, state: initialCardState },
    ]
  })

  const shuffledCards = fisherYatesShuffle(pairedCards)

  return {
    id: crypto.randomUUID(),
    cards: shuffledCards,
    flippedCards: [],
    matchedPairs: 0,
    totalPairs: pairs,
    timeRemaining: timeLimitSeconds,
    status: showBefore ? 'preview' : 'playing',
  }
}
