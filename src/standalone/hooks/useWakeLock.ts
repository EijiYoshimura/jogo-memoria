import { useCallback, useEffect, useRef } from 'react'

/**
 * Mantém a tela do tablet ligada via Screen Wake Lock API enquanto o componente
 * está montado e o documento visível.
 *
 * O sentinel é re-adquirido sempre que a aba volta ao primeiro plano — o SO
 * libera o lock ao trocar de app / bloquear a tela — e liberado no unmount.
 *
 * Fallback grácil: em browsers sem a API (notadamente iOS Safari) o hook vira
 * um no-op e a operação depende do ajuste de auto-lock do SO, documentado em
 * `docs/kiosk-setup.md`. Falhas são logadas, nunca engolidas em silêncio.
 */
export function useWakeLock(): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = useCallback(async (): Promise<void> => {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
      return
    }
    if (sentinelRef.current && !sentinelRef.current.released) {
      return
    }
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
    } catch (error) {
      // NotAllowedError (bateria baixa, aba oculta) ou ausência de permissão:
      // o fallback é o auto-lock do SO. Expõe o motivo em vez de silenciar.
      console.warn('[kiosk] Screen Wake Lock indisponível:', error)
    }
  }, [])

  useEffect(() => {
    void acquire()

    const reacquireWhenVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', reacquireWhenVisible)

    return () => {
      document.removeEventListener('visibilitychange', reacquireWhenVisible)
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch((error) => {
          console.warn('[kiosk] Falha ao liberar o Wake Lock:', error)
        })
      }
    }
  }, [acquire])
}
