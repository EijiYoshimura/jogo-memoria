import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCpfGate, type UseCpfGateParams } from '../useCpfGate'
import type { CpfLookupResult } from '../../lib/cpfLookup'

// A consulta é sempre injetada nos testes; mockar o módulo evita carregar o supabaseClient
// (que exige env) só por causa da cadeia de import do hook.
vi.mock('../../lib/cpfLookup', () => ({ checkCpfParticipation: vi.fn() }))

const VALID_CPF = '11144477735'
const SECOND_VALID_CPF = '39053344705'
const INVALID_CPF = '11144477734'

function makeHarness(params?: Partial<UseCpfGateParams>) {
  const values: Record<string, string> = { name: '', email: '', phone: '' }
  const lookup = vi.fn<(eventId: string, cpf: string) => Promise<CpfLookupResult>>()
  lookup.mockResolvedValue({ status: 'not-found' })

  const initialProps: UseCpfGateParams = {
    eventId: 'e',
    maxParticipations: 1,
    fieldIds: ['name', 'email', 'phone'],
    readValues: () => values,
    applyAutofill: (fill) => Object.assign(values, fill),
    clearValues: (ids) => ids.forEach((id) => (values[id] = '')),
    lookup,
    ...params,
  }

  const view = renderHook((p: UseCpfGateParams) => useCpfGate(p), { initialProps })
  return { view, values, lookup }
}

/** Cria uma promessa controlável para observar o estado `checking` antes de resolver. */
function deferredLookup(lookup: ReturnType<typeof vi.fn>) {
  let resolve!: (r: CpfLookupResult) => void
  lookup.mockReturnValue(new Promise<CpfLookupResult>((r) => (resolve = r)))
  return (r: CpfLookupResult) => resolve(r)
}

describe('useCpfGate', () => {
  it('CPF incompleto permanece idle e não consulta', () => {
    const { view, lookup } = makeHarness()
    act(() => view.result.current.handleCpfChange('111'))
    expect(view.result.current.state).toBe('idle')
    expect(view.result.current.canSubmit).toBe(false)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('CPF de 11 dígitos com checksum inválido não consulta', () => {
    const { view, lookup } = makeHarness()
    act(() => view.result.current.handleCpfChange(INVALID_CPF))
    expect(view.result.current.state).toBe('idle')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('CPF válido dispara checking e resolve para new (not-found)', async () => {
    const { view, lookup } = makeHarness()
    const resolve = deferredLookup(lookup)

    act(() => view.result.current.handleCpfChange(VALID_CPF))
    expect(view.result.current.state).toBe('checking')
    expect(view.result.current.canSubmit).toBe(false)
    expect(lookup).toHaveBeenCalledWith('e', VALID_CPF)

    await act(async () => resolve({ status: 'not-found' }))
    expect(view.result.current.state).toBe('new')
    expect(view.result.current.canSubmit).toBe(true)
    expect(view.result.current.cpfCheckSkipped).toBe(false)
  })

  it('found abaixo do limite autopreenche campos vazios e marca os ids', async () => {
    const { view, values, lookup } = makeHarness({ maxParticipations: 2 })
    lookup.mockResolvedValue({
      status: 'found',
      participationCount: 1,
      lastLeadData: { name: 'Maria', email: 'maria@email.com', phone: '' },
    })

    await act(async () => view.result.current.handleCpfChange(VALID_CPF))

    expect(view.result.current.state).toBe('autofilled')
    expect(values.name).toBe('Maria')
    expect(values.email).toBe('maria@email.com')
    expect([...view.result.current.autofilledFieldIds].sort()).toEqual(['email', 'name'])
    expect(view.result.current.canSubmit).toBe(true)
  })

  it('autofill não sobrescreve um campo já digitado durante a consulta (design #8)', async () => {
    const { view, values, lookup } = makeHarness({ maxParticipations: 2 })
    const resolve = deferredLookup(lookup)

    act(() => view.result.current.handleCpfChange(VALID_CPF))
    values.name = 'João Digitado' // operador digitou enquanto consultava

    await act(async () =>
      resolve({
        status: 'found',
        participationCount: 1,
        lastLeadData: { name: 'Maria', email: 'maria@email.com', phone: '' },
      })
    )

    expect(values.name).toBe('João Digitado')
    expect(values.email).toBe('maria@email.com')
    expect([...view.result.current.autofilledFieldIds]).toEqual(['email'])
  })

  it('found no limite (limite > 0) bloqueia sem autopreencher', async () => {
    const { view, values, lookup } = makeHarness({ maxParticipations: 1 })
    lookup.mockResolvedValue({
      status: 'found',
      participationCount: 1,
      lastLeadData: { name: 'Maria', email: 'maria@email.com', phone: '' },
    })

    await act(async () => view.result.current.handleCpfChange(VALID_CPF))

    expect(view.result.current.state).toBe('blocked')
    expect(view.result.current.canSubmit).toBe(false)
    expect(values.name).toBe('')
  })

  it('limite 0 (ilimitado) nunca bloqueia', async () => {
    const { view, lookup } = makeHarness({ maxParticipations: 0 })
    lookup.mockResolvedValue({
      status: 'found',
      participationCount: 9,
      lastLeadData: { name: 'Maria', email: '', phone: '' },
    })

    await act(async () => view.result.current.handleCpfChange(VALID_CPF))
    expect(view.result.current.state).toBe('autofilled')
  })

  it('offline-fallback resolve para new-offline com cpfCheckSkipped', async () => {
    const { view, lookup } = makeHarness()
    lookup.mockResolvedValue({ status: 'offline-fallback', reason: 'timeout' })

    await act(async () => view.result.current.handleCpfChange(VALID_CPF))

    expect(view.result.current.state).toBe('new-offline')
    expect(view.result.current.cpfCheckSkipped).toBe(true)
    expect(view.result.current.canSubmit).toBe(true)
  })

  it('editar o CPF após autofill limpa os campos autopreenchidos e volta a idle (design #5)', async () => {
    const { view, values, lookup } = makeHarness({ maxParticipations: 2 })
    lookup.mockResolvedValue({
      status: 'found',
      participationCount: 1,
      lastLeadData: { name: 'Maria', email: 'maria@email.com', phone: '' },
    })
    await act(async () => view.result.current.handleCpfChange(VALID_CPF))
    expect(values.name).toBe('Maria')

    // Editar o CPF (mesmo para outro incompleto) invalida o autofill anterior.
    act(() => view.result.current.handleCpfChange('111'))
    expect(values.name).toBe('')
    expect(values.email).toBe('')
    expect(view.result.current.state).toBe('idle')
    expect(view.result.current.autofilledFieldIds.size).toBe(0)
  })

  it('trocar para outro CPF válido dispara nova consulta', async () => {
    const { view, lookup } = makeHarness()
    await act(async () => view.result.current.handleCpfChange(VALID_CPF))
    await act(async () => view.result.current.handleCpfChange(SECOND_VALID_CPF))
    expect(lookup).toHaveBeenNthCalledWith(1, 'e', VALID_CPF)
    expect(lookup).toHaveBeenNthCalledWith(2, 'e', SECOND_VALID_CPF)
  })

  it('clearAutofillFlag remove só o selo do campo indicado', async () => {
    const { view, lookup } = makeHarness({ maxParticipations: 2 })
    lookup.mockResolvedValue({
      status: 'found',
      participationCount: 1,
      lastLeadData: { name: 'Maria', email: 'maria@email.com', phone: '' },
    })
    await act(async () => view.result.current.handleCpfChange(VALID_CPF))

    act(() => view.result.current.clearAutofillFlag('name'))
    expect([...view.result.current.autofilledFieldIds]).toEqual(['email'])
  })

  it('reset volta ao estado inicial', async () => {
    const { view, lookup } = makeHarness()
    lookup.mockResolvedValue({ status: 'offline-fallback', reason: 'offline' })
    await act(async () => view.result.current.handleCpfChange(VALID_CPF))
    expect(view.result.current.canSubmit).toBe(true)

    act(() => view.result.current.reset())
    expect(view.result.current.state).toBe('idle')
    expect(view.result.current.cpfCheckSkipped).toBe(false)
    expect(view.result.current.autofilledFieldIds.size).toBe(0)
  })

  it('descarta resposta obsoleta quando o CPF muda antes de resolver (race)', async () => {
    const { view, lookup } = makeHarness()
    const resolveFirst = deferredLookup(lookup)

    act(() => view.result.current.handleCpfChange(VALID_CPF)) // 1ª consulta (pendente)
    // Antes de resolver, o operador corrige o CPF (invalida a 1ª).
    act(() => view.result.current.handleCpfChange('111'))
    await act(async () => resolveFirst({ status: 'found', participationCount: 5, lastLeadData: null }))

    // A resposta obsoleta não deve bloquear nem sair de idle.
    expect(view.result.current.state).toBe('idle')
  })
})
