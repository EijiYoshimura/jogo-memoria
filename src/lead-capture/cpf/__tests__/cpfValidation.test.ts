import { describe, it, expect } from 'vitest'
import { sanitizeCpf, isValidCpf, CPF_DIGIT_COUNT } from '../cpfValidation'

// CPFs válidos reais (dígito verificador confere). O terceiro exercita o ramo
// "resto === 10 ⇒ dígito 0" do cálculo do 1º verificador.
const VALID_CPFS = ['11144477735', '52998224725', '39053344705']

describe('CPF_DIGIT_COUNT', () => {
  it('é 11', () => {
    expect(CPF_DIGIT_COUNT).toBe(11)
  })
})

describe('sanitizeCpf', () => {
  it('remove máscara e caracteres não numéricos', () => {
    expect(sanitizeCpf('111.444.777-35')).toBe('11144477735')
    expect(sanitizeCpf('abc111def444')).toBe('111444')
  })

  it('limita a 11 dígitos', () => {
    expect(sanitizeCpf('123456789012345')).toBe('12345678901')
  })

  it('retorna string vazia para entrada sem dígitos', () => {
    expect(sanitizeCpf('')).toBe('')
    expect(sanitizeCpf('...-')).toBe('')
  })
})

describe('isValidCpf — CPFs válidos', () => {
  it.each(VALID_CPFS)('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true)
  })

  it('aceita o resultado de sanitizar uma entrada mascarada', () => {
    expect(isValidCpf(sanitizeCpf('111.444.777-35'))).toBe(true)
  })
})

describe('isValidCpf — dígito verificador incorreto', () => {
  it('rejeita quando o 1º dígito verificador não confere', () => {
    // 39053344705 é válido; alterar o 10º dígito (1º verificador) invalida.
    expect(isValidCpf('39053344715')).toBe(false)
  })

  it('rejeita quando o 2º dígito verificador não confere', () => {
    // 11144477735 é válido; alterar o 11º dígito (2º verificador) invalida.
    expect(isValidCpf('11144477734')).toBe(false)
  })
})

describe('isValidCpf — sequências de dígito repetido', () => {
  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'rejeita %s repetido 11 vezes',
    (digit) => {
      expect(isValidCpf(digit.repeat(11))).toBe(false)
    }
  )
})

describe('isValidCpf — comprimento inválido', () => {
  it('rejeita entrada incompleta', () => {
    expect(isValidCpf('')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('1114447773')).toBe(false) // 10 dígitos
  })

  it('rejeita entrada com mais de 11 dígitos', () => {
    expect(isValidCpf('111444777350')).toBe(false) // 12 dígitos
  })
})
