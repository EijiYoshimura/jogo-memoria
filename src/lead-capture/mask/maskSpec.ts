// Núcleo puro: especificação de máscara (formatador + limite de dígitos). Unifica
// `phoneMask` e `cpfMask` sob um contrato comum, permitindo que o teclado virtual
// (`applyKey`) e o `LeadForm` tratem qualquer máscara numérica de forma genérica —
// sem ramos hardcoded por tipo de campo (HUB-91). O mapeamento de caret entre
// coordenadas mascaradas e dígitos crus continua vindo de `phoneMask.ts`, que é
// agnóstico de máscara (conta dígitos vs. separadores).

import { applyPhoneMask, MAX_PHONE_DIGITS } from './phoneMask'
import { applyCpfMask, MAX_CPF_DIGITS } from './cpfMask'

export interface MaskSpec {
  /** Formata dígitos crus na máscara (ex.: `(99) 99999-9999`, `000.000.000-00`). */
  format: (value: string) => string
  /** Máximo de dígitos aceitos pela máscara. */
  maxDigits: number
}

/** Máscara de telefone celular brasileiro. */
export const PHONE_MASK: MaskSpec = { format: applyPhoneMask, maxDigits: MAX_PHONE_DIGITS }

/** Máscara de CPF (`000.000.000-00`). */
export const CPF_MASK: MaskSpec = { format: applyCpfMask, maxDigits: MAX_CPF_DIGITS }
