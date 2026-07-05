// Reconciliação offline → online (HUB-87 §7). Função pura, sem I/O.
//
// Toda participação que passou pelo fallback offline (`cpfCheckSkipped = true`) foi
// gravada sem a confirmação online de que o limite ainda não havia sido excedido.
// Este relatório agrupa as jogadas por `(eventId, cpf)` e aponta os grupos cujo total
// ultrapassou o limite configurado, para a apuração humana do sorteio decidir o que
// fazer. É estritamente informativo: nenhuma participação é revertida (Critério 7).

import { isForeignCpf } from '../../lead-capture/cpf/constants'

/** `maxParticipationsAtSubmit = 0` significa ilimitado — nunca gera excedente (§1). */
const UNLIMITED = 0

/** Uma linha de `leads` reduzida aos campos que a reconciliação inspeciona. */
export interface ReconciliationLead {
  cpf: string | null
  eventId: string
  cpfCheckSkipped: boolean
  maxParticipationsAtSubmit: number | null
}

/** Um grupo `(eventId, cpf)` cujo total de participações excedeu o limite de referência. */
export interface ParticipationOverage {
  cpf: string
  eventId: string
  totalParticipations: number
  limit: number
  /** Quantas das participações do grupo tinham `cpfCheckSkipped = true`. */
  offlineParticipations: number
}

interface GroupAccumulator {
  cpf: string
  eventId: string
  totalParticipations: number
  offlineParticipations: number
  /** `maxParticipationsAtSubmit` mais recente (não-nulo) visto no grupo. */
  referenceLimit: number | null
}

/** Chave estável de grupo; o separador \0 (NUL) não colide com CPF nem eventId. */
function groupKey(eventId: string, cpf: string): string {
  return `${eventId}\0${cpf}`
}

function accumulate(group: GroupAccumulator, lead: ReconciliationLead): void {
  group.totalParticipations += 1
  if (lead.cpfCheckSkipped) group.offlineParticipations += 1
  // "mais recente" = última linha do grupo, na ordem de entrada, que traz um limite
  // definido; uma linha legada com limite nulo não apaga um limite já conhecido.
  if (lead.maxParticipationsAtSubmit !== null) {
    group.referenceLimit = lead.maxParticipationsAtSubmit
  }
}

/**
 * Retorna apenas os grupos `(eventId, cpf)` cujo total de participações excedeu o
 * limite de referência. Ignora linhas sem CPF, grupos ilimitados (`limit = 0`) e
 * grupos sem nenhum limite conhecido (todas as linhas com `maxParticipationsAtSubmit`
 * nulo — sem base para apurar excedente).
 */
export function findParticipationOverages(
  leads: ReconciliationLead[],
): ParticipationOverage[] {
  const groups = new Map<string, GroupAccumulator>()

  for (const lead of leads) {
    if (lead.cpf === null) continue // linhas sem CPF não entram no relatório (§7)
    // Exclusão na entrada (defesa em profundidade): o grupo do código estrangeiro
    // nunca se forma — participação sem limite por design (HUB-109).
    if (isForeignCpf(lead.cpf)) continue

    const key = groupKey(lead.eventId, lead.cpf)
    const group =
      groups.get(key) ??
      {
        cpf: lead.cpf,
        eventId: lead.eventId,
        totalParticipations: 0,
        offlineParticipations: 0,
        referenceLimit: null,
      }

    accumulate(group, lead)
    groups.set(key, group)
  }

  const overages: ParticipationOverage[] = []
  for (const group of groups.values()) {
    const limit = group.referenceLimit
    if (limit === null) continue // sem limite conhecido → não há como apurar excedente
    if (limit === UNLIMITED) continue // ilimitado nunca excede
    if (group.totalParticipations <= limit) continue

    overages.push({
      cpf: group.cpf,
      eventId: group.eventId,
      totalParticipations: group.totalParticipations,
      limit,
      offlineParticipations: group.offlineParticipations,
    })
  }

  return overages
}
