import { describe, it, expect } from 'vitest'
import { FOREIGN_CPF, isForeignCpf } from '../constants'
import { isValidCpf } from '../cpfValidation'

describe('isForeignCpf (HUB-109)', () => {
  it('aceita apenas o código estrangeiro exato', () => {
    expect(isForeignCpf(FOREIGN_CPF)).toBe(true)
    expect(isForeignCpf('11111111111')).toBe(true)
  })

  it.each(['00000000000', '22222222222'])(
    'rejeita outra sequência repetida (%s) — critério 6',
    (digits) => {
      expect(isForeignCpf(digits)).toBe(false)
    }
  )

  it('rejeita CPF real válido', () => {
    expect(isForeignCpf('11144477735')).toBe(false)
  })

  it('rejeita o código parcial (menos de 11 dígitos)', () => {
    expect(isForeignCpf('111111111')).toBe(false)
  })

  it('rejeita o valor não sanitizado (com máscara)', () => {
    expect(isForeignCpf('111.111.111-11')).toBe(false)
  })
})

describe('regressão HUB-109 — cpfValidation intocada', () => {
  it('isValidCpf continua rejeitando o código estrangeiro como CPF', () => {
    expect(isValidCpf(FOREIGN_CPF)).toBe(false)
  })
})
