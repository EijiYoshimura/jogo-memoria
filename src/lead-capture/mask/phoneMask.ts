// Núcleo puro: máscara de telefone (99) 99999-9999 e mapeamento de caret entre
// coordenadas mascaradas e dígitos crus. Sem DOM — reutilizável pelo LeadForm,
// pelo applyKey (cálculo de caret) e pelo Hub futuro.

/** Máximo de dígitos de um telefone celular brasileiro (DDD + 9 dígitos). */
export const MAX_PHONE_DIGITS = 11

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

/** Formata dígitos crus na máscara (99) 99999-9999, limitando a 11 dígitos. */
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Converte um caret em coordenadas mascaradas para o índice em dígitos crus:
 * quantos dígitos existem em `masked[0..idx)`.
 */
export function maskedToRawIndex(masked: string, idx: number): number {
  const clamped = Math.max(0, Math.min(idx, masked.length))
  let digits = 0
  for (let i = 0; i < clamped; i++) {
    if (isDigit(masked[i])) digits++
  }
  return digits
}

/**
 * Converte um índice em dígitos crus para o caret no valor mascarado:
 * a posição logo após o `rawIndex`-ésimo dígito, pulando separadores
 * (`(`, `)`, espaço, `-`). Bordas vão para início/fim do mascarado (decisão PO 3).
 */
export function rawToMaskedIndex(masked: string, rawIndex: number): number {
  if (rawIndex <= 0) return 0
  let digits = 0
  for (let i = 0; i < masked.length; i++) {
    if (isDigit(masked[i])) {
      digits++
      if (digits === rawIndex) return i + 1
    }
  }
  return masked.length
}
