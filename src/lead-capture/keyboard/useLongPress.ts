// Hook de apresentação: detecta long-press via pointer events para abrir o popup
// de variantes acentuadas. Sem lógica de negócio, sem geometria (a seleção da
// variante é feita pelo próprio botão da variante no VirtualKeyboard).

import { useCallback, useEffect, useRef } from 'react'

/** Tempo de hold (ms) para abrir o popup de variantes. Exposto para ajuste fino. */
export const HOLD_MS = 350

export interface LongPressHandlers {
  onPointerDown: () => void
  onPointerUp: () => void
  onPointerLeave: () => void
  onPointerCancel: () => void
}

export interface UseLongPressResult {
  handlers: LongPressHandlers
  /**
   * Indica (e consome) se o `click` sintético seguinte ao pointerup deve ser
   * suprimido — quando o long-press já disparou, a tecla base NÃO é inserida.
   */
  consumeSuppressedClick: () => boolean
}

interface UseLongPressOptions {
  /** Disparado ao atingir o threshold de hold sem soltar. */
  onLongPress: () => void
  /** Quando false, os handlers são inertes (tecla sem variantes / funcional). */
  enabled: boolean
}

export function useLongPress({ onLongPress, enabled }: UseLongPressOptions): UseLongPressResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(() => {
    if (!enabled) return
    firedRef.current = false
    cancelTimer()
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, HOLD_MS)
  }, [enabled, onLongPress, cancelTimer])

  const onPointerUp = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  const onPointerLeave = useCallback(() => {
    cancelTimer()
  }, [cancelTimer])

  const consumeSuppressedClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false
      return true
    }
    return false
  }, [])

  // Limpa o timer pendente ao desmontar (evita vazamento).
  useEffect(() => cancelTimer, [cancelTimer])

  return {
    handlers: { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel: onPointerLeave },
    consumeSuppressedClick,
  }
}
