import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { GameConfig } from '../../game/types'
import type { RemoteLead } from '../lib/adminLeads'
import type { LocalLead } from '../lib/leadsDb'

const { listAdminLeads, getAllLeads, getPendingLeads, syncPendingLeads } = vi.hoisted(() => ({
  listAdminLeads: vi.fn(),
  getAllLeads: vi.fn(),
  getPendingLeads: vi.fn(),
  syncPendingLeads: vi.fn(),
}))

vi.mock('../lib/adminLeads', () => ({ listAdminLeads }))
vi.mock('../lib/leadsDb', () => ({ getAllLeads, getPendingLeads }))
vi.mock('../lib/leadsSync', () => ({ syncPendingLeads }))

import { AdminPanel } from '../AdminPanel'

function makeConfig(): GameConfig {
  return {
    event: {
      id: 'evento-demo-2026',
      name: 'Evento',
      logo: '',
      primaryColor: '#000',
      backgroundColor: '#fff',
    },
    game: { pairs: 6, cardImages: [], cardBack: '', timeLimitSeconds: 60 },
    leadForm: {
      title: 'Preencha',
      fields: [{ id: 'name', label: 'Nome', type: 'text', required: true }],
    },
    offlineExportPin: '1234',
  }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

const remoteRow = (name: string): RemoteLead => ({
  event_id: 'evento-demo-2026',
  data: { name },
  score: 6,
  time_taken: 30,
  played_at: '2026-07-02T12:00:00Z',
  synced_from: 'online',
})

const localRow = (name: string, synced: boolean): LocalLead => ({
  eventId: 'evento-demo-2026',
  data: { name },
  score: 4,
  timeTaken: 50,
  playedAt: '2026-07-02T13:00:00Z',
  synced,
  consentedAt: '2026-07-02T13:00:00Z',
  consentVersion: '1.0',
})

function typeSecret(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('AdminPanel — autorização online via RPC (HUB-88)', () => {
  beforeEach(() => {
    listAdminLeads.mockReset()
    getAllLeads.mockReset().mockResolvedValue([])
    getPendingLeads.mockReset().mockResolvedValue([])
    syncPendingLeads.mockReset().mockResolvedValue(undefined)
    setOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('online + senha correta: chama a RPC e abre o dashboard com a contagem do retorno', async () => {
    listAdminLeads.mockResolvedValue({
      status: 'authorized',
      leads: [remoteRow('Ana'), remoteRow('Bruno')],
    })
    getPendingLeads.mockResolvedValue([localRow('Carla', false)])

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase-longa-123')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Painel Admin')).toBeDefined()
    expect(listAdminLeads).toHaveBeenCalledWith('evento-demo-2026', 'passphrase-longa-123')
    // Sincronizados = linhas da RPC; Pendentes = fila local; Total = soma.
    expect(screen.getByText('2')).toBeDefined() // sincronizados
    expect(screen.getByText('1')).toBeDefined() // pendentes
    expect(screen.getByText('3')).toBeDefined() // total
  })

  it('online + senha errada: permanece na entrada e mostra erro, sem abrir o dashboard', async () => {
    listAdminLeads.mockResolvedValue({ status: 'unauthorized' })

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'senha-errada')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Senha incorreta.')).toBeDefined()
    expect(screen.getByText('Tentativa 1/3')).toBeDefined()
    expect(screen.queryByText('Painel Admin')).toBeNull()
  })

  it('online + erro inesperado da RPC: superfície explícita do erro, sem engolir', async () => {
    listAdminLeads.mockRejectedValue(new Error('boom de rede'))

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/Falha ao autorizar: boom de rede/)).toBeDefined()
    expect(screen.queryByText('Painel Admin')).toBeNull()
  })

  it('exporta CSV online usando o retorno autorizado (createObjectURL acionado)', async () => {
    listAdminLeads.mockResolvedValue({ status: 'authorized', leads: [remoteRow('Ana')] })
    getAllLeads.mockResolvedValue([localRow('Carla', false)])
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))

    const blob = createObjectURL.mock.calls[0][0]
    const text = await blob.text()
    expect(text).toContain('Ana') // lead remoto autorizado
    expect(text).toContain('Carla') // pendente local
  })
})

describe('AdminPanel — modo offline com gate local (HUB-88)', () => {
  beforeEach(() => {
    listAdminLeads.mockReset()
    getAllLeads.mockReset().mockResolvedValue([])
    getPendingLeads.mockReset().mockResolvedValue([])
    syncPendingLeads.mockReset().mockResolvedValue(undefined)
    setOnline(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offline + PIN errado: erro e nunca chama a RPC', async () => {
    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('PIN de export offline', '0000')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('PIN de export offline incorreto.')).toBeDefined()
    expect(listAdminLeads).not.toHaveBeenCalled()
    expect(screen.queryByText('Painel Admin')).toBeNull()
  })

  it('offline + PIN correto: abre modo offline (IndexedDB), sem RPC, com sincronizados indisponíveis', async () => {
    getAllLeads.mockResolvedValue([localRow('Carla', false), localRow('Diego', true)])

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('PIN de export offline', '1234')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Painel Admin')).toBeDefined()
    expect(listAdminLeads).not.toHaveBeenCalled()
    expect(screen.getByText('indisponível offline')).toBeDefined()
    // Total local = 2, Pendentes (não sincronizados) = 1
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    // Forçar Sync não é oferecido offline
    expect(screen.queryByRole('button', { name: /Forçar Sync/ })).toBeNull()
  })
})
