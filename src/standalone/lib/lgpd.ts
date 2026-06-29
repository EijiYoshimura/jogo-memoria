// Módulo LGPD puro (sem React/DOM): constantes + montagem do texto de consentimento.
// Fonte única de verdade do texto dos termos, consumida pelo TermsModal e pelo wiring
// de persistência em main. Migrado da antiga ConsentScreen (HUB-67).

import type { GameConfig } from '../../game/types'

export const DEFAULT_CONSENT_VERSION = 'default'
export const DEFAULT_PURPOSE_TEXT = 'para entrar em contato sobre as novidades do evento'
export const DEFAULT_RETENTION_MONTHS = 12

/**
 * Texto dos termos de consentimento.
 * Prioridade: `config.lgpd.consentText` custom (quando não-vazio) → texto templado a partir
 * de `dataController`/`purposeText`/`retentionMonths` → fallback seguro sem `config.lgpd`
 * (controlador = `event.name`, defaults). Retorna string pura com parágrafos separados por
 * `\n\n`, para renderização com `whitespace-pre-line` (sem HTML).
 */
export function buildConsentText(config: GameConfig): string {
  const { event, lgpd } = config
  const custom = lgpd?.consentText?.trim()
  if (custom) return custom

  const dataController = lgpd?.dataController ?? event.name
  const purposeText = lgpd?.purposeText ?? DEFAULT_PURPOSE_TEXT
  const retentionMonths = lgpd?.retentionMonths ?? DEFAULT_RETENTION_MONTHS
  const monthLabel = retentionMonths === 1 ? 'mês' : 'meses'

  return (
    `Ao aceitar, você autoriza ${dataController} a coletar e tratar seus dados pessoais ` +
    `${purposeText}, de acordo com a LGPD (Lei nº 13.709/2018).\n\n` +
    `Seus dados serão armazenados por até ${retentionMonths} ${monthLabel} e poderão ser ` +
    `excluídos a qualquer momento mediante solicitação.`
  )
}
