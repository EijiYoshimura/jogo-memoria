export type CardState = 'hidden' | 'flipped' | 'matched'

export interface Card {
  id: string
  pairId: string
  imageUrl: string
  state: CardState
}
