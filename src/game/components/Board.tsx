import type { Card as CardType } from '../domain/entities/Card'
import { Card } from './Card'

interface BoardProps {
  cards: CardType[]
  cardBack: string
  onCardClick: (id: string) => void
}

export function Board({ cards, cardBack, onCardClick }: BoardProps) {
  return (
    <div className="grid grid-cols-3 gap-4 w-full">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          cardBack={cardBack}
          onClick={onCardClick}
        />
      ))}
    </div>
  )
}
