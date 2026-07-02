import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONSENT_VERSION,
  DEFAULT_PURPOSE_TEXT,
  DEFAULT_RETENTION_MONTHS,
  buildConsentText,
  getPurposeText,
} from '../lgpd'
import type { GameConfig } from '../../../game/types'

const baseConfig: GameConfig = {
  event: {
    id: 'test-event',
    name: 'Evento Teste',
    logo: 'https://example.com/logo.png',
    primaryColor: '#7C3AED',
    backgroundColor: '#1E1B4B',
  },
  game: { pairs: 6, cardImages: [], cardBack: '', timeLimitSeconds: 60 },
  leadForm: { title: 'Preencha seus dados', fields: [] },
  offlineExportPin: '1234',
}

const withLgpd = (overrides: Partial<NonNullable<GameConfig['lgpd']>>): GameConfig => ({
  ...baseConfig,
  lgpd: {
    consentVersion: '1.0',
    dataController: 'Empresa',
    purposeText: 'para contato',
    retentionMonths: 12,
    ...overrides,
  },
})

describe('constantes LGPD', () => {
  it('DEFAULT_CONSENT_VERSION é "default"', () => {
    expect(DEFAULT_CONSENT_VERSION).toBe('default')
  })
  it('defaults de propósito e retenção', () => {
    expect(DEFAULT_PURPOSE_TEXT).toBe('para entrar em contato sobre as novidades do evento')
    expect(DEFAULT_RETENTION_MONTHS).toBe(12)
  })
})

describe('buildConsentText — templado', () => {
  it('usa o dataController do config.lgpd quando fornecido', () => {
    const text = buildConsentText(withLgpd({ dataController: 'Empresa LGPD Ltda' }))
    expect(text).toContain('Empresa LGPD Ltda')
    expect(text).toMatch(/você autoriza/i)
  })

  it('usa o nome do evento como dataController quando lgpd não definido', () => {
    const text = buildConsentText(baseConfig)
    expect(text).toMatch(/você autoriza/i)
    expect(text).toContain('Evento Teste')
  })

  it('exibe purposeText customizado quando definido', () => {
    const text = buildConsentText(withLgpd({ purposeText: 'para fins exclusivos de pesquisa' }))
    expect(text).toContain('para fins exclusivos de pesquisa')
  })

  it('usa purposeText default quando lgpd não definido', () => {
    expect(buildConsentText(baseConfig)).toContain(
      'para entrar em contato sobre as novidades do evento'
    )
  })

  it('exibe retentionMonths do config quando definido (plural)', () => {
    expect(buildConsentText(withLgpd({ retentionMonths: 6 }))).toContain('6 meses')
  })

  it('singulariza "mês" quando retentionMonths é 1', () => {
    const text = buildConsentText(withLgpd({ retentionMonths: 1 }))
    expect(text).toContain('1 mês')
    expect(text).not.toContain('1 meses')
  })
})

describe('buildConsentText — custom (HUB-60)', () => {
  const customText =
    'Eu autorizo o tratamento dos meus dados pessoais.\nPosso revogar a qualquer momento.'

  it('retorna o texto custom e NÃO os parágrafos templados quando consentText presente', () => {
    const text = buildConsentText(withLgpd({ consentText: customText }))
    expect(text).toBe(customText)
    expect(text).not.toMatch(/você autoriza/i)
  })

  it('preserva quebras de linha do texto custom', () => {
    expect(buildConsentText(withLgpd({ consentText: customText }))).toContain('\n')
  })

  it('trata consentText apenas com espaços como ausente (retrocompat)', () => {
    expect(buildConsentText(withLgpd({ consentText: '   \n  ' }))).toMatch(/você autoriza/i)
  })

  it('fallback seguro sem config.lgpd: não lança e usa event.name', () => {
    expect(() => buildConsentText(baseConfig)).not.toThrow()
    expect(buildConsentText(baseConfig)).toContain('Evento Teste')
  })
})

describe('getPurposeText (HUB-74)', () => {
  it('retorna o purposeText do config quando definido', () => {
    expect(getPurposeText(withLgpd({ purposeText: 'para fins de pesquisa' }))).toBe(
      'para fins de pesquisa'
    )
  })

  it('usa o DEFAULT_PURPOSE_TEXT quando lgpd não definido', () => {
    expect(getPurposeText(baseConfig)).toBe(DEFAULT_PURPOSE_TEXT)
  })

  it('usa o DEFAULT_PURPOSE_TEXT quando purposeText é vazio/espacos', () => {
    expect(getPurposeText(withLgpd({ purposeText: '   ' }))).toBe(DEFAULT_PURPOSE_TEXT)
  })

  it('é independente do consentText custom (sempre disponível)', () => {
    const config = withLgpd({
      consentText: 'Texto custom de consentimento.',
      purposeText: 'para contato comercial',
    })
    expect(getPurposeText(config)).toBe('para contato comercial')
  })
})
