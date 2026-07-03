// Núcleo puro: validação do CPF brasileiro por dígito verificador. Sem DOM e sem
// dependências externas — mesmo padrão de `phoneMask.ts` (função pura, reutilizável
// pelo LeadForm, pelo gate de CPF e pelo Hub futuro). Segue a decisão YAGNI da spec
// HUB-87 §3: ~25 linhas de algoritmo padronizado não justificam biblioteca de
// terceiros. Valida apenas a consistência matemática do documento, nunca a existência
// real do CPF na Receita Federal (HUB-87 §Fora de Escopo).

/** Quantidade de dígitos de um CPF completo. */
export const CPF_DIGIT_COUNT = 11

/** Índice do 1º dígito verificador (10º dígito do CPF). */
const FIRST_CHECK_DIGIT_INDEX = 9
/** Índice do 2º dígito verificador (11º dígito do CPF). */
const SECOND_CHECK_DIGIT_INDEX = 10

/** Peso inicial do cálculo do 1º dígito verificador (pesos 10, 9, …, 2 sobre 9 dígitos). */
const FIRST_CHECK_WEIGHT_START = 10
/** Peso inicial do cálculo do 2º dígito verificador (pesos 11, 10, …, 2 sobre 10 dígitos). */
const SECOND_CHECK_WEIGHT_START = 11

/** Remove tudo que não for dígito e limita ao tamanho de um CPF (11 dígitos). */
export function sanitizeCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, CPF_DIGIT_COUNT)
}

/**
 * Calcula um dígito verificador pela regra do módulo 11: soma cada dígito de `base`
 * por um peso decrescente a partir de `weightStart` e reduz o resultado a um único
 * dígito. Resto igual a 10 vira 0, conforme a convenção do CPF.
 */
function calcCheckDigit(base: string, weightStart: number): number {
  const weightedSum = base
    .split('')
    .reduce((sum, digit, index) => sum + Number(digit) * (weightStart - index), 0)
  const remainder = (weightedSum * 10) % 11
  return remainder === 10 ? 0 : remainder
}

/**
 * Valida um CPF já sanitizado (somente dígitos). Retorna `false` para comprimento
 * diferente de 11, para sequências de um único dígito repetido (`000…00`, `111…11`, …)
 * e para CPFs cujos dígitos verificadores não conferem.
 */
export function isValidCpf(digits: string): boolean {
  if (digits.length !== CPF_DIGIT_COUNT) return false
  // Rejeita os 10 CPFs formados por um único dígito repetido — todos passam no
  // cálculo do verificador, mas são inválidos por convenção.
  if (/^(\d)\1{10}$/.test(digits)) return false

  const firstCheckDigit = calcCheckDigit(digits.slice(0, FIRST_CHECK_DIGIT_INDEX), FIRST_CHECK_WEIGHT_START)
  const secondCheckDigit = calcCheckDigit(digits.slice(0, SECOND_CHECK_DIGIT_INDEX), SECOND_CHECK_WEIGHT_START)
  return (
    firstCheckDigit === Number(digits[FIRST_CHECK_DIGIT_INDEX]) &&
    secondCheckDigit === Number(digits[SECOND_CHECK_DIGIT_INDEX])
  )
}
