import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { useModalA11y } from '../useModalA11y'

afterEach(() => cleanup())

function Harness({
  onEscape,
  withInitialFocus = false,
}: {
  onEscape: () => void
  withInitialFocus?: boolean
}) {
  const lastRef = useRef<HTMLButtonElement>(null)
  const { cardRef, onKeyDown } = useModalA11y({
    onEscape,
    initialFocusRef: withInitialFocus ? lastRef : undefined,
  })
  return (
    <div data-testid="backdrop" onKeyDown={onKeyDown}>
      <div ref={cardRef} role="dialog" tabIndex={-1}>
        <button>first</button>
        <button ref={lastRef}>last</button>
      </div>
    </div>
  )
}

const backdrop = () => screen.getByTestId('backdrop')

describe('useModalA11y', () => {
  it('foca o card por padrão e trava o scroll do body; restaura no unmount', () => {
    const { unmount } = render(<Harness onEscape={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('foca o elemento de initialFocusRef quando fornecido', () => {
    render(<Harness onEscape={vi.fn()} withInitialFocus />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' }))
  })

  it('Esc dispara onEscape', () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    fireEvent.keyDown(backdrop(), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('Tab a partir do último foco volta para o primeiro (focus-trap)', () => {
    render(<Harness onEscape={vi.fn()} />)
    screen.getByRole('button', { name: 'last' }).focus()
    fireEvent.keyDown(backdrop(), { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))
  })

  it('Shift+Tab a partir do primeiro foco vai para o último (focus-trap)', () => {
    render(<Harness onEscape={vi.fn()} />)
    screen.getByRole('button', { name: 'first' }).focus()
    fireEvent.keyDown(backdrop(), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' }))
  })
})
