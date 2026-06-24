import type { GameSession } from '../entities/GameSession'

export function flipCard(session: GameSession, cardId: string): GameSession {
  if (session.status !== 'playing') return session
  if (session.flippedCards.length >= 2) return session

  const card = session.cards.find((c) => c.id === cardId)
  if (!card || card.state !== 'hidden') return session

  const updatedCards = session.cards.map((c) =>
    c.id === cardId ? { ...c, state: 'flipped' as const } : c
  )

  const newFlipped = [...session.flippedCards, cardId]

  if (newFlipped.length < 2) {
    return { ...session, cards: updatedCards, flippedCards: newFlipped }
  }

  const [firstId, secondId] = newFlipped as [string, string]
  const firstCard = updatedCards.find((c) => c.id === firstId)!
  const secondCard = updatedCards.find((c) => c.id === secondId)!

  const isMatch = firstCard.pairId === secondCard.pairId

  if (isMatch) {
    const matchedCards = updatedCards.map((c) =>
      c.id === firstId || c.id === secondId ? { ...c, state: 'matched' as const } : c
    )
    const newMatchedPairs = session.matchedPairs + 1
    const isWon = newMatchedPairs === session.totalPairs

    return {
      ...session,
      cards: matchedCards,
      flippedCards: [],
      matchedPairs: newMatchedPairs,
      status: isWon ? 'won' : 'playing',
    }
  }

  return {
    ...session,
    cards: updatedCards,
    flippedCards: newFlipped,
  }
}

export function resetFlippedCards(session: GameSession): GameSession {
  const [firstId, secondId] = session.flippedCards as [string, string]
  const resetCards = session.cards.map((c) =>
    c.id === firstId || c.id === secondId ? { ...c, state: 'hidden' as const } : c
  )
  return { ...session, cards: resetCards, flippedCards: [] }
}
