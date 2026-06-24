import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { GameConfig } from '../game/types'

interface ConfigContextValue {
  config: GameConfig
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function useConfig(): GameConfig {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider')
  return ctx.config
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; config: GameConfig }

function isValidConfig(value: unknown): value is GameConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v['event'] === 'object' &&
    typeof v['game'] === 'object' &&
    typeof v['leadForm'] === 'object' &&
    typeof v['adminPin'] === 'string'
  )
}

interface ConfigProviderProps {
  children: ReactNode
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    fetch('/config.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: unknown) => {
        if (!isValidConfig(data)) {
          throw new Error('config.json mal formado ou incompleto')
        }
        setState({ status: 'ready', config: data })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setState({ status: 'error', message })
      })
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white text-2xl">
        Carregando configuração...
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-900 text-white gap-4 p-8">
        <div className="text-4xl font-bold">Erro de Configuração</div>
        <div className="text-xl text-center">{state.message}</div>
        <div className="text-base text-red-200 text-center">
          Verifique o arquivo <code>/public/config.json</code> e recarregue a página.
        </div>
      </div>
    )
  }

  return (
    <ConfigContext.Provider value={{ config: state.config }}>
      {children}
    </ConfigContext.Provider>
  )
}
