import { useCallback, useRef } from 'react'
import type { GameConfig } from '../game/types'

interface SplashScreenProps {
  config: GameConfig
  onStart: () => void
  onAdminAccess: () => void
}

const DEFAULT_ACCENT_COLOR = '#FCFC30'
const CTA_TEXT_COLOR = '#0333BD'

export function SplashScreen({ config, onStart, onAdminAccess }: SplashScreenProps) {
  const logoTapsRef = useRef<number[]>([])
  const accent = config.event.accentColor ?? DEFAULT_ACCENT_COLOR

  const handleLogoTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation()
      const now = Date.now()
      logoTapsRef.current = [...logoTapsRef.current, now].filter((t) => now - t < 3000)

      if (logoTapsRef.current.length >= 5) {
        logoTapsRef.current = []
        onAdminAccess()
      }
    },
    [onAdminAccess]
  )

  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full select-none overflow-hidden rounded-[2.25rem] border-8 border-white"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div className="flex flex-col items-center gap-6 w-full" onClick={handleLogoTap}>
        <img
          src={config.event.logo}
          alt={config.event.name}
          className="w-[75%] object-contain"
          draggable={false}
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
          }}
        />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-16 rounded-full border-4 border-white font-bb-titulos font-extrabold uppercase text-2xl min-h-[56px] px-10 transition-opacity active:opacity-80"
        style={{ backgroundColor: accent, color: CTA_TEXT_COLOR }}
      >
        TOQUE PARA JOGAR
      </button>
    </div>
  )
}
