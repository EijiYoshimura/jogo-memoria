import { useEffect } from 'react'
import { saveLead as saveLeadToDb } from '../lib/leadsDb'
import { syncOnlineLead, syncPendingLeads } from '../lib/leadsSync'
import { markSynced } from '../lib/leadsDb'

const SYNC_INTERVAL_MS = 30_000

interface SaveLeadParams {
  eventId: string
  formData: Record<string, string>
  score: number
  timeTaken: number
  consentedAt: string
  consentVersion: string
  /** CPF sanitizado (11 dígitos) do participante — coluna dedicada, fora do `data` (HUB-87 §1). */
  cpf: string
  /** `true` quando a checagem online de dedup não pôde ser concluída (fallback offline). */
  cpfCheckSkipped: boolean
  /** Snapshot do limite de participações vigente no submit — insumo da reconciliação. */
  maxParticipationsAtSubmit: number
}

export function useLeadPersistence() {
  useEffect(() => {
    window.addEventListener('online', syncPendingLeads)
    const interval = setInterval(syncPendingLeads, SYNC_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', syncPendingLeads)
      clearInterval(interval)
    }
  }, [])

  async function saveLead({
    eventId,
    formData,
    score,
    timeTaken,
    consentedAt,
    consentVersion,
    cpf,
    cpfCheckSkipped,
    maxParticipationsAtSubmit,
  }: SaveLeadParams): Promise<void> {
    const playedAt = new Date().toISOString()

    const localId = await saveLeadToDb({
      eventId,
      data: formData,
      score,
      timeTaken,
      playedAt,
      synced: false,
      consentedAt,
      consentVersion,
      cpf,
      cpfCheckSkipped,
      maxParticipationsAtSubmit,
    })

    const success = await syncOnlineLead({
      eventId,
      data: formData,
      score,
      timeTaken,
      playedAt,
      consentedAt,
      consentVersion,
      cpf,
      cpfCheckSkipped,
      maxParticipationsAtSubmit,
    })

    if (success) {
      await markSynced(localId)
    }
  }

  return { saveLead }
}
