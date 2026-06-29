import { describe, it, expect } from 'vitest'
import { beginPlay } from '../use-cases/BeginPlay'
import { startGame } from '../use-cases/StartGame'
import type { GameSession } from '../entities/GameSession'

describe('beginPlay', () => {
  it('em preview: vira todas as cartas para hidden e seta status playing', () => {
    const preview = startGame(4, ['a', 'b', 'c', 'd'], 60, true)
    const playing = beginPlay(preview)

    expect(playing.status).toBe('playing')
    expect(playing.cards.every((c) => c.state === 'hidden')).toBe(true)
  })

  it('preserva a ordem e a identidade das cartas (apenas o estado muda)', () => {
    const preview = startGame(4, ['a', 'b', 'c', 'd'], 60, true)
    const playing = beginPlay(preview)

    expect(playing.cards.map((c) => c.id)).toEqual(preview.cards.map((c) => c.id))
    expect(playing.timeRemaining).toBe(preview.timeRemaining)
    expect(playing.totalPairs).toBe(preview.totalPairs)
  })

  it('é idempotente / no-op fora de preview: status playing retorna a mesma sessão', () => {
    const playing = startGame(4, ['a', 'b', 'c', 'd'], 60, false)
    expect(beginPlay(playing)).toBe(playing)
  })

  it('não reabre cartas já matched ao encerrar o preview', () => {
    const preview = startGame(2, ['a', 'b'], 60, true)
    const withMatched: GameSession = {
      ...preview,
      cards: preview.cards.map((c, i) =>
        i === 0 ? { ...c, state: 'matched' as const } : c
      ),
    }

    const playing = beginPlay(withMatched)

    expect(playing.cards[0]!.state).toBe('matched')
    expect(playing.cards.slice(1).every((c) => c.state === 'hidden')).toBe(true)
  })
})
