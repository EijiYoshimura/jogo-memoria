import type { Card } from './Card'

export type GameStatus = 'idle' | 'preview' | 'playing' | 'won' | 'lost'

export interface GameSession {
  id: string
  cards: Card[]
  flippedCards: string[]
  matchedPairs: number
  totalPairs: number
  timeRemaining: number
  status: GameStatus
}
