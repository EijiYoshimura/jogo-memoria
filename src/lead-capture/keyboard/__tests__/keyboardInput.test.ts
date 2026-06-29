import { describe, it, expect } from 'vitest'
import { applyKey } from '../keyboardInput'
import type { KeyboardKey } from '../keyboardLayouts'

const char = (value: string): KeyboardKey => ({ label: value, value })
const BACKSPACE: KeyboardKey = { label: '⌫', action: 'backspace' }
const CLEAR: KeyboardKey = { label: 'Limpar', action: 'clear' }
const SPACE: KeyboardKey = { label: 'espaço', action: 'space' }
const SHIFT: KeyboardKey = { label: '⇧', action: 'shift' }
const TOGGLE_SYMBOLS: KeyboardKey = { label: '?123', action: 'toggle-symbols' }

function call(
  currentValue: string,
  key: KeyboardKey,
  opts: Partial<{ isShifted: boolean; fieldType: string; hasMask: boolean }> = {}
) {
  return applyKey({
    currentValue,
    key,
    isShifted: opts.isShifted ?? false,
    fieldType: opts.fieldType ?? 'text',
    hasMask: opts.hasMask ?? false,
  })
}

describe('applyKey — char', () => {
  it('anexa caractere minúsculo no fim', () => {
    expect(call('jo', char('a')).nextRaw).toBe('joa')
  })

  it('com shift insere maiúscula efetiva (Cenário 3)', () => {
    expect(call('jo', char('a'), { isShifted: true }).nextRaw).toBe('joA')
  })

  it('insere acentos pt-BR diretos (á, ã, ç)', () => {
    expect(call('jo', char('ã')).nextRaw).toBe('joã')
    expect(call('fran', char('ç')).nextRaw).toBe('franç')
    expect(call('', char('á')).nextRaw).toBe('á')
  })

  it('acento com shift vira maiúscula acentuada', () => {
    expect(call('', char('ã'), { isShifted: true }).nextRaw).toBe('Ã')
  })

  it('mantém o shift (toggle) após inserir caractere', () => {
    expect(call('a', char('b'), { isShifted: true }).nextShift).toBe(true)
  })
})

describe('applyKey — atalho de domínio (Cenário 4)', () => {
  it('anexa o domínio ao conteúdo atual', () => {
    expect(call('joao', char('@gmail.com')).nextRaw).toBe('joao@gmail.com')
  })

  it('regra anti-@@: substitui do @ existente em diante', () => {
    expect(call('joao@gm', char('@gmail.com')).nextRaw).toBe('joao@gmail.com')
  })

  it('tecla @ isolada não duplica @ existente', () => {
    expect(call('joao@x', char('@')).nextRaw).toBe('joao@')
  })
})

describe('applyKey — backspace', () => {
  it('remove o último caractere em texto', () => {
    expect(call('joao', BACKSPACE).nextRaw).toBe('joa')
  })

  it('em tel devolve os dígitos crus sem o último (máscara recalculada pelo consumidor — Cenário 7)', () => {
    expect(call('(11) 98', BACKSPACE, { fieldType: 'tel', hasMask: true }).nextRaw).toBe('119')
  })

  it('backspace em string vazia permanece vazio', () => {
    expect(call('', BACKSPACE).nextRaw).toBe('')
  })
})

describe('applyKey — clear / space', () => {
  it('clear esvazia o campo', () => {
    expect(call('qualquer coisa', CLEAR).nextRaw).toBe('')
  })

  it('space anexa um espaço', () => {
    expect(call('maria', SPACE).nextRaw).toBe('maria ')
  })
})

describe('applyKey — shift', () => {
  it('alterna o estado de shift sem mudar o valor', () => {
    const result = call('abc', SHIFT, { isShifted: false })
    expect(result.nextRaw).toBe('abc')
    expect(result.nextShift).toBe(true)
  })

  it('toggle desliga o shift quando já ativo', () => {
    expect(call('abc', SHIFT, { isShifted: true }).nextShift).toBe(false)
  })
})

describe('applyKey — toggle-symbols (no-op preservador)', () => {
  it('não altera o valor e preserva o shift (modo é resolvido na apresentação)', () => {
    const off = call('abc', TOGGLE_SYMBOLS, { isShifted: false })
    expect(off.nextRaw).toBe('abc')
    expect(off.nextShift).toBe(false)
    const on = call('abc', TOGGLE_SYMBOLS, { isShifted: true })
    expect(on.nextRaw).toBe('abc')
    expect(on.nextShift).toBe(true)
  })
})
