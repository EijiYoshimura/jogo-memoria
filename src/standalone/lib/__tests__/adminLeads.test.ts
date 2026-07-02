import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../supabaseClient', () => ({ supabase: { rpc } }))

import { listAdminLeads, type RemoteLead } from '../adminLeads'

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

const SAMPLE_ROW: RemoteLead = {
  event_id: 'evento-demo-2026',
  data: { name: 'Ana', email: 'ana@example.com' },
  score: 6,
  time_taken: 42,
  played_at: '2026-07-02T12:00:00Z',
  synced_from: 'online',
}

describe('listAdminLeads', () => {
  beforeEach(() => {
    rpc.mockReset()
    setOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem rede não chama a RPC e devolve offline', async () => {
    setOnline(false)

    const result = await listAdminLeads('evento-demo-2026', 'qualquer-senha')

    expect(result).toEqual({ status: 'offline' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('com segredo correto devolve authorized com as linhas e chama a RPC certa', async () => {
    rpc.mockResolvedValue({ data: [SAMPLE_ROW], error: null })

    const result = await listAdminLeads('evento-demo-2026', 'passphrase-correta-123')

    expect(rpc).toHaveBeenCalledWith('admin_list_leads', {
      p_event_id: 'evento-demo-2026',
      p_secret: 'passphrase-correta-123',
    })
    expect(result).toEqual({ status: 'authorized', leads: [SAMPLE_ROW] })
  })

  it('data nula vira lista vazia autorizada', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    const result = await listAdminLeads('evento-demo-2026', 'senha')

    expect(result).toEqual({ status: 'authorized', leads: [] })
  })

  it('erro unauthorized por SQLSTATE 28000 vira unauthorized (nunca linhas)', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '28000', message: 'unauthorized', details: '', hint: '' },
    })

    const result = await listAdminLeads('evento-demo-2026', 'senha-errada')

    expect(result).toEqual({ status: 'unauthorized' })
  })

  it('erro unauthorized por mensagem vira unauthorized', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'unauthorized', details: '', hint: '' },
    })

    const result = await listAdminLeads('evento-demo-2026', 'senha-errada')

    expect(result).toEqual({ status: 'unauthorized' })
  })

  it('erro inesperado (rede) é propagado, nunca silenciado', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure', details: '', hint: '' },
    })

    await expect(listAdminLeads('evento-demo-2026', 'senha')).rejects.toMatchObject({
      code: '08006',
    })
  })
})
