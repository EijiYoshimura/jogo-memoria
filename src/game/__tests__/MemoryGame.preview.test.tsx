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
})
