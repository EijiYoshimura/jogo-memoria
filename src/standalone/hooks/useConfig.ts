import { createContext, useContext } from 'react'
import type { GameConfig } from '../../game/types'

export interface ConfigContextValue {
  config: GameConfig
}

/**
 * Context neutro do config. Vive fora do `ConfigLoader.tsx` para que o arquivo
 * do provider exporte apenas componentes (react-refresh/only-export-components).
 * Provider e hook compartilham este módulo sem import circular.
 */
export const ConfigContext = createContext<ConfigContextValue | null>(null)

export function useConfig(): GameConfig {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider')
  return ctx.config
}
