import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from '../ConfigLoader'
import { useConfig } from '../hooks/useConfig'
import { DEFAULT_MAX_PARTICIPATIONS } from '../../lead-capture/cpf/constants'

// Config bruto mínimo e válido, sem `maxParticipations`. Cada teste sobrescreve
// apenas o `leadForm.maxParticipations` conforme o cenário sob validação.
function baseRawConfig(): Record<string, unknown> {
  return {
    event: { id: 'e', name: 'Evento' },
    game: { pairs: 2, cardImages: ['a', 'b'], timeLimitSeconds: 60 },
    leadForm: { title: 'Dados', fields: [] },
    offlineExportPin: '1234',
  }
}

function stubFetchConfig(rawConfig: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawConfig,
    }),
  )
}

// Sonda que lê o config já validado/normalizado e expõe o valor efetivo de
// `maxParticipations` para asserção — sem acoplar o teste a internos do loader.
function MaxParticipationsProbe() {
  const config = useConfig()
  return <span data-testid="max-participations">{String(config.leadForm.maxParticipations)}</span>
}

function renderWithConfig(rawConfig: unknown) {
  stubFetchConfig(rawConfig)
  return render(
    <ConfigProvider>
      <MaxParticipationsProbe />
    </ConfigProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ConfigLoader — validação e default de maxParticipations (HUB-87/HUB-93)', () => {
  it('aplica o default quando ausente', async () => {
    renderWithConfig(baseRawConfig())

    const probe = await screen.findByTestId('max-participations')
    expect(probe.textContent).toBe(String(DEFAULT_MAX_PARTICIPATIONS))
    expect(probe.textContent).toBe('1')
  })

  it('preserva um valor válido positivo', async () => {
    const raw = baseRawConfig()
    ;(raw.leadForm as Record<string, unknown>).maxParticipations = 3

    renderWithConfig(raw)

    const probe = await screen.findByTestId('max-participations')
    expect(probe.textContent).toBe('3')
  })

  it('preserva 0 (ilimitado) sem cair no default', async () => {
    const raw = baseRawConfig()
    ;(raw.leadForm as Record<string, unknown>).maxParticipations = 0

    renderWithConfig(raw)

    const probe = await screen.findByTestId('max-participations')
    expect(probe.textContent).toBe('0')
  })

  it.each([
    ['negativo', -1],
    ['não inteiro', 1.5],
    ['string', '2'],
    ['null', null],
  ])('rejeita config com maxParticipations %s (tela de erro)', async (_label, invalidValue) => {
    const raw = baseRawConfig()
    ;(raw.leadForm as Record<string, unknown>).maxParticipations = invalidValue

    renderWithConfig(raw)

    await waitFor(() => {
      expect(screen.getByText('Erro de Configuração')).toBeDefined()
    })
    expect(screen.queryByTestId('max-participations')).toBeNull()
  })
})
