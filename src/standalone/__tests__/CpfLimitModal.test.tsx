import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CpfLimitModal } from '../CpfLimitModal'

afterEach(() => cleanup())

describe('CpfLimitModal', () => {
  it('renderiza como dialog acessível com título e corpo (Design §3.3)', () => {
    render(<CpfLimitModal accent="#FCFC30" onReset={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('cpf-limit-title')
    expect(dialog.getAttribute('aria-describedby')).toBe('cpf-limit-body')
    expect(screen.getByText('Você já participou!')).toBeDefined()
    // O texto também consta do anúncio sr-only; o corpo do modal é o parágrafo.
    expect(screen.getByText(/número máximo de participações/i, { selector: 'p' })).toBeDefined()
  })

  it('tem exatamente um botão de ação: "Próximo participante" (sem X, sem fechar)', () => {
    render(<CpfLimitModal accent="#FCFC30" onReset={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toMatch(/Próximo participante/i)
  })

  it('foca automaticamente o botão de ação ao abrir (Design §6)', () => {
    render(<CpfLimitModal accent="#FCFC30" onReset={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Próximo participante/i }))
  })

  it('anuncia a abertura ao leitor de tela via aria-live/status', () => {
    render(<CpfLimitModal accent="#FCFC30" onReset={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toMatch(/já participou/i)
  })

  it('o botão "Próximo participante" chama onReset', () => {
    const onReset = vi.fn()
    render(<CpfLimitModal accent="#FCFC30" onReset={onReset} />)
    fireEvent.click(screen.getByRole('button', { name: /Próximo participante/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('Esc dispara a MESMA ação do botão (reset), nunca deixa preso (WCAG 2.1.2)', () => {
    const onReset = vi.fn()
    render(<CpfLimitModal accent="#FCFC30" onReset={onReset} />)
    fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' })
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('clicar no backdrop dispara reset; clicar no card não', () => {
    const onReset = vi.fn()
    render(<CpfLimitModal accent="#FCFC30" onReset={onReset} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onReset).not.toHaveBeenCalled()
    fireEvent.click(dialog.parentElement!)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('trava o scroll do body enquanto montado e restaura no unmount', () => {
    const { unmount } = render(<CpfLimitModal accent="#FCFC30" onReset={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
