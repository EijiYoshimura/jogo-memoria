import { describe, it, expect } from 'vitest'
import { startGame } from '../use-cases/StartGame'

describe('startGame', () => {
  it('retorna exatamente pairs * 2 cartas', () => {
    const session = startGame(4, ['a', 'b', 'c', 'd'], 60)
    expect(session.cards).toHaveLength(8)
  })

  it('cada pairId aparece exatamente 2 vezes', () => {
    const pairs = 6
    const images = ['a', 'b', 'c', 'd', 'e', 'f']
    const session = startGame(pairs, images, 60)
    const counts: Record<string, number> = {}
    for (const card of session.cards) {
      counts[card.pairId] = (counts[card.pairId] ?? 0) + 1
    }
    for (const count of Object.values(counts)) {
      expect(count).toBe(2)
    }
    expect(Object.keys(counts)).toHaveLength(pairs)
  })

  it('o embaralhamento ocorre — ao menos uma vez em 10 runs a ordem difere da original', () => {
    const images = ['a', 'b', 'c', 'd', 'e', 'f']
    const original = images.flatMap((_img, i) => [`pair-${i}-a`, `pair-${i}-b`])
    let diffFound = false
    for (let run = 0; run < 10; run++) {
      const session = startGame(6, images, 60)
      const ids = session.cards.map((c) => c.id)
      if (ids.join(',') !== original.join(',')) {
        diffFound = true
        break
      }
    }
    expect(diffFound).toBe(true)
  })

  it('retorna status playing', () => {
    const session = startGame(4, ['a', 'b', 'c', 'd'], 60)
    expect(session.status).toBe('playing')
  })

  it('retorna id único via crypto.randomUUID', () => {
    const s1 = startGame(4, ['a', 'b', 'c', 'd'], 60)
    const s2 = startGame(4, ['a', 'b', 'c', 'd'], 60)
    expect(s1.id).toBeTruthy()
    expect(s1.id).not.toBe(s2.id)
  })

  it('matchedPairs inicia em 0 e totalPairs reflete o argumento', () => {
    const session = startGame(4, ['a', 'b', 'c', 'd'], 60)
    expect(session.matchedPairs).toBe(0)
    expect(session.totalPairs).toBe(4)
  })
})
