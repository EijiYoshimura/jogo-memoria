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
  it('layout alpha-ptbr tem a fileira numérica fixa 1..0 no topo (Cenário 1/2)', () => {
    const firstRow = LAYOUT_REGISTRY['alpha-ptbr'].rows[0]
    expect(firstRow.map((k) => k.value)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    )
  })

  it('layout alpha-ptbr NÃO tem mais a fileira de acentos diretos nem a tecla ç', () => {
    const values = LAYOUT_REGISTRY['alpha-ptbr'].rows.flat().map((k) => k.value)
    expect(values).not.toContain('á')
    expect(values).not.toContain('ã')
    expect(values).not.toContain('ç')
  })

  it('expõe variants pt-BR exatamente conforme Cenário 5', () => {
    const byValue = (v: string) =>
      LAYOUT_REGISTRY['alpha-ptbr'].rows.flat().find((k) => k.value === v)
    expect(byValue('a')?.variants).toEqual(['á', 'ã', 'â', 'à', 'ä'])
    expect(byValue('e')?.variants).toEqual(['é', 'ê', 'è', 'ë'])
    expect(byValue('i')?.variants).toEqual(['í', 'î', 'ì', 'ï'])
    expect(byValue('o')?.variants).toEqual(['ó', 'õ', 'ô', 'ò', 'ö'])
    expect(byValue('u')?.variants).toEqual(['ú', 'û', 'ù', 'ü'])
    expect(byValue('c')?.variants).toEqual(['ç'])
    expect(byValue('n')?.variants).toEqual(['ñ'])
  })

  it('teclas sem acento não têm variants (ex.: t, s)', () => {
    const byValue = (v: string) =>
      LAYOUT_REGISTRY['alpha-ptbr'].rows.flat().find((k) => k.value === v)
    expect(byValue('t')?.variants).toBeUndefined()
    expect(byValue('s')?.variants).toBeUndefined()
  })

  it('layout symbols existe e cobre o conjunto do Cenário 8', () => {
    const symbols = LAYOUT_REGISTRY['symbols']
    expect(symbols).toBeDefined()
    const values = symbols.rows.flat().map((k) => k.value)
    for (const s of ['@', '#', '&', '_', '-', '/', ':', ';', '(', ')', '$', '!', '?', '.', ',']) {
      expect(values).toContain(s)
    }
    // tecla de retorno ao alfabético
    expect(symbols.rows.flat().some((k) => k.action === 'toggle-symbols' && k.label === 'ABC')).toBe(true)
    // fileira numérica fixa também no modo símbolos
    expect(symbols.rows[0].map((k) => k.value)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    )
  })

  it('alpha-ptbr tem a tecla de troca ?123 (toggle-symbols)', () => {
    expect(
      LAYOUT_REGISTRY['alpha-ptbr'].rows
        .flat()
        .some((k) => k.action === 'toggle-symbols' && k.label === '?123')
    ).toBe(true)
  })

  it('layout numeric usa align center (dialpad) e mantém o conteúdo', () => {
    expect(LAYOUT_REGISTRY['numeric'].align).toBe('center')
  })

  it('layout email reusa exatamente as rows do alpha-ptbr (paridade — HUB-85)', () => {
    expect(LAYOUT_REGISTRY['email'].rows).toBe(LAYOUT_REGISTRY['alpha-ptbr'].rows)
  })

  it('layout email tem a fileira numérica fixa 1..0 no topo (HUB-85)', () => {
    const firstRow = LAYOUT_REGISTRY['email'].rows[0]
    expect(firstRow.map((k) => k.value)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    )
  })

  it('layout email tem a tecla de troca ?123 (toggle-symbols) — HUB-85', () => {
    expect(
      LAYOUT_REGISTRY['email'].rows
        .flat()
        .some((k) => k.action === 'toggle-symbols' && k.label === '?123')
    ).toBe(true)
  })

  it('layout email expõe . fixo (do alfanumérico)', () => {
    const values = LAYOUT_REGISTRY['email'].rows.flat().map((k) => k.value)
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
