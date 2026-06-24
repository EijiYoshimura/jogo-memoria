import { describe, it, expect } from 'vitest'
import { startGame } from '../use-cases/StartGame'
import { flipCard, resetFlippedCards } from '../use-cases/FlipCard'
import type { GameSession } from '../entities/GameSession'

function freshSession(pairs = 2): GameSession {
  const images = Array.from({ length: pairs }, (_, i) => `img-${i}`)
  return startGame(pairs, images, 60)
}

function getCardIdByPairAndSlot(session: GameSession, pairIndex: number, slot: 'a' | 'b'): string {
  const id = `pair-${pairIndex}-${slot}`
  const card = session.cards.find((c) => c.id === id)
  if (!card) throw new Error(`Card ${id} not found`)
  return card.id
}

describe('flipCard', () => {
  it('virar uma carta muda seu estado para flipped', () => {
    const session = freshSession()
    const cardId = getCardIdByPairAndSlot(session, 0, 'a')
    const next = flipCard(session, cardId)
    const card = next.cards.find((c) => c.id === cardId)!
    expect(card.state).toBe('flipped')
  })

  it('virar uma segunda carta diferente mantém ambas flipped', () => {
    const session = freshSession()
    const firstId = getCardIdByPairAndSlot(session, 0, 'a')
    const secondId = getCardIdByPairAndSlot(session, 1, 'a')
    const after1 = flipCard(session, firstId)
    const after2 = flipCard(after1, secondId)
    expect(after2.cards.find((c) => c.id === firstId)!.state).toBe('flipped')
    expect(after2.cards.find((c) => c.id === secondId)!.state).toBe('flipped')
    expect(after2.flippedCards).toHaveLength(2)
  })

  it('virar uma terceira carta enquanto há 2 flipped sem match é ignorado', () => {
    const session = freshSession(3)
    const first = getCardIdByPairAndSlot(session, 0, 'a')
    const second = getCardIdByPairAndSlot(session, 1, 'a')
    const third = getCardIdByPairAndSlot(session, 2, 'a')
    const s1 = flipCard(session, first)
    const s2 = flipCard(s1, second)
    const s3 = flipCard(s2, third)
    expect(s3).toStrictEqual(s2)
  })

  it('virar uma carta já matched é ignorado', () => {
    const session = freshSession()
    const cardA = getCardIdByPairAndSlot(session, 0, 'a')
    const cardB = getCardIdByPairAndSlot(session, 0, 'b')
    const s1 = flipCard(session, cardA)
    const s2 = flipCard(s1, cardB)
    expect(s2.cards.find((c) => c.id === cardA)!.state).toBe('matched')
    const s3 = flipCard(s2, cardA)
    expect(s3).toStrictEqual(s2)
  })

  it('2 cartas do mesmo pairId → ambas matched, matchedPairs incrementa', () => {
    const session = freshSession()
    const cardA = getCardIdByPairAndSlot(session, 0, 'a')
    const cardB = getCardIdByPairAndSlot(session, 0, 'b')
    const s1 = flipCard(session, cardA)
    const s2 = flipCard(s1, cardB)
    expect(s2.cards.find((c) => c.id === cardA)!.state).toBe('matched')
    expect(s2.cards.find((c) => c.id === cardB)!.state).toBe('matched')
    expect(s2.matchedPairs).toBe(1)
    expect(s2.flippedCards).toHaveLength(0)
  })

  it('quando matchedPairs === totalPairs → status vira won', () => {
    const session = freshSession(1)
    const cardA = getCardIdByPairAndSlot(session, 0, 'a')
    const cardB = getCardIdByPairAndSlot(session, 0, 'b')
    const s1 = flipCard(session, cardA)
    const s2 = flipCard(s1, cardB)
    expect(s2.status).toBe('won')
  })
})

describe('resetFlippedCards', () => {
  it('reseta cartas flipped de volta para hidden', () => {
    const session = freshSession(2)
    const first = getCardIdByPairAndSlot(session, 0, 'a')
    const second = getCardIdByPairAndSlot(session, 1, 'a')
    const s1 = flipCard(session, first)
    const s2 = flipCard(s1, second)
    expect(s2.flippedCards).toHaveLength(2)
    const s3 = resetFlippedCards(s2)
    expect(s3.flippedCards).toHaveLength(0)
    expect(s3.cards.find((c) => c.id === first)!.state).toBe('hidden')
    expect(s3.cards.find((c) => c.id === second)!.state).toBe('hidden')
  })

  it('não afeta cartas matched durante o reset', () => {
    const session = freshSession(2)
    const matchA = getCardIdByPairAndSlot(session, 0, 'a')
    const matchB = getCardIdByPairAndSlot(session, 0, 'b')
    const flipA = getCardIdByPairAndSlot(session, 1, 'a')
    const flipB = getCardIdByPairAndSlot(session, 1, 'b')

    const s1 = flipCard(session, matchA)
    const s2 = flipCard(s1, matchB)
    const s3 = flipCard(s2, flipA)
    // Flip flipB que não é do mesmo par que flipA — mas aqui ambos são do par 1
    // Usamos um par diferente para simular no-match: apenas checamos o reset
    const s4 = flipCard(s3, flipB)
    // flipA e flipB são do mesmo par, logo ficam matched — testa reset em sessão sem flipped
    expect(s4.flippedCards).toHaveLength(0)

    // Simular manualmente uma sessão com matched + flipped
    const sessionWithBoth: GameSession = {
      ...s4,
      flippedCards: [matchA, matchB],
      cards: s4.cards.map((c) =>
        c.id === matchA || c.id === matchB
          ? { ...c, state: 'flipped' as const }
          : c
      ),
    }
    const reset = resetFlippedCards(sessionWithBoth)
    expect(reset.flippedCards).toHaveLength(0)
    // As outras cartas (pair-1) continuam matched
    expect(reset.cards.find((c) => c.id === flipA)!.state).toBe('matched')
    expect(reset.cards.find((c) => c.id === flipB)!.state).toBe('matched')
  })
})
