import { describe, it, expect } from 'vitest'
import {
  caretIndexFromOffset,
  clampCaretIndex,
  createCanvasTextMeasurer,
  nextVisibleScrollLeft,
  type TextMeasurer,
} from '../caret'

// Medidor determinístico: cada caractere mede 10px (jsdom não implementa measureText).
const measure: TextMeasurer = (text) => text.length * 10

describe('clampCaretIndex', () => {
  it('restringe ao intervalo [0, length]', () => {
    expect(clampCaretIndex(-3, 5)).toBe(0)
    expect(clampCaretIndex(2, 5)).toBe(2)
    expect(clampCaretIndex(9, 5)).toBe(5)
  })
})

describe('caretIndexFromOffset', () => {
  it('offset <= 0 cai no início (índice 0)', () => {
    expect(caretIndexFromOffset(0, 'Maria', measure)).toBe(0)
    expect(caretIndexFromOffset(-10, 'Maria', measure)).toBe(0)
  })

  it('offset no meio acha o índice de caractere mais próximo', () => {
    // 'Mar' = 30px → índice 3 exato.
    expect(caretIndexFromOffset(30, 'Maria', measure)).toBe(3)
    // 32px está mais perto de 30 (índice 3) que de 40 (índice 4).
    expect(caretIndexFromOffset(32, 'Maria', measure)).toBe(3)
    // 37px está mais perto de 40 (índice 4).
    expect(caretIndexFromOffset(37, 'Maria', measure)).toBe(4)
  })

  it('offset além do texto faz clamp no fim (length)', () => {
    expect(caretIndexFromOffset(999, 'Maria', measure)).toBe(5)
  })

  it('texto vazio sempre devolve 0', () => {
    expect(caretIndexFromOffset(50, '', measure)).toBe(0)
  })
})

describe('nextVisibleScrollLeft', () => {
  const MARGIN = 20

  it('clientWidth 0 (layout não medido) preserva o scroll atual', () => {
    expect(nextVisibleScrollLeft(500, 40, 0, MARGIN)).toBe(40)
  })

  it('caret já visível não altera o scroll', () => {
    // janela [scroll+margin, scroll+clientWidth-margin] = [60, 180] para scroll 40.
    expect(nextVisibleScrollLeft(100, 40, 160, MARGIN)).toBe(40)
  })

  it('caret à direita da janela rola para revelá-lo (com margem)', () => {
    // caretX 300, clientWidth 160, margem 20 → 300 - 160 + 20 = 160.
    expect(nextVisibleScrollLeft(300, 40, 160, MARGIN)).toBe(160)
  })

  it('caret à esquerda da janela rola para trás, sem passar de 0', () => {
    expect(nextVisibleScrollLeft(10, 80, 160, MARGIN)).toBe(0)
    expect(nextVisibleScrollLeft(50, 80, 160, MARGIN)).toBe(30)
  })
})

describe('createCanvasTextMeasurer', () => {
  it('sem suporte a measureText (jsdom) devolve um medidor neutro (0)', () => {
    // jsdom não implementa canvas 2D; o factory cai no medidor neutro.
    const neutral = createCanvasTextMeasurer('20px "BB Textos"')
    expect(neutral('qualquer texto')).toBe(0)
  })
})
