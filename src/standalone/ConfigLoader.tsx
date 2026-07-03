import { useEffect, useState, type ReactNode } from 'react'
import type { GameConfig } from '../game/types'
import { DEFAULT_MAX_PARTICIPATIONS } from '../lead-capture/cpf/constants'
import { ConfigContext } from './hooks/useConfig'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; config: GameConfig }

function isValidConfig(c: unknown): c is GameConfig {
  if (!c || typeof c !== 'object') return false
  const cfg = c as Record<string, unknown>

  const event = cfg['event'] as Record<string, unknown> | undefined
  if (!event || typeof event['id'] !== 'string' || typeof event['name'] !== 'string') return false

  const game = cfg['game'] as Record<string, unknown> | undefined
  if (!game) return false
  if (typeof game['pairs'] !== 'number' || (game['pairs'] as number) < 2) return false
  if (!Array.isArray(game['cardImages']) || (game['cardImages'] as unknown[]).length < (game['pairs'] as number)) return false
  if (typeof game['timeLimitSeconds'] !== 'number' || (game['timeLimitSeconds'] as number) < 10) return false

  const leadForm = cfg['leadForm'] as Record<string, unknown> | undefined
  if (!leadForm || !Array.isArray(leadForm['fields'])) return false

  // Limite de participações por CPF (HUB-87, antifraude): opcional e retrocompatível.
  // Quando presente, precisa ser inteiro >= 0 (0 = ilimitado). Falha alto se malformado,
  // no mesmo padrão do offlineExportPin — erro visível, sem default silencioso para valor
  // inválido. Ausência ⇒ default aplicado em withConfigDefaults, após a validação.
  const maxParticipations = leadForm['maxParticipations']
  if (
    maxParticipations !== undefined &&
    (typeof maxParticipations !== 'number' ||
      !Number.isInteger(maxParticipations) ||
      maxParticipations < 0)
  ) {
    return false
  }

  // Gate offline-only (HUB-88): PIN de baixo valor para o export local do
  // IndexedDB. NÃO é o segredo do Admin online — este vive no servidor (RPC).
  if (typeof cfg['offlineExportPin'] !== 'string' || !/^\d{4,6}$/.test(cfg['offlineExportPin'] as string)) return false

  return true
}

/**
 * Aplica defaults retrocompatíveis ao config já validado. Hoje só o
 * `leadForm.maxParticipations` (HUB-87): ausente ⇒ `DEFAULT_MAX_PARTICIPATIONS`.
 * Mantém o config imutável (retorna cópia rasa das partes alteradas).
 */
function withConfigDefaults(config: GameConfig): GameConfig {
  return {
    ...config,
    leadForm: {
      ...config.leadForm,
      maxParticipations: config.leadForm.maxParticipations ?? DEFAULT_MAX_PARTICIPATIONS,
    },
  }
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
        setState({ status: 'ready', config: withConfigDefaults(data) })
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
