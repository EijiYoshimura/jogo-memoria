import { useEffect } from 'react'
import { useWakeLock } from './useWakeLock'

/** Entrada de fullscreen com prefixo de vendor, ausente da lib DOM padrão. */
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

/** `ScreenOrientation.lock` ainda não consta na tipagem da lib DOM. */
interface LockableOrientation extends ScreenOrientation {
  lock?: (orientation: 'portrait') => Promise<void>
}

function requestFullscreen(): void {
  const element = document.documentElement as FullscreenElement
  const request = element.requestFullscreen ?? element.webkitRequestFullscreen
  if (!request) {
    return
  }
  // Best-effort: o usuário pode negar, ou o browser (PWA standalone no iOS
  // Safari) pode não honrar — o `display:fullscreen/standalone` do manifest é a
  // garantia principal, então uma rejeição aqui não é fatal.
  Promise.resolve(request.call(element)).catch((error) => {
    console.warn('[kiosk] Fullscreen indisponível:', error)
  })
}

function lockPortraitOrientation(): void {
  const orientation = screen.orientation as LockableOrientation | undefined
  if (!orientation?.lock) {
    return
  }
  // A maioria dos browsers só honra o lock em fullscreen e muitos o rejeitam de
  // todo; `manifest.orientation: portrait` é a garantia real. Não bloqueia.
  orientation.lock('portrait').catch((error) => {
    console.warn('[kiosk] Bloqueio de orientação indisponível:', error)
  })
}

/**
 * Endurece a experiência para o totem em modo kiosk:
 * - mantém a tela ligada (`useWakeLock`);
 * - no 1º gesto do usuário, tenta fullscreen + travar a orientação em retrato
 *   (ambos best-effort, sem quebrar onde não há suporte);
 * - bloqueia o menu de contexto (long-press) globalmente.
 *
 * Sem lógica de negócio — apenas adapta a camada de apresentação ao totem.
 */
export function useKioskMode(): void {
  useWakeLock()

  useEffect(() => {
    const enterFullscreenOnFirstGesture = (): void => {
      requestFullscreen()
      lockPortraitOrientation()
    }
    window.addEventListener('pointerdown', enterFullscreenOnFirstGesture, {
      once: true,
    })

    const blockContextMenu = (event: Event): void => event.preventDefault()
    document.addEventListener('contextmenu', blockContextMenu)

    return () => {
      window.removeEventListener('pointerdown', enterFullscreenOnFirstGesture)
      document.removeEventListener('contextmenu', blockContextMenu)
    }
  }, [])
}
