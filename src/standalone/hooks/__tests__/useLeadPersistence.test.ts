import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Isola o hook da persistência real: leadsDb (IndexedDB) e leadsSync (Supabase) são
// mockados para verificar que os campos de CPF chegam a ambos os destinos.
const { saveLeadToDb, markSynced } = vi.hoisted(() => ({
  saveLeadToDb: vi.fn(),
  markSynced: vi.fn(),
}))
const { syncOnlineLead, syncPendingLeads } = vi.hoisted(() => ({
  syncOnlineLead: vi.fn(),
  syncPendingLeads: vi.fn(),
}))
vi.mock('../../lib/leadsDb', () => ({ saveLead: saveLeadToDb, markSynced }))
vi.mock('../../lib/leadsSync', () => ({ syncOnlineLead, syncPendingLeads }))

import { useLeadPersistence } from '../useLeadPersistence'
import { FOREIGN_CPF } from '../../../lead-capture/cpf/constants'

const PARAMS = {
  eventId: 'evt-1',
  formData: { name: 'Ana' },
  score: 6,
  timeTaken: 30,
  consentedAt: '2026-07-02T12:00:00Z',
  consentVersion: '1.0',
  cpf: '11122233344',
  cpfCheckSkipped: false,
  maxParticipationsAtSubmit: 2,
}

beforeEach(() => {
  saveLeadToDb.mockReset().mockResolvedValue(42)
  markSynced.mockReset().mockResolvedValue(undefined)
  syncOnlineLead.mockReset().mockResolvedValue(true)
  syncPendingLeads.mockReset().mockResolvedValue(undefined)
})

describe('useLeadPersistence.saveLead', () => {
  it('grava os campos de CPF no IndexedDB e no Supabase', async () => {
    const { result } = renderHook(() => useLeadPersistence())
    await result.current.saveLead(PARAMS)

    expect(saveLeadToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        data: { name: 'Ana' },
        synced: false,
        cpf: '11122233344',
        cpfCheckSkipped: false,
        maxParticipationsAtSubmit: 2,
      })
    )
    expect(syncOnlineLead).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: '11122233344',
        cpfCheckSkipped: false,
        maxParticipationsAtSubmit: 2,
      })
    )
  })

  it('marca como sincronizado quando o insert online tem sucesso', async () => {
    const { result } = renderHook(() => useLeadPersistence())
    await result.current.saveLead(PARAMS)
    expect(markSynced).toHaveBeenCalledWith(42)
  })

  it('não marca como sincronizado quando o insert online falha — fica pendente', async () => {
    syncOnlineLead.mockResolvedValue(false)
    const { result } = renderHook(() => useLeadPersistence())
    await result.current.saveLead(PARAMS)
    expect(markSynced).not.toHaveBeenCalled()
  })

  it('código de participante estrangeiro passa verbatim, sem special-case (HUB-109)', async () => {
    const { result } = renderHook(() => useLeadPersistence())
    await result.current.saveLead({
      ...PARAMS,
      cpf: FOREIGN_CPF,
      cpfCheckSkipped: false,
      maxParticipationsAtSubmit: 1, // snapshot honesto da config, mesmo sendo irrelevante
    })

    const expected = expect.objectContaining({
      cpf: FOREIGN_CPF,
      cpfCheckSkipped: false,
      maxParticipationsAtSubmit: 1,
    })
    expect(saveLeadToDb).toHaveBeenCalledWith(expected)
    expect(syncOnlineLead).toHaveBeenCalledWith(expected)
  })
})
