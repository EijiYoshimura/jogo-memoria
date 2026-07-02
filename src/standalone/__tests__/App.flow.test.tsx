import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mocks leves: evita a cadeia de persistência (supabase/idb) e injeta um config fixo,
// sem harness pesado. Cobre o smoke do fluxo splash → lead-form (Cenários 1/9).
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../hooks/useLeadPersistence', () => ({
  useLeadPersistence: () => ({ saveLead: vi.fn() }),
}))
vi.mock('../ConfigLoader', () => ({
  useConfig: () => ({
    event: {
      id: 'e',
      name: 'Evento',
      logo: '/images/logo_bb.png',
      primaryColor: '#7C3AED',
      backgroundColor: '#0333BD',
    },
    game: { pairs: 6, cardImages: [], cardBack: '', timeLimitSeconds: 60 },
    leadForm: {
      title: 'Preencha seus dados',
      fields: [{ id: 'name', label: 'Nome completo', type: 'text', required: true }],
    },
    offlineExportPin: '1234',
  }),
}))

import { App } from '../App'

describe('App — fluxo direto splash → lead-form (HUB-67, Cenários 1/9)', () => {
  it('da splash vai direto ao formulário, sem tela de consentimento', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'TOQUE PARA JOGAR' })).toBeDefined()
    // não existe mais a ConsentScreen no caminho
    expect(screen.queryByText(/Participar e aceitar/i)).toBeNull()
    expect(screen.queryByText(/Jogar sem participar/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'TOQUE PARA JOGAR' }))

    // formulário renderizado em seguida (logo BB + checkbox de consentimento)
    expect(screen.getByAltText('BB Seguros')).toBeDefined()
    expect(screen.getByRole('checkbox')).toBeDefined()
    expect(screen.queryByText(/Participar e aceitar/i)).toBeNull()
  })
})
