import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { GameConfig } from '../../game/types'
import type { RemoteLead } from '../lib/adminLeads'
import type { LocalLead } from '../lib/leadsDb'
import { FOREIGN_CPF } from '../../lead-capture/cpf/constants'

const {
  listAdminLeads,
  purgeAdminLeads,
  getAllLeads,
  getPendingLeads,
  deleteLeadsForEvent,
  syncPendingLeads,
} = vi.hoisted(() => ({
  listAdminLeads: vi.fn(),
  purgeAdminLeads: vi.fn(),
  getAllLeads: vi.fn(),
  getPendingLeads: vi.fn(),
  deleteLeadsForEvent: vi.fn(),
  syncPendingLeads: vi.fn(),
}))

vi.mock('../lib/adminLeads', () => ({ listAdminLeads, purgeAdminLeads }))
vi.mock('../lib/leadsDb', () => ({ getAllLeads, getPendingLeads, deleteLeadsForEvent }))
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
  cpf: '12345678900',
  cpf_check_skipped: false,
  max_participations_at_submit: 1,
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
  cpf: '55566677788',
  cpfCheckSkipped: false,
  maxParticipationsAtSubmit: 1,
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

describe('AdminPanel — reconciliação de participações (HUB-92)', () => {
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

  it('lista o CPF excedente com máscara parcial e sem ação de escrita', async () => {
    // Mesmo CPF (12345678900) jogou 2x com limite 1 → excedente.
    listAdminLeads.mockResolvedValue({
      status: 'authorized',
      leads: [remoteRow('Ana'), remoteRow('Ana')],
    })

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')

    expect(screen.getByText('Reconciliação de participações')).toBeDefined()
    // 3 primeiros + 3 últimos dígitos visíveis, miolo mascarado.
    expect(screen.getByText('123.***.**9-00')).toBeDefined()
    expect(screen.getByText(/2 de 1 permitidas/)).toBeDefined()
    // Critério 7: seção informativa — nenhum botão de reverter/excluir participação.
    expect(
      screen.queryByRole('button', { name: /revert|excluir|remover|invalidar/i })
    ).toBeNull()
  })

  it('mostra estado vazio quando nenhum CPF excede o limite', async () => {
    listAdminLeads.mockResolvedValue({ status: 'authorized', leads: [remoteRow('Ana')] })

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')

    expect(screen.getByText('Nenhum CPF excedeu o limite configurado.')).toBeDefined()
  })
})

describe('AdminPanel — card Estrangeiros (HUB-109)', () => {
  const foreignRemote = (name: string): RemoteLead => ({ ...remoteRow(name), cpf: FOREIGN_CPF })
  const foreignLocal = (name: string, synced: boolean): LocalLead => ({
    ...localRow(name, synced),
    cpf: FOREIGN_CPF,
  })
  /** Escopo do card pelo rótulo — os demais cards também exibem números. */
  const foreignCard = () => screen.getByText('Estrangeiros').parentElement as HTMLElement

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

  async function openOnlineDashboard() {
    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')
  }

  it('online: conta remotos + apenas pendentes locais, sem dupla contagem (risco R3)', async () => {
    // 'Ana' está sincronizada: aparece no retorno remoto E no IndexedDB (synced=true).
    // Se a contagem usasse getAllLeads, ela seria contada duas vezes.
    listAdminLeads.mockResolvedValue({
      status: 'authorized',
      leads: [foreignRemote('Ana'), foreignRemote('Bia'), remoteRow('Caio')],
    })
    getAllLeads.mockResolvedValue([foreignLocal('Ana', true), foreignLocal('Dana', false)])
    getPendingLeads.mockResolvedValue([foreignLocal('Dana', false), localRow('Edu', false)])

    await openOnlineDashboard()

    // K=2 remotos estrangeiros + M=1 pendente estrangeiro = 3.
    expect(within(foreignCard()).getByText('3')).toBeDefined()
  })

  it('online: zero usos mostra 0', async () => {
    listAdminLeads.mockResolvedValue({ status: 'authorized', leads: [remoteRow('Ana')] })

    await openOnlineDashboard()

    expect(within(foreignCard()).getByText('0')).toBeDefined()
  })

  it('offline: conta os leads locais do dispositivo com o código', async () => {
    setOnline(false)
    getAllLeads.mockResolvedValue([
      foreignLocal('Ana', true),
      foreignLocal('Bia', false),
      localRow('Caio', false),
    ])

    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('PIN de export offline', '1234')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')

    expect(within(foreignCard()).getByText('2')).toBeDefined()
  })

  it('excedente do código estrangeiro não aparece na reconciliação (critério 5)', async () => {
    // 3 usos com limite 1 — um CPF real seria listado; o código nunca é.
    listAdminLeads.mockResolvedValue({
      status: 'authorized',
      leads: [foreignRemote('Ana'), foreignRemote('Bia'), foreignRemote('Caio')],
    })

    await openOnlineDashboard()

    expect(screen.getByText('Nenhum CPF excedeu o limite configurado.')).toBeDefined()
    expect(screen.queryByText('111.***.**1-11')).toBeNull()
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

describe('AdminPanel — Limpeza de Leads (HUB-153)', () => {
  function readGeneratedCode(): string {
    return screen.getByText((_, el) => el?.id === 'purge-confirmation-code').textContent ?? ''
  }

  function confirmPurgeWithGeneratedCode() {
    const code = readGeneratedCode()
    fireEvent.change(screen.getByLabelText(/código abaixo exatamente como exibido/i), {
      target: { value: code },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apagar leads deste evento' }))
  }

  async function openOnlineDashboard() {
    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('Senha do painel admin', 'passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')
  }

  beforeEach(() => {
    listAdminLeads.mockReset()
    purgeAdminLeads.mockReset()
    getAllLeads.mockReset().mockResolvedValue([])
    getPendingLeads.mockReset().mockResolvedValue([])
    deleteLeadsForEvent.mockReset().mockResolvedValue(0)
    syncPendingLeads.mockReset().mockResolvedValue(undefined)
    setOnline(true)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn<(blob: Blob) => string>(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('o botão "Limpeza de Leads" aparece no modo online', async () => {
    listAdminLeads.mockResolvedValue({ status: 'authorized', leads: [] })
    await openOnlineDashboard()
    expect(screen.getByRole('button', { name: 'Limpeza de Leads' })).toBeDefined()
  })

  it('o botão "Limpeza de Leads" não aparece no modo offline', async () => {
    setOnline(false)
    render(<AdminPanel config={makeConfig()} onClose={vi.fn()} />)
    typeSecret('PIN de export offline', '1234')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel Admin')
    expect(screen.queryByRole('button', { name: 'Limpeza de Leads' })).toBeNull()
  })

  it('exige o match exato do código de confirmação antes de habilitar a exclusão', async () => {
    listAdminLeads.mockResolvedValue({ status: 'authorized', leads: [] })
    await openOnlineDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Limpeza de Leads' }))
    const confirmButton = screen.getByRole('button', { name: 'Apagar leads deste evento' })
    expect(confirmButton).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText(/código abaixo exatamente como exibido/i), {
      target: { value: 'errado' },
    })
    expect(confirmButton).toHaveProperty('disabled', true)

    confirmPurgeWithGeneratedCode()
    expect(purgeAdminLeads).not.toHaveBeenCalled() // ainda não resolveu — só habilitou o clique
  })

  it('fluxo de sucesso completo: exporta, exclui remoto, limpa IndexedDB e zera o dashboard', async () => {
    listAdminLeads
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // login
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // export da limpeza
    purgeAdminLeads.mockResolvedValue({ status: 'purged', purgedCount: 5 })

    await openOnlineDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Limpeza de Leads' }))
    confirmPurgeWithGeneratedCode()

    expect(await screen.findByText(/5 leads foram apagados/)).toBeDefined()
    expect(purgeAdminLeads).toHaveBeenCalledWith(
      'evento-demo-2026',
      'passphrase',
      expect.any(String),
      expect.stringMatching(/^leads-evento-demo-2026-\d{4}-\d{2}-\d{2}\.csv$/),
    )
    expect(deleteLeadsForEvent).toHaveBeenCalledWith('evento-demo-2026')

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    // Dashboard zerado (Total, Sincronizados, Pendentes, Estrangeiros).
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4)
  })

  it('estado (C): 1ª chamada falha (offline) — nada é apagado, purgeAdminLeads nunca é chamada', async () => {
    listAdminLeads
      .mockResolvedValueOnce({ status: 'authorized', leads: [] }) // login
      .mockResolvedValueOnce({ status: 'offline' }) // export da limpeza falha

    await openOnlineDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Limpeza de Leads' }))
    confirmPurgeWithGeneratedCode()

    expect(
      await screen.findByText('A exportação falhou, então nada foi apagado — está tudo como antes.')
    ).toBeDefined()
    expect(purgeAdminLeads).not.toHaveBeenCalled()
    expect(deleteLeadsForEvent).not.toHaveBeenCalled()
  })

  it('estado (E): export ok, exclusão falha (unauthorized) — CSV já baixado, nada localmente apagado', async () => {
    listAdminLeads
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // login
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // export
    purgeAdminLeads.mockResolvedValueOnce({ status: 'unauthorized' })

    await openOnlineDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Limpeza de Leads' }))
    confirmPurgeWithGeneratedCode()

    expect(
      await screen.findByText(
        'O arquivo CSV já foi salvo — nada foi perdido. Mas não foi possível concluir a exclusão.'
      )
    ).toBeDefined()
    expect(deleteLeadsForEvent).not.toHaveBeenCalled()
  })

  it('"Tentar excluir novamente" no estado (E) repete só a exclusão, sem rechamar a leitura/export', async () => {
    listAdminLeads
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // login
      .mockResolvedValueOnce({ status: 'authorized', leads: [remoteRow('Ana')] }) // export
    purgeAdminLeads
      .mockResolvedValueOnce({ status: 'offline' })
      .mockResolvedValueOnce({ status: 'purged', purgedCount: 3 })

    await openOnlineDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Limpeza de Leads' }))
    confirmPurgeWithGeneratedCode()
    await screen.findByText(
      'O arquivo CSV já foi salvo — nada foi perdido. Mas não foi possível concluir a exclusão.'
    )

    const listCallsBeforeRetry = listAdminLeads.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Tentar excluir novamente' }))

    expect(await screen.findByText(/3 leads foram apagados/)).toBeDefined()
    expect(listAdminLeads.mock.calls.length).toBe(listCallsBeforeRetry)
    expect(purgeAdminLeads).toHaveBeenCalledTimes(2)
    expect(deleteLeadsForEvent).toHaveBeenCalledWith('evento-demo-2026')
  })
})
