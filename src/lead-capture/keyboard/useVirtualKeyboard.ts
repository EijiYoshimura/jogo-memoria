// Adaptador de estado React sobre o núcleo puro do teclado.
// Chamado INCONDICIONALMENTE (regras de hooks). Quando `enabled === false`,
// fica inerte: estado permanece neutro e os setters são no-op (sem código morto em runtime).

import { useCallback, useMemo, useRef, useState } from 'react'

export interface VirtualKeyboardState {
  activeFieldId: string | null
  isShifted: boolean
  /**
   * Seleciona o campo ativo. Reseta o shift **apenas quando o id muda de fato**;
   * re-focar o mesmo campo (efeito do reposicionamento de caret — HUB-69) é no-op,
   * preservando o shift entre teclas. No-op quando o teclado está desligado.
   */
  setActiveField: (fieldId: string | null) => void
  /** Define o próximo estado de shift. No-op quando o teclado está desligado. */
  setShift: (next: boolean) => void
}

export function useVirtualKeyboard(enabled: boolean): VirtualKeyboardState {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [isShifted, setIsShifted] = useState(false)
  // Espelho do id ativo lido fora do render: o `useCallback` é memoizado em [enabled],
  // logo ler `activeFieldId` direto estaria stale. StrictMode-safe: a comparação não vive
  // dentro do updater de estado (que pode rodar 2×).
  const activeFieldIdRef = useRef<string | null>(null)

  const setActiveField = useCallback(
    (fieldId: string | null) => {
      if (!enabled) return
      if (fieldId === activeFieldIdRef.current) return // mesmo id → no-op: NÃO reseta o shift
      activeFieldIdRef.current = fieldId
      setActiveFieldId(fieldId)
      setIsShifted(false) // id mudou → reset do shift (troca de campo)
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
