import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SplashScreen } from '../SplashScreen'
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
} as unknown as GameConfig

describe('SplashScreen (HUB-70)', () => {
  it('dispara onStart ao clicar no botão TOQUE PARA JOGAR', () => {
    const onStart = vi.fn()
    render(<SplashScreen config={config} onStart={onStart} onAdminAccess={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'TOQUE PARA JOGAR' }))

    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('não renderiza mais o nome do evento', () => {
    render(<SplashScreen config={config} onStart={vi.fn()} onAdminAccess={vi.fn()} />)

    expect(screen.queryByText('Evento Demo')).toBeNull()
  })

  it('chama onAdminAccess após 5 toques no logo (easter egg)', () => {
    const onAdminAccess = vi.fn()
    render(<SplashScreen config={config} onStart={vi.fn()} onAdminAccess={onAdminAccess} />)

    const logo = screen.getByAltText('Evento Demo')
    for (let i = 0; i < 5; i++) {
      fireEvent.click(logo)
    }

    expect(onAdminAccess).toHaveBeenCalledTimes(1)
  })

  it('tocar no logo não dispara onStart (sem clique duplo)', () => {
    const onStart = vi.fn()
    render(<SplashScreen config={config} onStart={onStart} onAdminAccess={vi.fn()} />)

    fireEvent.click(screen.getByAltText('Evento Demo'))

    expect(onStart).not.toHaveBeenCalled()
  })
})
