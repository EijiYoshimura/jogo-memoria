import type { Card as CardType } from '../domain/entities/Card'

interface CardProps {
  card: CardType
  cardBack: string
  onClick: (id: string) => void
}

export function Card({ card, cardBack, onClick }: CardProps) {
  const isVisible = card.state !== 'hidden'

  function handleClick() {
    if (card.state === 'hidden') {
      onClick(card.id)
    }
  }

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ perspective: '1000px' }}
      onClick={handleClick}
    >
      <div
        className="relative w-full h-full transition-transform duration-400 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isVisible ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transitionDuration: '400ms',
        }}
      >
        <div
          className="absolute inset-0 rounded-xl overflow-hidden bg-gray-200"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <img
            src={cardBack}
            alt="Verso da carta"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <div
          className="absolute inset-0 rounded-xl overflow-hidden bg-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <img
            src={card.imageUrl}
            alt="Frente da carta"
            className="w-full h-full object-cover"
            draggable={false}
          />
          {card.state === 'matched' && (
            <div className="absolute inset-0 bg-green-400 bg-opacity-40 flex items-center justify-center rounded-xl">
              <span className="text-4xl">✓</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
