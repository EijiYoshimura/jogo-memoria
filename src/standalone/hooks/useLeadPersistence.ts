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
    })

    const success = await syncOnlineLead({
      eventId,
      data: formData,
      score,
      timeTaken,
      playedAt,
      consentedAt,
      consentVersion,
    })

    if (success) {
      await markSynced(localId)
    }
  }

  return { saveLead }
}
