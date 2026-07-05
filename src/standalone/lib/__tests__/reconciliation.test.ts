import { describe, it, expect } from 'vitest'
import { findParticipationOverages, type ReconciliationLead } from '../reconciliation'
import { FOREIGN_CPF } from '../../../lead-capture/cpf/constants'

function lead(overrides: Partial<ReconciliationLead> = {}): ReconciliationLead {
  return {
    cpf: '11122233344',
    eventId: 'evt-1',
    cpfCheckSkipped: false,
    maxParticipationsAtSubmit: 1,
    ...overrides,
  }
}

describe('findParticipationOverages', () => {
  it('reporta o grupo cujo total excedeu o limite', () => {
    const overages = findParticipationOverages([lead(), lead()])
    expect(overages).toEqual([
      {
        cpf: '11122233344',
        eventId: 'evt-1',
        totalParticipations: 2,
        limit: 1,
        offlineParticipations: 0,
      },
    ])
  })

  it('não reporta grupo dentro do limite', () => {
    const overages = findParticipationOverages([
      lead({ maxParticipationsAtSubmit: 2 }),
      lead({ maxParticipationsAtSubmit: 2 }),
    ])
    expect(overages).toEqual([])
  })

  it('ignora limite 0 (ilimitado) por mais participações que haja', () => {
    const overages = findParticipationOverages([
      lead({ maxParticipationsAtSubmit: 0 }),
      lead({ maxParticipationsAtSubmit: 0 }),
      lead({ maxParticipationsAtSubmit: 0 }),
    ])
    expect(overages).toEqual([])
  })

  it('ignora linhas com cpf nulo', () => {
    const overages = findParticipationOverages([lead({ cpf: null }), lead({ cpf: null })])
    expect(overages).toEqual([])
  })

  it('agrupa por (eventId, cpf): mesmo CPF em eventos distintos não soma', () => {
    // 1 participação em cada evento, limite 1 — se somasse os eventos, viraria excedente.
    const overages = findParticipationOverages([
      lead({ eventId: 'evt-1' }),
      lead({ eventId: 'evt-2' }),
    ])
    expect(overages).toEqual([])
  })

  it('conta offlineParticipations (linhas com cpfCheckSkipped=true)', () => {
    const overages = findParticipationOverages([
      lead({ cpfCheckSkipped: true }),
      lead({ cpfCheckSkipped: true }),
      lead({ cpfCheckSkipped: false }),
    ])
    expect(overages).toHaveLength(1)
    expect(overages[0]).toMatchObject({
      totalParticipations: 3,
      limit: 1,
      offlineParticipations: 2,
    })
  })

  it('usa o limite mais recente (não-nulo) do grupo como referência', () => {
    // Limite subiu de 1 para 3 no meio do evento; 3 participações não excedem 3.
    const overages = findParticipationOverages([
      lead({ maxParticipationsAtSubmit: 1 }),
      lead({ maxParticipationsAtSubmit: 3 }),
      lead({ maxParticipationsAtSubmit: 3 }),
    ])
    expect(overages).toEqual([])
  })

  it('um limite nulo posterior não apaga o limite conhecido do grupo', () => {
    // Duas jogadas com limite 1 (excedente) + uma linha legada sem limite (null).
    const overages = findParticipationOverages([
      lead({ maxParticipationsAtSubmit: 1 }),
      lead({ maxParticipationsAtSubmit: 1 }),
      lead({ maxParticipationsAtSubmit: null }),
    ])
    expect(overages).toHaveLength(1)
    expect(overages[0]).toMatchObject({ totalParticipations: 3, limit: 1 })
  })

  it('ignora grupo sem nenhum limite conhecido (todas as linhas com limite nulo)', () => {
    const overages = findParticipationOverages([
      lead({ maxParticipationsAtSubmit: null }),
      lead({ maxParticipationsAtSubmit: null }),
    ])
    expect(overages).toEqual([])
  })

  it('separa múltiplos CPFs excedentes no mesmo evento', () => {
    // Fixture sem '11111111111': o valor virou o código estrangeiro (HUB-109) e é
    // excluído por design — a intenção deste teste (separação por CPF) não muda.
    const overages = findParticipationOverages([
      lead({ cpf: '44444444444' }),
      lead({ cpf: '44444444444' }),
      lead({ cpf: '22222222222' }),
      lead({ cpf: '22222222222' }),
      lead({ cpf: '33333333333' }), // dentro do limite
    ])
    expect(overages.map((o) => o.cpf).sort()).toEqual(['22222222222', '44444444444'])
  })
})

describe('findParticipationOverages — código estrangeiro (HUB-109)', () => {
  it('nunca lista o código, mesmo muito acima do limite e com linhas offline legadas', () => {
    const overages = findParticipationOverages([
      lead({ cpf: FOREIGN_CPF }),
      lead({ cpf: FOREIGN_CPF }),
      lead({ cpf: FOREIGN_CPF, cpfCheckSkipped: true }),
      lead({ cpf: FOREIGN_CPF, cpfCheckSkipped: true }),
    ])
    expect(overages).toEqual([])
  })

  it('dataset misto: só o CPF real excedente é listado', () => {
    const overages = findParticipationOverages([
      lead({ cpf: FOREIGN_CPF }),
      lead({ cpf: FOREIGN_CPF }),
      lead({ cpf: '11122233344' }),
      lead({ cpf: '11122233344' }),
    ])
    expect(overages.map((o) => o.cpf)).toEqual(['11122233344'])
  })
})
