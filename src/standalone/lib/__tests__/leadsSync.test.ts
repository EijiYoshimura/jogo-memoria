import { describe, it, expect, vi, beforeEach } from 'vitest'

// A camada de sync escreve via supabase.from('leads').insert(...) — mockado para
// inspecionar o payload snake_case sem tocar em rede. `leadsDb` é mockado para isolar
// o flush de pendentes da persistência local real (IndexedDB).
const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn()
  const from = vi.fn(() => ({ insert }))
  return { insert, from }
})
vi.mock('../supabaseClient', () => ({ supabase: { from } }))

const { getPendingLeads, markSynced } = vi.hoisted(() => ({
  getPendingLeads: vi.fn(),
  markSynced: vi.fn(),
}))
vi.mock('../leadsDb', () => ({ getPendingLeads, markSynced }))

import { syncLead, syncOnlineLead, syncPendingLeads } from '../leadsSync'
import type { LocalLead } from '../leadsDb'

const BASE = {
  eventId: 'evt-1',
  data: { name: 'Ana' },
  score: 6,
  timeTaken: 30,
  playedAt: '2026-07-02T12:00:00Z',
  consentedAt: '2026-07-02T12:00:00Z',
  consentVersion: '1.0',
}

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null })
  from.mockClear()
  getPendingLeads.mockReset()
  markSynced.mockReset().mockResolvedValue(undefined)
})

describe('syncOnlineLead', () => {
  it('mapeia os campos de CPF para snake_case no insert', async () => {
    const ok = await syncOnlineLead({
      ...BASE,
      cpf: '11122233344',
      cpfCheckSkipped: false,
      maxParticipationsAtSubmit: 2,
    })

    expect(ok).toBe(true)
    expect(from).toHaveBeenCalledWith('leads')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'evt-1',
        synced_from: 'online',
        cpf: '11122233344',
        cpf_check_skipped: false,
        max_participations_at_submit: 2,
      })
    )
  })

  it('propaga cpfCheckSkipped=true (fallback offline persistido)', async () => {
    await syncOnlineLead({
      ...BASE,
      cpf: '11122233344',
      cpfCheckSkipped: true,
      maxParticipationsAtSubmit: 1,
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ cpf_check_skipped: true })
    )
  })

  it('retorna false quando o insert falha — erro não é silenciado', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } })
    const ok = await syncOnlineLead({
      ...BASE,
      cpf: '11122233344',
      cpfCheckSkipped: false,
      maxParticipationsAtSubmit: 1,
    })
    expect(ok).toBe(false)
  })
})

describe('syncLead — flush de pendentes', () => {
  it('mapeia os campos de CPF de um lead completo', async () => {
    const lead: LocalLead = {
      ...BASE,
      synced: false,
      cpf: '55566677788',
      cpfCheckSkipped: true,
      maxParticipationsAtSubmit: 3,
    }
    await syncLead(lead)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        synced_from: 'offline-sync',
        cpf: '55566677788',
        cpf_check_skipped: true,
        max_participations_at_submit: 3,
      })
    )
  })

  it('retrocompat: lead legado sem os campos de CPF cai nos defaults das colunas', async () => {
    // Lead bufferado antes do HUB-92 — sem cpf/cpfCheckSkipped/maxParticipationsAtSubmit.
    const legacy = { ...BASE, synced: false } as unknown as LocalLead
    await syncLead(legacy)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: null,
        cpf_check_skipped: false,
        max_participations_at_submit: null,
      })
    )
  })
})

describe('syncPendingLeads', () => {
  it('sincroniza e marca cada pendente com sucesso', async () => {
    const pending: LocalLead = {
      ...BASE,
      localId: 7,
      synced: false,
      cpf: '11122233344',
      cpfCheckSkipped: false,
      maxParticipationsAtSubmit: 1,
    }
    getPendingLeads.mockResolvedValue([pending])
    await syncPendingLeads()
    expect(markSynced).toHaveBeenCalledWith(7)
  })
})
