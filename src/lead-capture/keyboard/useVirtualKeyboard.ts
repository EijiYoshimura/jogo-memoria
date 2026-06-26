// Adaptador de estado React sobre o núcleo puro do teclado.
// Chamado INCONDICIONALMENTE (regras de hooks). Quando `enabled === false`,
// fica inerte: estado permanece neutro e os setters são no-op (sem código morto em runtime).

import { useCallback, useMemo, useState } from 'react'

export interface VirtualKeyboardState {
  activeFieldId: string | null
  isShifted: boolean
  /** Seleciona o campo ativo (e reseta o shift). No-op quando o teclado está desligado. */
  setActiveField: (fieldId: string | null) => void
  /** Define o próximo estado de shift. No-op quando o teclado está desligado. */
  setShift: (next: boolean) => void
}

export function useVirtualKeyboard(enabled: boolean): VirtualKeyboardState {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [isShifted, setIsShifted] = useState(false)

  const setActiveField = useCallback(
    (fieldId: string | null) => {
      if (!enabled) return
      setActiveFieldId(fieldId)
      setIsShifted(false)
    },
    [enabled]
  )

  const setShift = useCallback(
    (next: boolean) => {
      if (!enabled) return
      setIsShifted(next)
    },
    [enabled]
  )

  return useMemo(
    () => ({ activeFieldId, isShifted, setActiveField, setShift }),
    [activeFieldId, isShifted, setActiveField, setShift]
  )
}
