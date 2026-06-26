import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacyPolicyScreen } from '../PrivacyPolicyScreen'

const defaultProps = {
  privacyPolicyPath: '/privacy-policy.html',
  primaryColor: '#7C3AED',
  backgroundColor: '#1E1B4B',
  onBack: vi.fn(),
}

describe('PrivacyPolicyScreen', () => {
  it('exibe o cabeçalho "Política de Privacidade"', () => {
    render(<PrivacyPolicyScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Política de Privacidade' })).toBeDefined()
  })

  it('renderiza o iframe com src do path, title e sandbox sem permissões (AC3)', () => {
    const { container } = render(<PrivacyPolicyScreen {...defaultProps} />)
    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toBe('/privacy-policy.html')
    expect(iframe?.getAttribute('title')).toBe('Política de Privacidade')
    // sandbox vazio = máxima restrição; nunca contém allow-scripts/forms/popups
    const sandbox = iframe?.getAttribute('sandbox') ?? null
    expect(sandbox).toBe('')
    expect(sandbox).not.toContain('allow-scripts')
  })

  it('botão "← Voltar" chama onBack (AC2)', () => {
    const onBack = vi.fn()
    render(<PrivacyPolicyScreen {...defaultProps} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('botão "← Voltar" respeita o alvo mínimo de 44px (AC2)', () => {
    render(<PrivacyPolicyScreen {...defaultProps} />)
    const style = screen.getByRole('button', { name: /Voltar/i }).getAttribute('style') ?? ''
    expect(style).toContain('min-height: 44px')
    expect(style).toContain('min-width: 44px')
  })

  it('botão "← Voltar" usa a primaryColor do evento (AC2)', () => {
    render(<PrivacyPolicyScreen {...defaultProps} />)
    const style = screen.getByRole('button', { name: /Voltar/i }).getAttribute('style') ?? ''
    // jsdom converte hex para rgb
    expect(style).toContain('rgb(124, 58, 237)')
  })
})
