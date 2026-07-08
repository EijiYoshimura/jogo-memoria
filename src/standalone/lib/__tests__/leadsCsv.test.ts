import { describe, it, expect } from 'vitest'
import { buildLeadsCsv } from '../leadsCsv'
import type { GameConfig } from '../../../game/types'
import type { LocalLead } from '../leadsDb'
import type { RemoteLead } from '../adminLeads'

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
      fields: [
        { id: 'name', label: 'Nome', type: 'text', required: true },
        { id: 'email', label: 'E-mail', type: 'email', required: true },
      ],
    },
    offlineExportPin: '1234',
  }
}

const remote: RemoteLead = {
  event_id: 'evento-demo-2026',
  data: { name: 'Ana', email: 'ana@example.com' },
  score: 6,
  time_taken: 42,
  played_at: '2026-07-02T12:00:00Z',
  synced_from: 'online',
  cpf: '11122233344',
  cpf_check_skipped: false,
  max_participations_at_submit: 1,
}

const local: LocalLead = {
  eventId: 'evento-demo-2026',
  data: { name: 'Bruno', email: 'bruno@example.com' },
  score: 4,
  timeTaken: 55,
  playedAt: '2026-07-02T13:00:00Z',
  synced: false,
  consentedAt: '2026-07-02T13:00:00Z',
  consentVersion: '1.0',
  cpf: '55566677788',
  cpfCheckSkipped: false,
  maxParticipationsAtSubmit: 1,
}

describe('buildLeadsCsv', () => {
  it('gera cabeçalho com labels dos campos + colunas fixas (cpf incluída)', () => {
    const csv = buildLeadsCsv(makeConfig(), [], [])
    expect(csv).toBe('Nome,E-mail,cpf,played_at,score,time_taken,synced_from')
  })

  it('inclui linhas remotas e locais na ordem remoto → local com a coluna CPF formatada', () => {
    const csv = buildLeadsCsv(makeConfig(), [remote], [local])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(
      '"Ana","ana@example.com","111.222.333-44","2026-07-02T12:00:00Z","6","42","online"'
    )
    expect(lines[2]).toBe(
      '"Bruno","bruno@example.com","555.666.777-88","2026-07-02T13:00:00Z","4","55","offline-sync"'
    )
  })

  it('formata o CPF sentinela de estrangeiro (111.111.111-11) sem tratamento especial', () => {
    const foreigner: RemoteLead = { ...remote, cpf: '11111111111' }
    const csv = buildLeadsCsv(makeConfig(), [foreigner], [])
    expect(csv.split('\n')[1]).toContain('"111.111.111-11"')
  })

  it('trata cpf/score/time_taken nulos e campo ausente como célula vazia', () => {
    const partial: RemoteLead = {
      event_id: 'evento-demo-2026',
      data: { name: 'Sem Email' },
      score: null,
      time_taken: null,
      played_at: null,
      synced_from: null,
      cpf: null,
      cpf_check_skipped: null,
      max_participations_at_submit: null,
    }
    const csv = buildLeadsCsv(makeConfig(), [partial], [])
    const lines = csv.split('\n')
    // cpf nulo → célula vazia; synced_from nulo cai no fallback "online"
    expect(lines[1]).toBe('"Sem Email","","","","","","online"')
  })

  it('trata cpf de string vazia como célula vazia, sem lançar erro', () => {
    const emptyCpf: RemoteLead = { ...remote, cpf: '' }
    expect(() => buildLeadsCsv(makeConfig(), [emptyCpf], [])).not.toThrow()
    const csv = buildLeadsCsv(makeConfig(), [emptyCpf], [])
    expect(csv.split('\n')[1]).toBe(
      '"Ana","ana@example.com","","2026-07-02T12:00:00Z","6","42","online"'
    )
  })

  it('escapa aspas duplicando-as (proteção de CSV)', () => {
    const tricky: RemoteLead = {
      ...remote,
      data: { name: 'Ana "A"', email: 'ana@example.com' },
    }
    const csv = buildLeadsCsv(makeConfig(), [tricky], [])
    expect(csv.split('\n')[1]).toContain('"Ana ""A"""')
  })
})
