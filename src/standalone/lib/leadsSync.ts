import { supabase } from './supabaseClient'
import { getPendingLeads, markSynced } from './leadsDb'
import type { LocalLead } from './leadsDb'

export async function syncLead(lead: LocalLead): Promise<boolean> {
  const { error } = await supabase.from('leads').insert({
    event_id: lead.eventId,
    data: lead.data,
    score: lead.score,
    time_taken: lead.timeTaken,
    played_at: lead.playedAt,
    synced_from: 'offline-sync',
    consented_at: lead.consentedAt,
    consent_version: lead.consentVersion,
    // Retrocompatível: leads bufferados antes do HUB-92 não têm estes campos no
    // IndexedDB (undefined em runtime) — normalizados para os defaults das colunas.
    cpf: lead.cpf ?? null,
    cpf_check_skipped: lead.cpfCheckSkipped ?? false,
    max_participations_at_submit: lead.maxParticipationsAtSubmit ?? null,
  })

  return !error
}

export async function syncOnlineLead(lead: Omit<LocalLead, 'localId' | 'synced'>): Promise<boolean> {
  const { error } = await supabase.from('leads').insert({
    event_id: lead.eventId,
    data: lead.data,
    score: lead.score,
    time_taken: lead.timeTaken,
    played_at: lead.playedAt,
    synced_from: 'online',
    consented_at: lead.consentedAt,
    consent_version: lead.consentVersion,
    cpf: lead.cpf,
    cpf_check_skipped: lead.cpfCheckSkipped,
    max_participations_at_submit: lead.maxParticipationsAtSubmit,
  })

  return !error
}

export async function syncPendingLeads(): Promise<void> {
  const pending = await getPendingLeads()
  for (const lead of pending) {
    if (lead.localId === undefined) continue
    const success = await syncLead(lead)
    if (success) {
      await markSynced(lead.localId)
    }
  }
}
