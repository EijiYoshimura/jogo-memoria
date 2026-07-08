import { openDB } from 'idb'

const DB_NAME = 'jogo-memoria-db'
const STORE_NAME = 'leads-queue'
const DB_VERSION = 1

export interface LocalLead {
  localId?: number
  eventId: string
  data: Record<string, string>
  score: number
  timeTaken: number
  playedAt: string
  synced: boolean
  consentedAt: string
  consentVersion: string
  // Antifraude por CPF (HUB-87). Campos adicionais — sem bump de DB_VERSION (mesmo
  // precedente de consentedAt/consentVersion): leads legados no IndexedDB podem não
  // tê-los, e o consumo trata a ausência (undefined) de forma retrocompatível.
  cpf: string | null
  cpfCheckSkipped: boolean
  maxParticipationsAtSubmit: number | null
}

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true })
      }
    },
  })
}

export async function saveLead(lead: Omit<LocalLead, 'localId'>): Promise<number> {
  const db = await getDb()
  return db.add(STORE_NAME, lead) as Promise<number>
}

export async function getPendingLeads(): Promise<LocalLead[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_NAME)
  return all.filter((lead) => !lead.synced)
}

export async function getAllLeads(): Promise<LocalLead[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function markSynced(localId: number): Promise<void> {
  const db = await getDb()
  const lead = await db.get(STORE_NAME, localId)
  if (lead) {
    await db.put(STORE_NAME, { ...lead, synced: true })
  }
}

/**
 * Remove deste dispositivo, do IndexedDB local, todos os leads (sincronizados e
 * pendentes) de um evento — parte da Limpeza de Leads (HUB-150/ADR-015), executada
 * **depois** da exclusão remota confirmada (`purgeAdminLeads`). Retorna a quantidade
 * removida, para exibição/telemetria.
 */
export async function deleteLeadsForEvent(eventId: string): Promise<number> {
  const db = await getDb()
  const all = await db.getAll(STORE_NAME)
  const matchingIds = all
    .filter((lead) => lead.eventId === eventId)
    .map((lead) => lead.localId)
    .filter((localId): localId is number => localId !== undefined)

  await Promise.all(matchingIds.map((localId) => db.delete(STORE_NAME, localId)))
  return matchingIds.length
}
