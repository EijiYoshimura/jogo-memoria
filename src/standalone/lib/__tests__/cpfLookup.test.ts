import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A RPC vive atrás do supabaseClient — mockado para controlar o retorno por teste.
// `vi.hoisted` garante que `rpc` exista quando a factory de `vi.mock` (içada) roda.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../supabaseClient', () => ({ supabase: { rpc } }))

import { checkCpfParticipation, CPF_LOOKUP_TIMEOUT_MS } from '../cpfLookup'

const EVENT = 'evento-demo'
const CPF = '11144477735'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

beforeEach(() => {
  rpc.mockReset()
  setOnline(true)
})

afterEach(() => {
  vi.useRealTimers()
  setOnline(true)
})

describe('checkCpfParticipation', () => {
  it('mapeia participação encontrada (found) com contagem e último cadastro', async () => {
    const lastLeadData = { name: 'Maria', email: 'maria@email.com' }
    rpc.mockResolvedValue({ data: [{ participation_count: 2, last_lead_data: lastLeadData }], error: null })

    const result = await checkCpfParticipation(EVENT, CPF)

    expect(rpc).toHaveBeenCalledWith('check_cpf_participation', { p_event_id: EVENT, p_cpf: CPF })
    expect(result).toEqual({ status: 'found', participationCount: 2, lastLeadData })
  })

  it('mapeia ausência de cadastro (contagem 0) como not-found', async () => {
    rpc.mockResolvedValue({ data: [{ participation_count: 0, last_lead_data: null }], error: null })
    expect(await checkCpfParticipation(EVENT, CPF)).toEqual({ status: 'not-found' })
  })

  it('mapeia data vazia como not-found', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await checkCpfParticipation(EVENT, CPF)).toEqual({ status: 'not-found' })
  })

  it('erro de rede vira offline-fallback (network-error)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await checkCpfParticipation(EVENT, CPF)).toEqual({
      status: 'offline-fallback',
      reason: 'network-error',
    })
  })

  it('dispositivo offline curto-circuita sem chamar a RPC (offline)', async () => {
    setOnline(false)
    expect(await checkCpfParticipation(EVENT, CPF)).toEqual({
      status: 'offline-fallback',
      reason: 'offline',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('RPC que não responde em 3s vira offline-fallback (timeout)', async () => {
    vi.useFakeTimers()
    // Nunca resolve: força o braço de timeout da corrida.
    rpc.mockReturnValue(new Promise(() => {}))

    const pending = checkCpfParticipation(EVENT, CPF)
    await vi.advanceTimersByTimeAsync(CPF_LOOKUP_TIMEOUT_MS)

    expect(await pending).toEqual({ status: 'offline-fallback', reason: 'timeout' })
  })

  it('resposta antes do timeout não dispara o fallback', async () => {
    vi.useFakeTimers()
    rpc.mockResolvedValue({ data: [{ participation_count: 1, last_lead_data: null }], error: null })

    const pending = checkCpfParticipation(EVENT, CPF)
    await vi.advanceTimersByTimeAsync(100)

    expect(await pending).toEqual({ status: 'found', participationCount: 1, lastLeadData: null })
  })
})
