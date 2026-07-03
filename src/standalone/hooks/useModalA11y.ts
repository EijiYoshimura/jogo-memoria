// Acessibilidade comum a modais (HUB-91, extraído do `TermsModal`): foco inicial,
// focus-trap com Tab/Shift+Tab, dispensa por Esc e trava do scroll do body enquanto
// aberto. Reutilizado por `TermsModal` e `CpfLimitModal` para não divergir do padrão
// de acessibilidade já validado (HUB-67). O `onKeyDown` deve ser ligado ao backdrop e
// o `cardRef` ao card do diálogo.

import { useCallback, useEffect, useRef } from 'react'

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled'))
}

export interface UseModalA11yParams {
  /** Ação de dispensa (Esc): `TermsModal` fecha; `CpfLimitModal` reseta. */
  onEscape: () => void
  /** Elemento a receber o foco inicial; default = o próprio card. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export interface ModalA11y {
  cardRef: React.RefObject<HTMLDivElement | null>
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function useModalA11y({ onEscape, initialFocusRef }: UseModalA11yParams): ModalA11y {
  const cardRef = useRef<HTMLDivElement>(null)

  // Foco inicial + trava do scroll do body; restaura o overflow anterior no unmount.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(initialFocusRef?.current ?? cardRef.current)?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [initialFocusRef])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab' || !cardRef.current) return
      const focusable = getFocusable(cardRef.current)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onEscape]
  )

  return { cardRef, onKeyDown }
}
