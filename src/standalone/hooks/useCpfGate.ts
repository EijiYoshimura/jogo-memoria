// Máquina de estados do gate de CPF (HUB-87 §4). Consumida pelo `LeadForm`: dispara a
// consulta online automaticamente ao completar 11 dígitos válidos, mapeia o resultado
// para um estado (liberado / autopreenchido / bloqueado / fallback offline), aplica o
// autofill granular por campo (sem sobrescrever digitação em andamento) e invalida tudo
// ao editar o CPF. A rede fica atrás de `cpfLookup` (injetável para teste).

import { useCallback, useRef, useState } from 'react'
import { CPF_DIGIT_COUNT, isValidCpf } from '../../lead-capture/cpf/cpfValidation'
import { isForeignCpf } from '../../lead-capture/cpf/constants'
import { checkCpfParticipation, type CpfLookupResult } from '../lib/cpfLookup'

export type CpfGateState =
  | 'idle' // CPF ausente/incompleto/inválido — nenhuma consulta em curso
  | 'checking' // 11 dígitos válidos — consulta online em andamento
  | 'new' // CPF sem cadastro anterior (online confirmou)
  | 'autofilled' // CPF encontrado abaixo do limite — demais campos autopreenchidos
  | 'blocked' // CPF encontrado no limite (modal de bloqueio)
  | 'new-offline' // consulta indisponível — tratado como novo, cpfCheckSkipped=true
  | 'foreign' // código de participante estrangeiro — sem consulta, sem limite (HUB-109)

/** `maxParticipations === 0` ⇒ ilimitado (nunca bloqueia — Cenário 5). */
const UNLIMITED = 0

/** Estados em que o envio do formulário é permitido pelo gate de CPF. */
const SUBMIT_ENABLED: ReadonlySet<CpfGateState> = new Set<CpfGateState>([
  'new',
  'autofilled',
  'new-offline',
  'foreign',
])

export interface CpfGateCallbacks {
  /** Lê os valores atuais dos campos genéricos (para não sobrescrever digitação). */
  readValues: () => Record<string, string>
  /** Aplica os valores autopreenchidos aos campos genéricos do formulário. */
  applyAutofill: (values: Record<string, string>) => void
  /** Limpa os campos indicados (invalidação do autofill ao editar o CPF). */
  clearValues: (fieldIds: string[]) => void
}

export interface UseCpfGateParams extends CpfGateCallbacks {
  eventId: string
  maxParticipations: number
  /** Ids dos campos genéricos elegíveis a autopreenchimento. */
  fieldIds: string[]
  /** Injeção de dependência da consulta online (default: `checkCpfParticipation`). */
  lookup?: (eventId: string, cpf: string) => Promise<CpfLookupResult>
}

export interface CpfGate {
  state: CpfGateState
  /** Campos preenchidos automaticamente na última resolução (para o selo/borda). */
  autofilledFieldIds: ReadonlySet<string>
  /** `true` quando a última resolução foi fallback offline (Cenário 6). */
  cpfCheckSkipped: boolean
  /** Envio liberado pelo gate (não substitui as demais regras do `LeadForm`). */
  canSubmit: boolean
  /** Notifica uma mudança do CPF (dígitos sanitizados) — decide consulta/invalidação. */
  handleCpfChange: (sanitizedCpf: string) => void
  /** Remove o selo de autofill de um campo editado manualmente. */
  clearAutofillFlag: (fieldId: string) => void
  /** Volta ao estado inicial (usado pelo "Próximo participante"). */
  reset: () => void
}

export function useCpfGate(params: UseCpfGateParams): CpfGate {
  const { eventId, maxParticipations, fieldIds, lookup = checkCpfParticipation } = params

  const [state, setState] = useState<CpfGateState>('idle')
  const [autofilledFieldIds, setAutofilledFieldIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [cpfCheckSkipped, setCpfCheckSkipped] = useState(false)

  // Refs para evitar closures obsoletas em callbacks assíncronos e reentrantes.
  const paramsRef = useRef(params)
  paramsRef.current = params
  const autofilledIdsRef = useRef<ReadonlySet<string>>(autofilledFieldIds)
  const lookedUpCpfRef = useRef('') // último CPF que passou pelo gate (evita re-disparo)
  const requestSeqRef = useRef(0) // sequência p/ descartar respostas obsoletas (race)

  const updateAutofilled = useCallback((next: ReadonlySet<string>) => {
    autofilledIdsRef.current = next
    setAutofilledFieldIds(next)
  }, [])

  const applyAutofillData = useCallback(
    (lastLeadData: Record<string, string> | null) => {
      const current = paramsRef.current.readValues()
      const toFill: Record<string, string> = {}
      const filled = new Set<string>()
      for (const id of fieldIds) {
        const incoming = lastLeadData?.[id]
        // Só preenche campos que o operador não digitou (decisão de design #8).
        if (incoming && (current[id] ?? '').trim() === '') {
          toFill[id] = incoming
          filled.add(id)
        }
      }
      if (Object.keys(toFill).length > 0) paramsRef.current.applyAutofill(toFill)
      updateAutofilled(filled)
    },
    [fieldIds, updateAutofilled]
  )

  const applyResult = useCallback(
    (result: CpfLookupResult) => {
      if (result.status === 'not-found') {
        setCpfCheckSkipped(false)
        setState('new')
        return
      }
      if (result.status === 'offline-fallback') {
        setCpfCheckSkipped(true)
        setState('new-offline')
        return
      }
      setCpfCheckSkipped(false)
      const atLimit =
        maxParticipations !== UNLIMITED && result.participationCount >= maxParticipations
      if (atLimit) {
        setState('blocked')
        return
      }
      applyAutofillData(result.lastLeadData)
      setState('autofilled')
    },
    [maxParticipations, applyAutofillData]
  )

  const startLookup = useCallback(
    (cpf: string) => {
      const requestId = ++requestSeqRef.current
      setState('checking')
      lookup(eventId, cpf)
        .then((result) => {
          if (requestId !== requestSeqRef.current) return // resposta obsoleta — descarta
          applyResult(result)
        })
        .catch(() => {
          if (requestId !== requestSeqRef.current) return
          // `checkCpfParticipation` é contratualmente não-lançante; um reject inesperado
          // é recuperado como indisponibilidade (fallback permissivo) — nunca trava o totem.
          applyResult({ status: 'offline-fallback', reason: 'network-error' })
        })
    },
    [eventId, lookup, applyResult]
  )

  // Descarta consulta em andamento, limpa autofill anterior e volta a idle. Chamado a
  // cada mudança relevante do CPF (decisão de design #5): evita lead com dados de uma
  // pessoa vinculados ao CPF de outra.
  const invalidate = useCallback(() => {
    requestSeqRef.current++
    const ids = [...autofilledIdsRef.current]
    if (ids.length > 0) paramsRef.current.clearValues(ids)
    updateAutofilled(new Set())
    setCpfCheckSkipped(false)
    setState('idle')
  }, [updateAutofilled])

  const handleCpfChange = useCallback(
    (sanitizedCpf: string) => {
      if (sanitizedCpf === lookedUpCpfRef.current) return
      lookedUpCpfRef.current = sanitizedCpf
      invalidate()
      // Antes do gatilho de isValidCpf, obrigatoriamente: o código estrangeiro é
      // matematicamente inválido e nunca ativaria depois dele (HUB-109, risco R1).
      if (isForeignCpf(sanitizedCpf)) {
        setState('foreign') // sem lookup: idêntico online/offline, sem timeout
        return
      }
      // Gatilho automático: só dispara com 11 dígitos e checksum válido (decisão #1/#2).
      if (sanitizedCpf.length === CPF_DIGIT_COUNT && isValidCpf(sanitizedCpf)) {
        startLookup(sanitizedCpf)
      }
    },
    [invalidate, startLookup]
  )

  const clearAutofillFlag = useCallback(
    (fieldId: string) => {
      if (!autofilledIdsRef.current.has(fieldId)) return
      const next = new Set(autofilledIdsRef.current)
      next.delete(fieldId)
      updateAutofilled(next)
    },
    [updateAutofilled]
  )

  const reset = useCallback(() => {
    requestSeqRef.current++
    lookedUpCpfRef.current = ''
    updateAutofilled(new Set())
    setCpfCheckSkipped(false)
    setState('idle')
  }, [updateAutofilled])

  return {
    state,
    autofilledFieldIds,
    cpfCheckSkipped,
    canSubmit: SUBMIT_ENABLED.has(state),
    handleCpfChange,
    clearAutofillFlag,
    reset,
  }
}
