import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../supabaseClient', () => ({ supabase: { rpc } }))

import { listAdminLeads, purgeAdminLeads, type RemoteLead } from '../adminLeads'

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
  cpf: '12345678900',
  cpf_check_skipped: false,
  max_participations_at_submit: 1,
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

describe('purgeAdminLeads', () => {
  beforeEach(() => {
    rpc.mockReset()
    setOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem rede não chama a RPC e devolve offline', async () => {
    setOnline(false)

    const result = await purgeAdminLeads(
      'evento-demo-2026',
      'qualquer-senha',
      'device-abc',
      'leads-evento-demo-2026.csv',
    )

    expect(result).toEqual({ status: 'offline' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('com segredo correto chama admin_purge_leads com os parâmetros certos e devolve purged com a contagem do servidor', async () => {
    rpc.mockResolvedValue({ data: 7, error: null })

    const result = await purgeAdminLeads(
      'evento-demo-2026',
      'passphrase-correta-123',
      'device-abc',
      'leads-evento-demo-2026.csv',
    )

    expect(rpc).toHaveBeenCalledWith('admin_purge_leads', {
      p_event_id: 'evento-demo-2026',
      p_secret: 'passphrase-correta-123',
      p_device_id: 'device-abc',
      p_export_filename: 'leads-evento-demo-2026.csv',
    })
    expect(result).toEqual({ status: 'purged', purgedCount: 7 })
  })

  it('erro unauthorized por SQLSTATE 28000 vira unauthorized', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '28000', message: 'unauthorized', details: '', hint: '' },
    })

    const result = await purgeAdminLeads(
      'evento-demo-2026',
      'senha-errada',
      'device-abc',
      'leads-evento-demo-2026.csv',
    )

    expect(result).toEqual({ status: 'unauthorized' })
  })

  it('erro inesperado (ex.: invalid device id) é propagado, nunca silenciado', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'invalid device id', details: '', hint: '' },
    })

    await expect(
      purgeAdminLeads('evento-demo-2026', 'senha', '', 'leads-evento-demo-2026.csv'),
    ).rejects.toMatchObject({ code: '22023' })
  })
})
