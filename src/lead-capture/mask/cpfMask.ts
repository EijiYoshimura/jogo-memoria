// Núcleo puro: máscara de CPF 000.000.000-00. Sem DOM — espelha `phoneMask.ts`
// (mesma pasta, mesmo formato: constante de dígitos + formatador puro), reutilizável
// pelo LeadForm e pelo gate de CPF. O mapeamento de caret entre coordenadas
// mascaradas e dígitos crus (`maskedToRawIndex`/`rawToMaskedIndex`) NÃO é reimplementado
// aqui: as funções de `phoneMask.ts` são agnósticas de máscara (contam dígitos vs.
// separadores), então o CPF as reutiliza, evitando duplicação (HUB-87 §3).

/** Máximo de dígitos de um CPF (11). */
export const MAX_CPF_DIGITS = 11

/** Formata dígitos crus na máscara 000.000.000-00, limitando a 11 dígitos. */
export function applyCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, MAX_CPF_DIGITS)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
