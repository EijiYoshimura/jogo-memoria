import type { GameSession } from '../entities/GameSession'

/**
 * Encerra a fase de preview ("show before", HUB-76): vira todas as cartas para
 * o verso e libera o jogo (`status: 'playing'`).
 *
 * Idempotente / no-op fora de `'preview'`: se a sessão não estiver em preview,
 * retorna a própria sessão inalterada — protege contra disparo duplicado do
 * timer da apresentação (StrictMode / efeito reexecutado).
 */
export function beginPlay(session: GameSession): GameSession {
  if (session.status !== 'preview') return session

  const hiddenCards = session.cards.map((card) =>
    card.state === 'flipped' ? { ...card, state: 'hidden' as const } : card,
  )

  return { ...session, cards: hiddenCards, status: 'playing' }
}
