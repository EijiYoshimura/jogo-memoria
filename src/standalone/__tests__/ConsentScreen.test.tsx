import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsentScreen, DEFAULT_CONSENT_VERSION } from '../ConsentScreen'
import type { GameConfig } from '../../game/types'

const baseConfig: GameConfig = {
  event: {
    id: 'test-event',
    name: 'Evento Teste',
    logo: 'https://example.com/logo.png',
    primaryColor: '#7C3AED',
    backgroundColor: '#1E1B4B',
  },
  game: {
    pairs: 6,
    cardImages: [],
    cardBack: '',
    timeLimitSeconds: 60,
  },
  leadForm: {
    title: 'Preencha seus dados',
    fields: [],
  },
  adminPin: '1234',
}

describe('ConsentScreen', () => {
  it('exibe o nome e logo do evento', () => {
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.getByRole('heading', { name: 'Evento Teste' })).toBeDefined()
    expect(screen.getByAltText('Logo Evento Teste')).toBeDefined()
  })

  it('usa o dataController do config.lgpd quando fornecido', () => {
    const config: GameConfig = {
      ...baseConfig,
      lgpd: {
        consentVersion: '1.0',
        dataController: 'Empresa LGPD Ltda',
        purposeText: 'para fins de marketing',
        retentionMonths: 6,
      },
    }
    render(
      <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.getByText(/Empresa LGPD Ltda/)).toBeDefined()
  })

  it('usa o nome do evento como dataController quando lgpd não definido', () => {
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    // dataController default = event.name, aparece dentro do texto de autorização
    const authText = screen.getByText(/você autoriza/i)
    expect(authText.textContent).toContain('Evento Teste')
  })

  it('exibe purposeText customizado quando definido', () => {
    const config: GameConfig = {
      ...baseConfig,
      lgpd: {
        consentVersion: '1.0',
        dataController: 'Empresa',
        purposeText: 'para fins exclusivos de pesquisa',
        retentionMonths: 12,
      },
    }
    render(
      <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.getByText(/para fins exclusivos de pesquisa/)).toBeDefined()
  })

  it('usa purposeText default quando lgpd não definido', () => {
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.getByText(/para entrar em contato sobre as novidades do evento/)).toBeDefined()
  })

  it('exibe retentionMonths do config quando definido', () => {
    const config: GameConfig = {
      ...baseConfig,
      lgpd: {
        consentVersion: '1.0',
        dataController: 'Empresa',
        purposeText: 'para contato',
        retentionMonths: 6,
      },
    }
    render(
      <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.getByText(/6 meses/)).toBeDefined()
  })

  it('exibe link de Política de Privacidade quando privacyPolicyUrl está preenchido', () => {
    const config: GameConfig = {
      ...baseConfig,
      lgpd: {
        consentVersion: '1.0',
        dataController: 'Empresa',
        purposeText: 'para contato',
        retentionMonths: 12,
        privacyPolicyUrl: 'https://empresa.com/privacidade',
      },
    }
    render(
      <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    const link = screen.getByRole('link', { name: /Política de Privacidade/i })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('https://empresa.com/privacidade')
  })

  it('não exibe link de Política de Privacidade quando privacyPolicyUrl está vazio', () => {
    const config: GameConfig = {
      ...baseConfig,
      lgpd: {
        consentVersion: '1.0',
        dataController: 'Empresa',
        purposeText: 'para contato',
        retentionMonths: 12,
        privacyPolicyUrl: '',
      },
    }
    render(
      <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('não exibe link de Política de Privacidade quando privacyPolicyUrl não está definido', () => {
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('chama onAccept ao clicar em "Participar e aceitar"', () => {
    const onAccept = vi.fn()
    render(
      <ConsentScreen config={baseConfig} onAccept={onAccept} onDecline={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Participar e aceitar/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('chama onDecline ao clicar em "Jogar sem participar"', () => {
    const onDecline = vi.fn()
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={onDecline} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Jogar sem participar/i }))
    expect(onDecline).toHaveBeenCalledTimes(1)
  })

  it('botão aceitar usa primaryColor como backgroundColor', () => {
    render(
      <ConsentScreen config={baseConfig} onAccept={vi.fn()} onDecline={vi.fn()} />
    )
    const acceptBtn = screen.getByRole('button', { name: /Participar e aceitar/i })
    // jsdom converte hex para rgb ao computar o style
    const style = acceptBtn.getAttribute('style') ?? ''
    expect(style).toContain('rgb(124, 58, 237)')
  })

  it('DEFAULT_CONSENT_VERSION é "default"', () => {
    expect(DEFAULT_CONSENT_VERSION).toBe('default')
  })

  describe('consentText customizado (HUB-60)', () => {
    const customText =
      'Eu autorizo o tratamento dos meus dados pessoais.\nPosso revogar a qualquer momento.'

    it('renderiza o texto custom e NÃO os parágrafos templados quando consentText presente', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '2.0',
          dataController: 'Empresa LGPD Ltda',
          purposeText: 'para fins de marketing',
          retentionMonths: 6,
          consentText: customText,
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      expect(
        screen.getByText(/Eu autorizo o tratamento dos meus dados pessoais/),
      ).toBeDefined()
      // parágrafos templados não aparecem
      expect(screen.queryByText(/você autoriza/i)).toBeNull()
      expect(screen.queryByText(/Seus dados serão armazenados/i)).toBeNull()
      // cabeçalho e botões preservados (AC4)
      expect(screen.getByText(/Antes de jogar/i)).toBeDefined()
      expect(
        screen.getByRole('button', { name: /Participar e aceitar/i }),
      ).toBeDefined()
      expect(
        screen.getByRole('button', { name: /Jogar sem participar/i }),
      ).toBeDefined()
    })

    it('aplica white-space: pre-line para preservar quebras de linha', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '2.0',
          dataController: 'Empresa',
          purposeText: 'para contato',
          retentionMonths: 12,
          consentText: customText,
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      const paragraph = screen.getByText(/Eu autorizo o tratamento/)
      expect(paragraph.getAttribute('style')).toContain('pre-line')
    })

    it('não injeta HTML — markup no consentText é renderizado como texto puro (AC3)', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '2.0',
          dataController: 'Empresa',
          purposeText: 'para contato',
          retentionMonths: 12,
          consentText: 'Aceito <b>tudo</b> conforme a LGPD.',
        },
      }
      const { container } = render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      // a tag <b> não vira elemento real — fica como texto escapado
      expect(container.querySelector('b')).toBeNull()
      expect(screen.getByText(/Aceito <b>tudo<\/b> conforme a LGPD\./)).toBeDefined()
    })

    it('mantém parágrafos templados quando consentText ausente (retrocompat AC5)', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '1.0',
          dataController: 'Empresa LGPD Ltda',
          purposeText: 'para fins de marketing',
          retentionMonths: 6,
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      expect(screen.getByText(/você autoriza/i)).toBeDefined()
      expect(screen.getByText(/6 meses/)).toBeDefined()
    })

    it('trata consentText apenas com espaços como ausente (retrocompat)', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '1.0',
          dataController: 'Empresa',
          purposeText: 'para contato',
          retentionMonths: 12,
          consentText: '   \n  ',
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      expect(screen.getByText(/você autoriza/i)).toBeDefined()
    })

    it('exibe o link privacyPolicyUrl no modo custom quando presente (AC4)', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '2.0',
          dataController: 'Empresa',
          purposeText: 'para contato',
          retentionMonths: 12,
          privacyPolicyUrl: 'https://empresa.com/privacidade',
          consentText: customText,
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      const link = screen.getByRole('link', { name: /Política de Privacidade/i })
      expect(link.getAttribute('href')).toBe('https://empresa.com/privacidade')
    })

    it('exibe o link privacyPolicyUrl no modo templado quando presente (AC4)', () => {
      const config: GameConfig = {
        ...baseConfig,
        lgpd: {
          consentVersion: '1.0',
          dataController: 'Empresa',
          purposeText: 'para contato',
          retentionMonths: 12,
          privacyPolicyUrl: 'https://empresa.com/privacidade',
        },
      }
      render(
        <ConsentScreen config={config} onAccept={vi.fn()} onDecline={vi.fn()} />
      )
      const link = screen.getByRole('link', { name: /Política de Privacidade/i })
      expect(link.getAttribute('href')).toBe('https://empresa.com/privacidade')
    })
  })
})
