import { describe, it, expect, vi, beforeEach } from 'vitest'

// Isola leadsDb da IndexedDB real: mocka o boundary 'idb' (mesmo padrão de mockar
// '../supabaseClient' em adminLeads.test.ts) com um fake mínimo cobrindo só os métodos
// usados por deleteLeadsForEvent (getAll/delete).
const { getAll, del } = vi.hoisted(() => ({ getAll: vi.fn(), del: vi.fn() }))
vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({ getAll, delete: del })),
}))

import { deleteLeadsForEvent, type LocalLead } from '../leadsDb'

const BASE = {
  data: { name: 'Ana' },
  score: 6,
  timeTaken: 30,
  playedAt: '2026-07-02T12:00:00Z',
  consentedAt: '2026-07-02T12:00:00Z',
  consentVersion: '1.0',
  cpf: null,
  cpfCheckSkipped: false,
  maxParticipationsAtSubmit: null,
}

function leadOf(localId: number, eventId: string, synced: boolean): LocalLead {
  return { ...BASE, localId, eventId, synced }
}

beforeEach(() => {
  getAll.mockReset()
  del.mockReset().mockResolvedValue(undefined)
})

describe('deleteLeadsForEvent', () => {
  it('remove só os leads do evento certo — sincronizados e pendentes — e retorna a contagem', async () => {
    getAll.mockResolvedValue([
      leadOf(1, 'evt-alvo', true),
      leadOf(2, 'evt-alvo', false),
      leadOf(3, 'evt-outro', true),
    ])

    const removed = await deleteLeadsForEvent('evt-alvo')

    expect(removed).toBe(2)
    expect(del).toHaveBeenCalledTimes(2)
    const deletedIds = del.mock.calls.map(([, localId]) => localId).sort()
    expect(deletedIds).toEqual([1, 2])
  })

  it('não remove leads de outro evento', async () => {
    getAll.mockResolvedValue([leadOf(1, 'evt-alvo', true), leadOf(2, 'evt-outro', true)])

    await deleteLeadsForEvent('evt-outro')

    expect(del).toHaveBeenCalledTimes(1)
    expect(del).toHaveBeenCalledWith(expect.any(String), 2)
  })

  it('sem leads do evento retorna 0 e não chama delete', async () => {
    getAll.mockResolvedValue([leadOf(1, 'evt-alvo', true)])

    const removed = await deleteLeadsForEvent('evt-inexistente')

    expect(removed).toBe(0)
    expect(del).not.toHaveBeenCalled()
  })
})
