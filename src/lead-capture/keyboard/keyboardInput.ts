// Núcleo puro: aplicação de tecla. Agnóstico de framework de form e sem DOM.
// O caret entra como dado (`caretStart`) e sai como dado (`nextCaret`); o consumidor
// (LeadForm) lê/escreve a `selectionStart` do `<input>`. Sempre retorna `nextRaw`
// (o consumidor reaplica a própria máscara/validação).

import type { KeyboardKey } from './keyboardLayouts'
import { maskedToRawIndex, rawToMaskedIndex } from '../mask/phoneMask'
import { PHONE_MASK, type MaskSpec } from '../mask/maskSpec'

export interface ApplyKeyInput {
  /** Valor atual do campo (já mascarado, no caso de campo com máscara). */
  currentValue: string
  key: KeyboardKey
  isShifted: boolean
  /** 'text' | 'email' | 'tel' | ... */
  fieldType: string
  /** Se o campo possui máscara (ex.: tel, cpf). */
  hasMask: boolean
  /**
   * Especificação da máscara a aplicar (formatador + limite de dígitos). Quando
   * ausente, campos `tel` mascarados caem na máscara de telefone (retrocompat HUB-57).
   */
  mask?: MaskSpec
  /** Posição do caret no `currentValue`. Default = fim (retrocompat HUB-57). */
  caretStart?: number
  /** Fim da seleção; se `start !== end` (range), trata-se como `caretStart` (decisão PO 2). */
  caretEnd?: number
}

export interface ApplyKeyResult {
  /** Alimenta o handleChange existente (que reaplica a máscara quando necessário). */
  nextRaw: string
  /** Próximo estado de shift. */
  nextShift: boolean
  /** Nova posição do caret, nas coords do valor exibido após o consumidor reaplicar a máscara. */
  nextCaret: number
}

/** Resolve o caret efetivo: default = fim; range → trata como `caretStart`; clampa em [0, len]. */
function resolveCaret(input: ApplyKeyInput): number {
  const len = input.currentValue.length
  const start = input.caretStart ?? len
  return Math.max(0, Math.min(start, len))
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Resolve a máscara efetiva do campo: prioriza a spec explícita; na ausência, campos
 * `tel` mascarados caem na máscara de telefone (retrocompat com chamadas anteriores a
 * HUB-91, que não passavam `mask`). Sem máscara aplicável, retorna `null`.
 */
function resolveMaskSpec(input: ApplyKeyInput): MaskSpec | null {
  if (input.mask) return input.mask
  if (input.hasMask && input.fieldType === 'tel') return PHONE_MASK
  return null
}

/** Insere dígito(s) na posição do caret sobre os dígitos crus e reaplica a máscara. */
function applyMaskedChar(input: ApplyKeyInput, mask: MaskSpec): ApplyKeyResult {
  const { currentValue, key } = input
  const caret = resolveCaret(input)
  const rawDigits = onlyDigits(currentValue)
  const rawCaret = maskedToRawIndex(currentValue, caret)
  const insertedDigits = onlyDigits(key.value ?? '')

  const newDigits = (
    rawDigits.slice(0, rawCaret) +
    insertedDigits +
    rawDigits.slice(rawCaret)
  ).slice(0, mask.maxDigits)
  const newRawCaret = Math.min(rawCaret + insertedDigits.length, newDigits.length)
  const newMasked = mask.format(newDigits)
  // Single-shot: inserir caractere consome o shift (nextShift: false).
  return { nextRaw: newDigits, nextShift: false, nextCaret: rawToMaskedIndex(newMasked, newRawCaret) }
}

/** Remove o dígito cru à esquerda do caret; no-op se não houver dígito à esquerda. */
function applyMaskedBackspace(input: ApplyKeyInput, mask: MaskSpec): ApplyKeyResult {
  const { currentValue, isShifted } = input
  const caret = resolveCaret(input)
  const rawDigits = onlyDigits(currentValue)
  const rawCaret = maskedToRawIndex(currentValue, caret)
  if (rawCaret === 0) {
    return { nextRaw: rawDigits, nextShift: isShifted, nextCaret: 0 }
  }
  const newDigits = rawDigits.slice(0, rawCaret - 1) + rawDigits.slice(rawCaret)
  const newMasked = mask.format(newDigits)
  return {
    nextRaw: newDigits,
    nextShift: isShifted,
    nextCaret: rawToMaskedIndex(newMasked, rawCaret - 1),
  }
}

function applyChar(input: ApplyKeyInput): ApplyKeyResult {
  const { currentValue, key, isShifted } = input
  const mask = resolveMaskSpec(input)
  if (mask) return applyMaskedChar(input, mask)

  const raw = key.value ?? ''
  const inserted = isShifted && raw.length === 1 ? raw.toUpperCase() : raw

  // Single-shot: qualquer inserção de caractere consome o shift (nextShift: false).
  // A maiúscula já foi aplicada acima quando isShifted; a próxima letra sai minúscula
  // sem novo toque em SHIFT (Cenário 3 / auto-shift Cenário 7).

  // Atalhos de domínio (ex.: '@gmail.com') e a tecla '@' permanecem âncora-fim, com a
  // regra anti-`@@`: inserir um domínio "no meio" não faz sentido (decisão técnica 1).
  if (raw.startsWith('@') && currentValue.includes('@')) {
    const base = currentValue.slice(0, currentValue.indexOf('@'))
    const nextRaw = base + inserted
    return { nextRaw, nextShift: false, nextCaret: nextRaw.length }
  }
  if (inserted.length > 1) {
    const nextRaw = currentValue + inserted
    return { nextRaw, nextShift: false, nextCaret: nextRaw.length }
  }

  // Inserção de 1 caractere é caret-posicionada.
  const caret = resolveCaret(input)
  const nextRaw = currentValue.slice(0, caret) + inserted + currentValue.slice(caret)
  return { nextRaw, nextShift: false, nextCaret: caret + inserted.length }
}

function applyBackspace(input: ApplyKeyInput): ApplyKeyResult {
  const { currentValue, isShifted } = input
  const mask = resolveMaskSpec(input)
  if (mask) return applyMaskedBackspace(input, mask)

  const caret = resolveCaret(input)
  if (caret === 0) {
    // Caret no início = no-op (decisão PO 1).
    return { nextRaw: currentValue, nextShift: isShifted, nextCaret: 0 }
  }
  const nextRaw = currentValue.slice(0, caret - 1) + currentValue.slice(caret)
  return { nextRaw, nextShift: isShifted, nextCaret: caret - 1 }
}

function applySpace(input: ApplyKeyInput): ApplyKeyResult {
  const { currentValue, isShifted } = input
  const caret = resolveCaret(input)
  const nextRaw = currentValue.slice(0, caret) + ' ' + currentValue.slice(caret)
  return { nextRaw, nextShift: isShifted, nextCaret: caret + 1 }
}

/**
 * Aplica uma tecla ao valor atual e devolve o `raw` resultante, o próximo shift e a nova
 * posição do caret. Sem `caretStart`, o caret é o fim da string (retrocompat HUB-57).
 */
export function applyKey(input: ApplyKeyInput): ApplyKeyResult {
  const action = input.key.action ?? 'char'
  switch (action) {
    case 'char':
      return applyChar(input)
    case 'backspace':
      return applyBackspace(input)
    case 'clear':
      return { nextRaw: '', nextShift: input.isShifted, nextCaret: 0 }
    case 'space':
      return applySpace(input)
    case 'shift':
      return { nextRaw: input.currentValue, nextShift: !input.isShifted, nextCaret: resolveCaret(input) }
    case 'toggle-symbols':
      // Troca de modo é resolvida na apresentação (VirtualKeyboard); aqui é no-op total —
      // mantém o switch exaustivo e type-safe sobre KeyAction (sem default).
      return { nextRaw: input.currentValue, nextShift: input.isShifted, nextCaret: resolveCaret(input) }
  }
}
