import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { MemoryGame } from '../index'
import type { GameConfig } from '../types'

interface ShowBeforeOption {
  enabled: boolean
  seconds: number
}

function makeConfig(options?: {
  showBefore?: ShowBeforeOption
  timerEnabled?: boolean
}): GameConfig {
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
      ...(options?.timerEnabled === undefined ? {} : { timerEnabled: options.timerEnabled }),
      ...(options?.showBefore === undefined ? {} : { showBefore: options.showBefore }),
    },
    leadForm: { title: 't', fields: [] },
    adminPin: '1234',
  }
}

/** Conta cartas com a face para cima (inner flip div com rotateY(180deg)). */
function faceUpCount(container: HTMLElement): number {
  const inners = container.querySelectorAll<HTMLElement>('.cursor-pointer > div')
  return Array.from(inners).filter((d) => d.style.transform === 'rotateY(180deg)').length
}

/** Vence o jogo clicando cada par (identificado pela imagem da face frontal). */
function winGame(container: HTMLElement): void {
  const cardRoots = Array.from(container.querySelectorAll<HTMLElement>('.cursor-pointer'))
  const cardsByImage = new Map<string, HTMLElement[]>()
  for (const root of cardRoots) {
    const front = root.querySelector<HTMLImageElement>('img[alt="Frente da carta"]')!
    const src = front.getAttribute('src')!
    const group = cardsByImage.get(src) ?? []
    group.push(root)
    cardsByImage.set(src, group)
  }
  for (const [, pair] of cardsByImage) {
    fireEvent.click(pair[0]!)
    fireEvent.click(pair[1]!)
  }
}

describe('HUB-76 — preview "show before" (MemoryGame)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('com showBefore.enabled entra em preview: todas as cartas viradas e banner visível', () => {
    const { container, getByText } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })} onComplete={() => {}} />
    )

    expect(faceUpCount(container)).toBe(12)
    expect(getByText('Memorize as cartas')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('exibe o contador regressivo derivado de seconds durante o preview', () => {
    const { container } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })} onComplete={() => {}} />
    )

    const countdown = container.querySelector('.tabular-nums')
    expect(countdown).not.toBeNull()
    expect(countdown!.textContent).toBe('2')
  })

  it('o Timer fica oculto durante o preview mesmo com timerEnabled', () => {
    const { container } = render(
      <MemoryGame
        config={makeConfig({ showBefore: { enabled: true, seconds: 2 }, timerEnabled: true })}
        onComplete={() => {}}
      />
    )

    // Em preview, o único tabular-nums é o contador (60s do Timer mostraria "01:00").
    expect(container.textContent).not.toContain('01:00')
  })

  it('após seconds o preview libera o jogo: cartas viram para o verso e banner some', () => {
    const { container, queryByText } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })} onComplete={() => {}} />
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(faceUpCount(container)).toBe(0)
    expect(queryByText('Memorize as cartas')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('toque é bloqueado durante o preview (não progride o jogo)', () => {
    const { container, getByText } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })} onComplete={() => {}} />
    )

    const firstCard = container.querySelector<HTMLElement>('.cursor-pointer')
    expect(firstCard).not.toBeNull()
    fireEvent.click(firstCard!)

    // Continua em preview: banner presente e cartas ainda viradas.
    expect(getByText('Memorize as cartas')).toBeTruthy()
    expect(faceUpCount(container)).toBe(12)
  })

  it('o Timer aparece após a liberação do jogo quando timerEnabled', () => {
    const { container } = render(
      <MemoryGame
        config={makeConfig({ showBefore: { enabled: true, seconds: 2 }, timerEnabled: true })}
        onComplete={() => {}}
      />
    )

    expect(container.textContent).not.toContain('01:00')

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(container.textContent).toContain('01:00')
  })

  it('com enabled=false inicia direto jogável: sem banner, cartas no verso, toque flipa', () => {
    const { container, queryByText } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: false, seconds: 2 } })} onComplete={() => {}} />
    )

    expect(queryByText('Memorize as cartas')).toBeNull()
    expect(faceUpCount(container)).toBe(0)
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()

    const firstCard = container.querySelector<HTMLElement>('.cursor-pointer')
    fireEvent.click(firstCard!)
    expect(faceUpCount(container)).toBe(1)
  })

  it('sem o bloco showBefore aplica fallback seguro (sem preview, jogável)', () => {
    const { container, queryByText } = render(
      <MemoryGame config={makeConfig()} onComplete={() => {}} />
    )

    expect(queryByText('Memorize as cartas')).toBeNull()
    expect(faceUpCount(container)).toBe(0)
  })

  it('limpa o setTimeout do preview ao desmontar (sem vazar timer)', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })} onComplete={() => {}} />
    )

    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('CA4 — seconds=4 respeita a duração configurada (não fixa em 2s)', () => {
    const { container, getByText, queryByText } = render(
      <MemoryGame
        config={makeConfig({ showBefore: { enabled: true, seconds: 4 }, timerEnabled: true })}
        onComplete={() => {}}
      />
    )

    // O contador inicia em 4 (deriva de seconds), não em 2.
    expect(container.querySelector('.tabular-nums')!.textContent).toBe('4')

    // Aos 2s ainda em preview: cartas viradas, banner presente, Timer oculto.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(faceUpCount(container)).toBe(12)
    expect(getByText('Memorize as cartas')).toBeTruthy()
    expect(container.textContent).not.toContain('01:00')

    // Só após 4s totais libera o jogo.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(faceUpCount(container)).toBe(0)
    expect(queryByText('Memorize as cartas')).toBeNull()
    expect(container.textContent).toContain('01:00')
  })

  it.each([
    { label: 'zero', seconds: 0 },
    { label: 'NaN', seconds: Number.NaN },
    { label: 'negativo', seconds: -3 },
  ])('CA5 — seconds inválido ($label) cai no fallback de 2s', ({ seconds }) => {
    const { container, queryByText } = render(
      <MemoryGame config={makeConfig({ showBefore: { enabled: true, seconds } })} onComplete={() => {}} />
    )

    // Clamp: o contador exibe o fallback 2, não o valor inválido.
    expect(container.querySelector('.tabular-nums')!.textContent).toBe('2')
    expect(faceUpCount(container)).toBe(12)

    // Libera após os 2s do fallback (não fica preso em preview infinito/negativo).
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(faceUpCount(container)).toBe(0)
    expect(queryByText('Memorize as cartas')).toBeNull()
  })

  it('timeTaken reportado não inclui os segundos de preview', () => {
    const onComplete = vi.fn()
    const { container } = render(
      <MemoryGame
        config={makeConfig({ showBefore: { enabled: true, seconds: 2 } })}
        onComplete={onComplete}
      />
    )

    // Encerra o preview (2s); a partir daqui é que o cronômetro do jogo começa.
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Passam 3s de jogo efetivo antes de concluir todos os pares.
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    winGame(container)

    expect(onComplete).toHaveBeenCalledTimes(1)
    const [score, timeTaken] = onComplete.mock.calls[0]!
    expect(score).toBe(6)
    // Só os 3s de jogo — os 2s de preview ficam de fora (senão seriam 5).
    expect(timeTaken).toBe(3)
  })
})
