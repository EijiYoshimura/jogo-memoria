import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { VirtualKeyboard } from '../VirtualKeyboard'
import { LAYOUT_REGISTRY, type KeyboardKey } from '../keyboardLayouts'

const ALPHA = LAYOUT_REGISTRY['alpha-ptbr']
const NUMERIC = LAYOUT_REGISTRY['numeric']

function setup(opts: { isShifted?: boolean; layout?: typeof ALPHA } = {}) {
  const onKey = vi.fn()
  const utils = render(
    <VirtualKeyboard
      layout={opts.layout ?? ALPHA}
      isShifted={opts.isShifted ?? false}
      onKey={onKey}
      visible
    />
  )
  return { onKey, ...utils }
}

const key = (name: string) => screen.getByRole('button', { name })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('VirtualKeyboard — fileira numérica fixa (Cenário 1/2)', () => {
  it('a 1ª fileira do alpha tem 1..0 e tocar um número emite onKey do dígito', () => {
    const { onKey } = setup()
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      expect(key(d)).toBeDefined()
    }
    fireEvent.click(key('7'))
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ value: '7' }))
  })
})

describe('VirtualKeyboard — long-press e popup de variantes (Cenários 3/4/6)', () => {
  it('hold de 350ms abre o popup de variantes da vogal', () => {
    setup()
    fireEvent.pointerDown(key('a'))
    expect(screen.queryByRole('group', { name: 'Variantes de a' })).toBeNull()
    act(() => vi.advanceTimersByTime(350))
    expect(screen.getByRole('group', { name: 'Variantes de a' })).toBeDefined()
  })

  it('soltar antes do threshold insere a letra base e não abre popup', () => {
    const { onKey } = setup()
    fireEvent.pointerDown(key('a'))
    act(() => vi.advanceTimersByTime(200))
    fireEvent.pointerUp(key('a'))
    fireEvent.click(key('a'))
    expect(screen.queryByRole('group', { name: 'Variantes de a' })).toBeNull()
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ value: 'a' }))
  })

  it('selecionar uma variante insere o caractere e fecha o popup (Cenário 4)', () => {
    const { onKey } = setup()
    fireEvent.pointerDown(key('a'))
    act(() => vi.advanceTimersByTime(350))
    const popup = screen.getByRole('group', { name: 'Variantes de a' })
    fireEvent.click(within(popup).getByRole('button', { name: 'ã' }))
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ value: 'ã' }))
    expect(screen.queryByRole('group', { name: 'Variantes de a' })).toBeNull()
  })

  it('long-press em tecla SEM variantes não abre popup; a letra é inserida (Cenário 6)', () => {
    const { onKey } = setup()
    fireEvent.pointerDown(key('t'))
    act(() => vi.advanceTimersByTime(350))
    expect(screen.queryByRole('group', { name: /Variantes/ })).toBeNull()
    fireEvent.click(key('t'))
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ value: 't' }))
  })
})

describe('VirtualKeyboard — maiúsculas acentuadas (Cenário 7)', () => {
  it('com shift, o popup exibe as variantes em maiúsculas', () => {
    setup({ isShifted: true })
    fireEvent.pointerDown(key('A'))
    act(() => vi.advanceTimersByTime(350))
    const popup = screen.getByRole('group', { name: 'Variantes de a' })
    expect(within(popup).getByRole('button', { name: 'Ã' })).toBeDefined()
    expect(within(popup).getByRole('button', { name: 'Á' })).toBeDefined()
  })
})

describe('VirtualKeyboard — modo símbolos (Cenário 8)', () => {
  it('toggle ?123 ↔ ABC troca o layout e não emite onKey para o toggle', () => {
    const { onKey } = setup()
    expect(screen.queryByRole('button', { name: '@' })).toBeNull()
    fireEvent.click(key('Símbolos'))
    expect(onKey).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '@' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Letras' })).toBeDefined()
    fireEvent.click(key('Letras'))
    expect(screen.getByRole('button', { name: 'Símbolos' })).toBeDefined()
    expect(screen.queryByRole('button', { name: '@' })).toBeNull()
    expect(onKey).not.toHaveBeenCalled()
  })

  it('trocar de campo (novo layout) reseta o modo para alfabético', () => {
    const { rerender } = setup()
    fireEvent.click(key('Símbolos'))
    expect(screen.getByRole('button', { name: 'Letras' })).toBeDefined()
    // troca de campo: layout numeric (dialpad)
    rerender(<VirtualKeyboard layout={NUMERIC} isShifted={false} onKey={vi.fn()} visible />)
    // volta para um campo de texto (alpha): deve estar em ABC, não em símbolos
    rerender(<VirtualKeyboard layout={ALPHA} isShifted={false} onKey={vi.fn()} visible />)
    expect(screen.getByRole('button', { name: 'Símbolos' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Letras' })).toBeNull()
  })
})

describe('VirtualKeyboard — dialpad numérico centralizado (Cenário 9)', () => {
  it('teclas do numeric não usam flex-grow e têm largura fixa', () => {
    setup({ layout: NUMERIC })
    const digit = key('5') as HTMLButtonElement
    expect(digit.style.flexGrow).toBe('')
    expect(digit.className).toContain('w-[84px]')
  })

  it('alpha (align fill) usa flex-grow na célula da tecla (contraste)', () => {
    setup()
    const cell = key('q').parentElement as HTMLElement
    expect(cell.style.flexGrow).not.toBe('')
  })
})

describe('VirtualKeyboard — popup ancorado à tecla, com borda e clamp', () => {
  it('o popup é filho da célula da tecla pressionada, tem borda contrastante e fica acima', () => {
    setup()
    fireEvent.pointerDown(key('a'))
    act(() => vi.advanceTimersByTime(350))
    const cell = key('a').parentElement as HTMLElement
    const popup = within(cell).getByRole('group', { name: 'Variantes de a' })
    expect(popup).toBeDefined()
    expect(popup.className).toContain('border-2')
    expect(popup.className).toContain('border-[#FCFC30]')
    expect(popup.className).toContain('bottom-full')
  })

  it('clampa à esquerda numa tecla de borda (a) e centraliza no miolo (o)', () => {
    setup()
    fireEvent.pointerDown(key('a'))
    act(() => vi.advanceTimersByTime(350))
    const leftPopup = within(key('a').parentElement as HTMLElement).getByRole('group', {
      name: 'Variantes de a',
    })
    expect(leftPopup.className).toContain('left-0')

    fireEvent.pointerDown(key('e')) // miolo da fileira qwertyuiop (índice 2)
    act(() => vi.advanceTimersByTime(350))
    const centerPopup = within(key('e').parentElement as HTMLElement).getByRole('group', {
      name: 'Variantes de e',
    })
    expect(centerPopup.className).toContain('-translate-x-1/2')
  })
})

describe('VirtualKeyboard — acessibilidade do toggle', () => {
  it('?123 tem aria-label "Símbolos" e, no modo símbolos, ABC tem "Letras"', () => {
    setup()
    const toggle: KeyboardKey = ALPHA.rows.flat().find((k) => k.action === 'toggle-symbols')!
    expect(toggle.label).toBe('?123')
    expect(screen.getByLabelText('Símbolos')).toBeDefined()
  })
})
