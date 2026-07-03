import { describe, it, expect } from 'vitest'
import { applyCpfMask, MAX_CPF_DIGITS } from '../cpfMask'

describe('MAX_CPF_DIGITS', () => {
  it('é 11', () => {
    expect(MAX_CPF_DIGITS).toBe(11)
  })
})

describe('applyCpfMask', () => {
  it('não formata até 3 dígitos', () => {
    expect(applyCpfMask('')).toBe('')
    expect(applyCpfMask('1')).toBe('1')
    expect(applyCpfMask('123')).toBe('123')
  })

  it('formata o 1º grupo com ponto (4 a 6 dígitos)', () => {
    expect(applyCpfMask('1234')).toBe('123.4')
    expect(applyCpfMask('123456')).toBe('123.456')
  })

  it('formata o 2º grupo com ponto (7 a 9 dígitos)', () => {
    expect(applyCpfMask('1234567')).toBe('123.456.7')
    expect(applyCpfMask('123456789')).toBe('123.456.789')
  })

  it('formata CPF completo com hífen (10 a 11 dígitos)', () => {
    expect(applyCpfMask('1234567890')).toBe('123.456.789-0')
    expect(applyCpfMask('12345678901')).toBe('123.456.789-01')
  })

  it('ignora não-dígitos e limita a 11 dígitos', () => {
    expect(applyCpfMask('111.444.777-35')).toBe('111.444.777-35')
    expect(applyCpfMask('123456789012345')).toBe('123.456.789-01')
  })
})
