import { describe, it, expect } from 'vitest'
import { applyPhoneMask, maskedToRawIndex, rawToMaskedIndex } from '../phoneMask'

describe('applyPhoneMask', () => {
  it('não formata até 2 dígitos', () => {
    expect(applyPhoneMask('')).toBe('')
    expect(applyPhoneMask('1')).toBe('1')
    expect(applyPhoneMask('11')).toBe('11')
  })

  it('formata DDD + prefixo (3 a 7 dígitos)', () => {
    expect(applyPhoneMask('119')).toBe('(11) 9')
    expect(applyPhoneMask('1199999')).toBe('(11) 99999')
  })

  it('formata número completo com hífen (8+ dígitos)', () => {
    expect(applyPhoneMask('1199999888')).toBe('(11) 99999-888')
    expect(applyPhoneMask('11999998888')).toBe('(11) 99999-8888')
  })

  it('ignora não-dígitos e limita a 11 dígitos', () => {
    expect(applyPhoneMask('(11) 99999-8888')).toBe('(11) 99999-8888')
    expect(applyPhoneMask('119999988887777')).toBe('(11) 99999-8888')
  })
})

describe('maskedToRawIndex — caret mascarado → índice cru', () => {
  const masked = '(11) 99999-8888'
  it('conta os dígitos à esquerda do caret', () => {
    expect(maskedToRawIndex(masked, 0)).toBe(0) // início
    expect(maskedToRawIndex(masked, 1)).toBe(0) // após '('
    expect(maskedToRawIndex(masked, 3)).toBe(2) // após '11'
    expect(maskedToRawIndex(masked, 5)).toBe(2) // após ') ' (separadores não contam)
    expect(maskedToRawIndex(masked, masked.length)).toBe(11) // fim
  })

  it('clampa índices fora dos limites', () => {
    expect(maskedToRawIndex(masked, -5)).toBe(0)
    expect(maskedToRawIndex(masked, 999)).toBe(11)
  })
})

describe('rawToMaskedIndex — índice cru → caret mascarado (pula separadores)', () => {
  const masked = '(11) 99999-8888'
  it('posiciona o caret logo após o n-ésimo dígito, nunca sobre um separador', () => {
    expect(rawToMaskedIndex(masked, 0)).toBe(0) // borda inicial
    expect(rawToMaskedIndex(masked, 2)).toBe(3) // após o 2º dígito (antes de ')')
    expect(rawToMaskedIndex(masked, 7)).toBe(10) // após o 7º dígito (antes de '-')
    expect(rawToMaskedIndex(masked, 11)).toBe(masked.length) // borda final
  })

  it('o caret resultante nunca fica imediatamente após um separador', () => {
    const separators = new Set(['(', ')', ' ', '-'])
    for (let n = 1; n <= 11; n++) {
      const pos = rawToMaskedIndex(masked, n)
      // O caractere à esquerda do caret é sempre um dígito (pulou os separadores).
      expect(separators.has(masked[pos - 1])).toBe(false)
    }
  })

  it('índice cru além do total de dígitos vai para o fim', () => {
    expect(rawToMaskedIndex(masked, 99)).toBe(masked.length)
  })
})

describe('round-trip masked ↔ raw', () => {
  it('mapear caret para cru e de volta retorna a posição logo após o dígito', () => {
    const masked = '(11) 99999-8888'
    // Caret 7 (no meio do grupo '99999'): 4 dígitos à esquerda → de volta ao caret 7.
    const raw = maskedToRawIndex(masked, 7)
    expect(raw).toBe(4)
    expect(rawToMaskedIndex(masked, raw)).toBe(7)
  })
})
