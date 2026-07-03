// Orquestra a consulta online de participações por CPF (HUB-87 §4). Sem React: recebe
// o `eventId` e o CPF sanitizado (11 dígitos) e devolve um resultado discriminado. A
// consulta online é sempre a primeira ação; qualquer indisponibilidade (offline,
// timeout de 3s ou erro de rede) vira `offline-fallback` — nunca lança, nunca bloqueia
// o totem por indisponibilidade (Cenário 6, fallback permissivo).

import { supabase } from './supabaseClient'

export type CpfLookupResult =
  | { status: 'found'; participationCount: number; lastLeadData: Record<string, string> | null }
  | { status: 'not-found' }
  | { status: 'offline-fallback'; reason: 'timeout' | 'network-error' | 'offline' }

/** Timeout de negócio da consulta online (HUB-87 §4). Decisão travada — não configurável. */
export const CPF_LOOKUP_TIMEOUT_MS = 3000

/** Sentinela do braço de timeout na corrida contra a RPC. */
const TIMEOUT = Symbol('cpf-lookup-timeout')

/** Uma linha do retorno mínimo da RPC `check_cpf_participation` (HUB-89). */
interface ParticipationRow {
  participation_count: number
  last_lead_data: Record<string, string> | null
}

interface RpcResponse {
  data: ParticipationRow[] | null
  error: { message: string } | null
}

/**
 * Consulta quantas vezes um CPF já participou de um evento. Corrida entre a RPC e um
 * timeout de 3s; quando o dispositivo já está sabidamente offline, curto-circuita sem
 * esperar o timeout inteiro (não reabre a decisão de negócio do timeout — só evita
 * espera artificial). Erro/timeout/offline ⇒ `offline-fallback` (tratado como CPF novo
 * pelo gate, liberando o fluxo).
 */
export async function checkCpfParticipation(
  eventId: string,
  cpf: string
): Promise<CpfLookupResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'offline-fallback', reason: 'offline' }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timeoutId = setTimeout(() => resolve(TIMEOUT), CPF_LOOKUP_TIMEOUT_MS)
  })

  const query = supabase.rpc('check_cpf_participation', {
    p_event_id: eventId,
    p_cpf: cpf,
  }) as unknown as Promise<RpcResponse>

  const outcome = await Promise.race([query, timeout])
  if (timeoutId !== undefined) clearTimeout(timeoutId)

  if (outcome === TIMEOUT) {
    return { status: 'offline-fallback', reason: 'timeout' }
  }

  const { data, error } = outcome
  if (error) {
    return { status: 'offline-fallback', reason: 'network-error' }
  }

  const row = data?.[0]
  if (!row || row.participation_count === 0) {
    return { status: 'not-found' }
  }
  return {
    status: 'found',
    participationCount: row.participation_count,
    lastLeadData: row.last_lead_data,
  }
}
