import { describe, it, expect } from 'vitest'
import { resolveLayout, LAYOUT_REGISTRY } from '../keyboardLayouts'

describe('resolveLayout', () => {
  it('mapeia type text → alpha-ptbr', () => {
    expect(resolveLayout({ type: 'text' }).id).toBe('alpha-ptbr')
  })

  it('mapeia type email → email', () => {
    expect(resolveLayout({ type: 'email' }).id).toBe('email')
  })

  it('mapeia type tel → numeric', () => {
    expect(resolveLayout({ type: 'tel' }).id).toBe('numeric')
  })

  it('respeita o override explícito keyboardLayout sobre o type', () => {
    expect(resolveLayout({ type: 'tel', keyboardLayout: 'email' }).id).toBe('email')
  })

  it('cai no fallback alpha-ptbr para type desconhecido', () => {
    expect(resolveLayout({ type: 'date' }).id).toBe('alpha-ptbr')
  })

  it('cai no fallback alpha-ptbr para keyboardLayout inexistente no registry', () => {
    expect(resolveLayout({ type: 'text', keyboardLayout: 'inexistente' }).id).toBe('alpha-ptbr')
  })
})

describe('LAYOUT_REGISTRY', () => {
  it('layout alpha-ptbr tem a tecla ç', () => {
    const allKeys = LAYOUT_REGISTRY['alpha-ptbr'].rows.flat()
    expect(allKeys.some((k) => k.value === 'ç')).toBe(true)
  })

  it('layout alpha-ptbr expõe acentos diretos (á, ã, é)', () => {
    const values = LAYOUT_REGISTRY['alpha-ptbr'].rows.flat().map((k) => k.value)
    expect(values).toContain('á')
    expect(values).toContain('ã')
    expect(values).toContain('é')
  })

  it('layout email expõe @ e . fixos', () => {
    const values = LAYOUT_REGISTRY['email'].rows.flat().map((k) => k.value)
    expect(values).toContain('@')
    expect(values).toContain('.')
  })

  it('layout email tem atalhos de domínio na shortcutsRow', () => {
    const labels = LAYOUT_REGISTRY['email'].shortcutsRow?.map((k) => k.value) ?? []
    expect(labels).toEqual(['@gmail.com', '@hotmail.com', '@outlook.com'])
  })

  it('layout numeric tem apenas dígitos, backspace e limpar', () => {
    const keys = LAYOUT_REGISTRY['numeric'].rows.flat()
    const charValues = keys.filter((k) => (k.action ?? 'char') === 'char').map((k) => k.value)
    expect(charValues.sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(keys.some((k) => k.action === 'backspace')).toBe(true)
    expect(keys.some((k) => k.action === 'clear')).toBe(true)
  })
})
