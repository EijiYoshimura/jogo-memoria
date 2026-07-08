import type { GameConfig } from '../../game/types'
import type { LocalLead } from './leadsDb'
import type { RemoteLead } from './adminLeads'
import { applyCpfMask } from '../../lead-capture/mask/cpfMask'

/**
 * Colunas fixas anexadas após os campos dinâmicos do `leadForm`. `cpf` vem da coluna
 * dedicada (nunca do `data`) e sai formatada com pontuação padrão (`123.456.789-00`)
 * via `applyCpfMask` — os 11 dígitos permanecem 100% visíveis, sem redação (HUB-149).
 */
const FIXED_HEADERS = ['cpf', 'played_at', 'score', 'time_taken', 'synced_from'] as const

/** Rótulo de origem dos leads lidos do IndexedDB local. */
const LOCAL_SYNCED_FROM = 'offline-sync'
/** Fallback de origem quando a linha remota não traz `synced_from`. */
const REMOTE_SYNCED_FROM = 'online'

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function numberToCell(value: number | null): string {
  return value == null ? '' : String(value)
}

/**
 * Formata o CPF para exibição completa no CSV (`123.456.789-00`), reaproveitando a
 * máscara de digitação do formulário. CPF nulo/vazio vira célula vazia — `applyCpfMask`
 * não é chamada nesse caso para não depender do comportamento dela com string vazia.
 */
function cpfToCell(cpf: string | null): string {
  return cpf ? applyCpfMask(cpf) : ''
}

/**
 * Monta o CSV dos leads a partir das linhas remotas (autorizadas via RPC) e das
 * linhas locais (IndexedDB). Função pura — não toca em rede, DOM ou Supabase.
 *
 * Online: `remoteLeads` = retorno autorizado da RPC; `localLeads` = apenas os
 * pendentes (ainda não sincronizados). Offline: `remoteLeads` = `[]`;
 * `localLeads` = todos os leads do dispositivo (`getAllLeads()`).
 */
export function buildLeadsCsv(
  config: GameConfig,
  remoteLeads: RemoteLead[],
  localLeads: LocalLead[],
): string {
  const fieldIds = config.leadForm.fields.map((field) => field.id)
  const fieldLabels = config.leadForm.fields.map((field) => field.label)
  const headers = [...fieldLabels, ...FIXED_HEADERS]

  const rows: string[][] = []

  for (const lead of remoteLeads) {
    rows.push([
      ...fieldIds.map((id) => lead.data[id] ?? ''),
      cpfToCell(lead.cpf),
      lead.played_at ?? '',
      numberToCell(lead.score),
      numberToCell(lead.time_taken),
      lead.synced_from ?? REMOTE_SYNCED_FROM,
    ])
  }

  for (const lead of localLeads) {
    rows.push([
      ...fieldIds.map((id) => lead.data[id] ?? ''),
      cpfToCell(lead.cpf),
      lead.playedAt,
      String(lead.score),
      String(lead.timeTaken),
      LOCAL_SYNCED_FROM,
    ])
  }

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n')
}
