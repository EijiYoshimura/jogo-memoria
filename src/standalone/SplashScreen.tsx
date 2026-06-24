import { useCallback, useRef } from 'react'
import type { GameConfig } from '../game/types'

interface SplashScreenProps {
  config: GameConfig
  onStart: () => void
  onAdminAccess: () => void
}

export function SplashScreen({ config, onStart, onAdminAccess }: SplashScreenProps) {
  const logoTapsRef = useRef<number[]>([])

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
      className="flex flex-col items-center justify-center h-full w-full cursor-pointer select-none"
      style={{ backgroundColor: config.event.backgroundColor }}
      onClick={onStart}
    >
      <div
        className="flex flex-col items-center gap-6"
        onClick={handleLogoTap}
      >
        <img
          src={config.event.logo}
          alt={config.event.name}
          className="w-48 h-48 object-contain"
          draggable={false}
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
          }}
        />
        <h1
          className="text-5xl font-bold text-center"
          style={{ color: config.event.primaryColor }}
        >
          {config.event.name}
        </h1>
      </div>

      <p
        className="mt-16 text-2xl font-medium animate-pulse"
        style={{ color: config.event.primaryColor }}
      >
        Toque para jogar
      </p>
    </div>
  )
}
