import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/**
 * Uma linha de `leads` como retornada pela RPC `admin_list_leads` (SETOF leads).
 * Espelha as colunas consumidas pela exportação — não é o `LocalLead` do IndexedDB.
 */
export interface RemoteLead {
  event_id: string
  data: Record<string, string>
  score: number | null
  time_taken: number | null
  played_at: string | null
  synced_from: string | null
  // Antifraude por CPF (HUB-87). A RPC retorna `SETOF leads`, então estas colunas já
  // vêm no mesmo payload — reaproveitadas pela reconciliação sem nova chamada de rede.
  cpf: string | null
  cpf_check_skipped: boolean | null
  max_participations_at_submit: number | null
}

/**
 * Resultado da tentativa de listagem autorizada dos leads do Admin.
 * - `authorized`: segredo correto; `leads` são as linhas do evento.
 * - `unauthorized`: segredo ausente/errado (RPC levantou `unauthorized`).
 * - `offline`: sem rede; a leitura remota não é possível (usar o gate offline).
 */
export type AdminLeadsResult =
  | { status: 'authorized'; leads: RemoteLead[] }
  | { status: 'unauthorized' }
  | { status: 'offline' }

/** SQLSTATE levantado pela RPC no caminho não autorizado (ADR-012 / spec §3). */
const UNAUTHORIZED_SQLSTATE = '28000'
const UNAUTHORIZED_MESSAGE = 'unauthorized'

function isUnauthorizedError(error: PostgrestError): boolean {
  return error.code === UNAUTHORIZED_SQLSTATE || error.message === UNAUTHORIZED_MESSAGE
}

/**
 * Lista os leads de um evento via RPC `admin_list_leads`, que verifica o segredo
 * no servidor (bcrypt) ANTES de retornar qualquer linha (ADR-012). A `anon key`
 * sozinha não basta: sem o segredo correto, nenhuma linha volta.
 *
 * O erro `unauthorized` é mapeado para um resultado tratável; qualquer outro erro
 * (rede/inesperado) é **propagado** — nunca silenciado (Regras Invioláveis 7/8).
 */
export async function listAdminLeads(
  eventId: string,
  secret: string,
): Promise<AdminLeadsResult> {
  if (!navigator.onLine) return { status: 'offline' }

  const { data, error } = await supabase.rpc('admin_list_leads', {
    p_event_id: eventId,
    p_secret: secret,
  })

  if (error) {
    if (isUnauthorizedError(error)) return { status: 'unauthorized' }
    throw error
  }

  return { status: 'authorized', leads: (data ?? []) as RemoteLead[] }
}

/**
 * Resultado da tentativa de exclusão definitiva dos leads de um evento.
 * - `purged`: segredo correto; `purgedCount` é a contagem confirmada pelo servidor
 *   (nunca calculada no cliente — ver ADR-015).
 * - `unauthorized`: segredo ausente/errado (RPC levantou `unauthorized`).
 * - `offline`: sem rede; a exclusão remota não é possível.
 */
export type AdminPurgeResult =
  | { status: 'purged'; purgedCount: number }
  | { status: 'unauthorized' }
  | { status: 'offline' }

/**
 * Executa a exclusão definitiva dos leads de um evento via RPC `admin_purge_leads`
 * (HUB-151/ADR-015): função só-delete, `SECURITY DEFINER`, que não retorna linhas — o
 * export já deve ter ocorrido antes, via `listAdminLeads` (duas chamadas sequenciais
 * decididas em ADR-015, não uma RPC atômica única).
 *
 * Mesmo padrão de tratamento de erro de `listAdminLeads`: checa `navigator.onLine` antes
 * de chamar; mapeia `unauthorized` (SQLSTATE 28000) para um resultado tratável; qualquer
 * outro erro (ex.: `invalid device id`, rede) é **propagado** — nunca silenciado (Regras
 * Invioláveis 7/8).
 */
export async function purgeAdminLeads(
  eventId: string,
  secret: string,
  deviceId: string,
  exportFilename: string,
): Promise<AdminPurgeResult> {
  if (!navigator.onLine) return { status: 'offline' }

  const { data, error } = await supabase.rpc('admin_purge_leads', {
    p_event_id: eventId,
    p_secret: secret,
    p_device_id: deviceId,
    p_export_filename: exportFilename,
  })

  if (error) {
    if (isUnauthorizedError(error)) return { status: 'unauthorized' }
    throw error
  }

  return { status: 'purged', purgedCount: data as number }
}
