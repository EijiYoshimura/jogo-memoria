import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Board } from '../Board'
import { Card } from '../Card'
import { MemoryGame } from '../../index'
import type { Card as CardType } from '../../domain/entities/Card'
import type { GameConfig } from '../../types'

function makeCards(count: number): CardType[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    pairId: `pair-${Math.floor(i / 2)}`,
    imageUrl: `/images/card_0${(i % 6) + 1}.png`,
    state: 'hidden' as const,
  }))
}

function makeConfig(timerEnabled?: boolean): GameConfig {
  return {
    event: {
      id: 'e',
      name: 'Evento',
      logo: '/images/logo_bb.png',
      primaryColor: '#7C3AED',
      backgroundColor: '#0333BD',
    },
    game: {
      pairs: 6,
      cardImages: [
        '/images/card_01.png',
        '/images/card_02.png',
        '/images/card_03.png',
        '/images/card_04.png',
        '/images/card_05.png',
        '/images/card_06.png',
      ],
      cardBack: '/images/card_back.png',
      timeLimitSeconds: 60,
      ...(timerEnabled === undefined ? {} : { timerEnabled }),
    },
    leadForm: { title: 't', fields: [] },
    adminPin: '1234',
  }
}

describe('HUB-63 — layout do board', () => {
  it('renderiza 12 cards numa grade de 3 colunas, sem h-full', () => {
    const { container } = render(
      <Board cards={makeCards(12)} cardBack="/images/card_back.png" onCardClick={() => {}} />
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-3')
    expect(grid.className).not.toContain('h-full')
    expect(container.querySelectorAll('.aspect-square')).toHaveLength(12)
  })

  it('card mantem aspecto quadrado (aspect-square na raiz)', () => {
    const card = makeCards(1)[0]
    const { container } = render(
      <Card card={card} cardBack="/images/card_back.png" onClick={() => {}} />
    )
    expect((container.firstElementChild as HTMLElement).className).toContain('aspect-square')
  })

  it('nao recria moldura branca via CSS (sem bg-white nas faces)', () => {
    const card = makeCards(1)[0]
    const { container } = render(
      <Card card={card} cardBack="/images/card_back.png" onClick={() => {}} />
    )
    expect(container.innerHTML).not.toContain('bg-white')
  })

  it('imagens do card usam object-contain (nao recorta a moldura embutida)', () => {
    const card = makeCards(1)[0]
    const { container } = render(
      <Card card={card} cardBack="/images/card_back.png" onClick={() => {}} />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach((img) => {
      expect(img.className).toContain('object-contain')
      expect(img.className).not.toContain('object-cover')
    })
  })

  it('overlay de matched usa a sintaxe nova bg-green-400/40 (nao bg-opacity-40)', () => {
    const card: CardType = { ...makeCards(1)[0], state: 'matched' }
    const { container } = render(
      <Card card={card} cardBack="/images/card_back.png" onClick={() => {}} />
    )
    expect(container.innerHTML).toContain('bg-green-400/40')
    expect(container.innerHTML).not.toContain('bg-opacity-40')
  })

  it('exibe o logo com alt correto e object-contain', () => {
    const { container } = render(<MemoryGame config={makeConfig()} onComplete={() => {}} />)
    const logo = container.querySelector(
      'img[alt="Jogo da Memória — BB Seguros"]'
    ) as HTMLImageElement | null
    expect(logo).not.toBeNull()
    expect(logo!.getAttribute('src')).toBe('/images/logo_jogo_memoria.png')
    expect(logo!.className).toContain('object-contain')
  })

  it('container do jogo nao contem a border de debug e usa a cor do config', () => {
    const { container } = render(<MemoryGame config={makeConfig()} onComplete={() => {}} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toContain('border-blue-500')
    expect(root.style.backgroundColor).toBe('rgb(3, 51, 189)')
  })

  it('com timerEnabled ausente/false o Timer NAO e renderizado (fiel ao mockup)', () => {
    const { container } = render(
      <MemoryGame config={makeConfig(false)} onComplete={() => {}} />
    )
    expect(container.querySelector('.tabular-nums')).toBeNull()
  })

  it('com timerEnabled true o Timer e renderizado no header', () => {
    const { container } = render(
      <MemoryGame config={makeConfig(true)} onComplete={() => {}} />
    )
    expect(container.querySelector('.tabular-nums')).not.toBeNull()
  })
})
