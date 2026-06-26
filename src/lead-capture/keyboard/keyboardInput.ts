// Núcleo puro: aplicação de tecla. Agnóstico de máscara e de framework de form.
// Retorna sempre `raw`; o consumidor (LeadForm) aplica sua própria máscara/validação.

import type { KeyboardKey } from './keyboardLayouts'

export interface ApplyKeyInput {
  /** Valor atual do campo (já mascarado, no caso de tel). */
  currentValue: string
  key: KeyboardKey
  isShifted: boolean
  /** 'text' | 'email' | 'tel' | ... */
  fieldType: string
  /** Se o campo possui máscara (ex.: tel). */
  hasMask: boolean
}

export interface ApplyKeyResult {
  /** Alimenta o handleChange existente (que reaplica a máscara quando necessário). */
  nextRaw: string
  /** Próximo estado de shift. */
  nextShift: boolean
}

function applyChar(input: ApplyKeyInput): ApplyKeyResult {
  const { currentValue, key, isShifted } = input
  const raw = key.value ?? ''
  const inserted = isShifted && raw.length === 1 ? raw.toUpperCase() : raw

  // Regra anti-`@@`: atalho/tecla iniciando em '@' substitui do '@' existente em diante.
  let base = currentValue
  if (raw.startsWith('@') && currentValue.includes('@')) {
    base = currentValue.slice(0, currentValue.indexOf('@'))
  }

  return { nextRaw: base + inserted, nextShift: isShifted }
}

function applyBackspace(input: ApplyKeyInput): ApplyKeyResult {
  const { currentValue, fieldType, hasMask, isShifted } = input
  if (fieldType === 'tel' && hasMask) {
    // Remove o último dígito cru; a máscara é recalculada pelo consumidor.
    const digits = currentValue.replace(/\D/g, '').slice(0, -1)
    return { nextRaw: digits, nextShift: isShifted }
  }
  return { nextRaw: currentValue.slice(0, -1), nextShift: isShifted }
}

/**
 * Aplica uma tecla ao valor atual e devolve o `raw` resultante + próximo shift.
 * O append/backspace atuam no fim da string (decisão de escopo MVP: sem caret no meio).
 */
export function applyKey(input: ApplyKeyInput): ApplyKeyResult {
  const action = input.key.action ?? 'char'
  switch (action) {
    case 'char':
      return applyChar(input)
    case 'backspace':
      return applyBackspace(input)
    case 'clear':
      return { nextRaw: '', nextShift: input.isShifted }
    case 'space':
      return { nextRaw: input.currentValue + ' ', nextShift: input.isShifted }
    case 'shift':
      return { nextRaw: input.currentValue, nextShift: !input.isShifted }
  }
}
