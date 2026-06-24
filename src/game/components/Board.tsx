import type { Card as CardType } from '../domain/entities/Card'
import { Card } from './Card'

interface BoardProps {
  cards: CardType[]
  cardBack: string
  totalPairs: number
  onCardClick: (id: string) => void
}

function getGridColumns(pairs: number): number {
  if (pairs <= 3) return 3
  if (pairs <= 6) return 4
  return 6
}

export function Board({ cards, cardBack, totalPairs, onCardClick }: BoardProps) {
  const columns = getGridColumns(totalPairs)

  return (
    <div
      className="grid gap-3 w-full h-full"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
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
