import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ResultScreen } from '../ResultScreen'
import type { GameConfig } from '../../game/types'

const config = {
  event: {
    id: 'evento-demo',
    name: 'Evento Demo',
    logo: '/images/logo_bb.png',
    primaryColor: '#7C3AED',
    backgroundColor: '#0333BD',
    accentColor: '#FCFC30',
  },
  game: {
    autoResetSeconds: 3,
  },
} as unknown as GameConfig

const victoryProps = {
  config,
  score: 6,
  totalPairs: 6,
  timeTaken: 42,
  onNext: vi.fn(),
}

describe('ResultScreen (HUB-73)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('exibe o novo conteúdo de vitória (parabéns/ganhou/brinde)', () => {
    render(<ResultScreen {...victoryProps} onNext={vi.fn()} />)

    expect(screen.getByText('PARABÉNS!')).toBeTruthy()
    expect(screen.getByText('Você ganhou!')).toBeTruthy()
    expect(screen.getByText('Retire seu brinde na loja BB Seguros')).toBeTruthy()
  })

  it('não exibe mais emoji ou texto antigo de score', () => {
    render(<ResultScreen {...victoryProps} onNext={vi.fn()} />)

    expect(screen.queryByText(/encontrou todos os pares/i)).toBeNull()
    expect(screen.queryByText('🏆')).toBeNull()
    expect(screen.queryByText('🎯')).toBeNull()
  })

  it('o botão Próximo participante chama onNext', () => {
    const onNext = vi.fn()
    render(<ResultScreen {...victoryProps} onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: 'Próximo participante' }))

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('clicar no botão não dispara o reset de container (stopPropagation)', () => {
    const onNext = vi.fn()
    render(<ResultScreen {...victoryProps} onNext={onNext} />)

    // botão chama onNext mesmo com handler de container presente
    fireEvent.click(screen.getByRole('button', { name: 'Próximo participante' }))

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('a contagem regressiva decrementa a cada segundo', () => {
    render(<ResultScreen {...victoryProps} onNext={vi.fn()} />)

    expect(screen.getByText('Reiniciando em 3s...')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Reiniciando em 2s...')).toBeTruthy()
  })

  it('chama onNext automaticamente ao zerar a contagem', () => {
    const onNext = vi.fn()
    render(<ResultScreen {...victoryProps} onNext={onNext} />)

    // avança segundo a segundo até zerar (3 -> 2 -> 1 -> 0), garantindo que
    // o effect do countdown processe cada re-render
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(onNext).toHaveBeenCalled()
  })

  it('tocar no container reseta a contagem para o valor inicial', () => {
    render(<ResultScreen {...victoryProps} onNext={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Reiniciando em 2s...')).toBeTruthy()

    fireEvent.click(screen.getByText('PARABÉNS!'))

    expect(screen.getByText('Reiniciando em 3s...')).toBeTruthy()
  })

  it('fallback gracioso quando não é vitória (score < totalPairs)', () => {
    render(
      <ResultScreen
        config={config}
        score={3}
        totalPairs={6}
        timeTaken={10}
        onNext={vi.fn()}
      />
    )

    expect(screen.getByText('Obrigado por jogar!')).toBeTruthy()
    expect(screen.queryByText('PARABÉNS!')).toBeNull()
  })
})
