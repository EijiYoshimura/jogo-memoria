import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TermsModal } from '../TermsModal'
import { DEFAULT_PURPOSE_TEXT } from '../lib/lgpd'
import type { GameConfig } from '../../game/types'

const baseConfig: GameConfig = {
  event: {
    id: 'evento-demo-2026',
    name: 'Evento Demo',
    logo: '/images/logo_bb.png',
    primaryColor: '#7C3AED',
    backgroundColor: '#0333BD',
  },
  game: { pairs: 6, cardImages: [], cardBack: '', timeLimitSeconds: 60 },
  leadForm: { title: 'Preencha seus dados', fields: [] },
  adminPin: '1234',
  lgpd: {
    consentVersion: '1.0',
    dataController: 'Evento Demo Ltda',
    // Após HUB-77: purposeText carrega a POLÍTICA DE PRIVACIDADE completa.
    purposeText:
      'POLÍTICA DE PRIVACIDADE\n1. DOS DADOS COLETADOS\nColetamos nome, e-mail e telefone.',
    retentionMonths: 12,
    // Após HUB-77: consentText carrega os TERMOS DE USO completos.
    consentText:
      'TERMOS E CONDIÇÕES DE USO\nCLÁUSULA PRIMEIRA\nO participante adere a estas condições.',
  },
}

const withLgpd = (
  overrides: Partial<NonNullable<GameConfig['lgpd']>>
): GameConfig => ({
  ...baseConfig,
  lgpd: { ...baseConfig.lgpd!, ...overrides },
})

afterEach(() => {
  cleanup()
})

describe('TermsModal', () => {
  it('renderiza como dialog acessível com o título do modal', () => {
    render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(
      screen.getByRole('heading', { name: 'Termos de uso e política de privacidade' })
    ).toBeDefined()
  })

  it('aplica 80% de largura no card (w-[80%] max-w-none, sem max-w-md)', () => {
    render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('w-[80%]')
    expect(dialog.className).toContain('max-w-none')
    expect(dialog.className).not.toContain('max-w-md')
    expect(dialog.className).toContain('max-h-[80vh]')
  })

  it('exibe o bloco "Termos de Uso" com o consentText', () => {
    render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    const heading = screen.getByRole('heading', { name: 'Termos de Uso' })
    expect(heading).toBeDefined()
    expect(screen.getByText(/O participante adere a estas condições/i)).toBeDefined()
  })

  it('exibe o bloco "Política de Privacidade" com o purposeText, separado por divisória', () => {
    render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    const heading = screen.getByRole('heading', { name: 'Política de Privacidade' })
    expect(heading).toBeDefined()
    expect(screen.getByText(/Coletamos nome, e-mail e telefone/i)).toBeDefined()
    // separado visualmente: a divisória vive no container do bloco da política
    const block = heading.parentElement
    expect(block?.className).toContain('border-t')
    expect(block?.className).toContain('pt-4')
  })

  it('renderiza os dois blocos com os textos nos rótulos corretos', () => {
    render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Termos de Uso' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Política de Privacidade' })).toBeDefined()
    expect(screen.getByText(/CLÁUSULA PRIMEIRA/i)).toBeDefined()
    expect(screen.getByText(/DOS DADOS COLETADOS/i)).toBeDefined()
  })

  it('usa o purposeText default quando ausente no config', () => {
    render(<TermsModal config={withLgpd({ purposeText: '' })} onClose={vi.fn()} />)
    expect(screen.getByText(DEFAULT_PURPOSE_TEXT)).toBeDefined()
  })

  it('fecha ao clicar no X do cabeçalho', () => {
    const onClose = vi.fn()
    render(<TermsModal config={baseConfig} onClose={onClose} />)
    // O X é o primeiro botão "Fechar" (aria-label); o do rodapé é o último.
    const fecharButtons = screen.getAllByRole('button', { name: /Fechar/i })
    fireEvent.click(fecharButtons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha ao clicar no botão Fechar do rodapé', () => {
    const onClose = vi.fn()
    render(<TermsModal config={baseConfig} onClose={onClose} />)
    const fecharButtons = screen.getAllByRole('button', { name: /Fechar/i })
    fireEvent.click(fecharButtons[fecharButtons.length - 1])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha ao clicar no overlay, mas não ao clicar no card', () => {
    const onClose = vi.fn()
    render(<TermsModal config={baseConfig} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha ao pressionar Esc', () => {
    const onClose = vi.fn()
    render(<TermsModal config={baseConfig} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('trava o scroll do body enquanto montado e restaura no unmount', () => {
    const { unmount } = render(<TermsModal config={baseConfig} onClose={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('exibe o link da Política de Privacidade (path interno)', () => {
    render(
      <TermsModal
        config={withLgpd({ privacyPolicyPath: '/privacy-policy.html' })}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Política de Privacidade/i })).toBeDefined()
  })

  it('abre a tela de Política de Privacidade ao clicar no link interno', () => {
    render(
      <TermsModal
        config={withLgpd({ privacyPolicyPath: '/privacy-policy.html' })}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Ler Política de Privacidade/i }))
    expect(screen.getByRole('heading', { name: 'Política de Privacidade' })).toBeDefined()
  })
})
