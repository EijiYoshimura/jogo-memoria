import { useState, useEffect } from 'react'
import type { GameConfig } from '../game/types'
import { getAllLeads, getPendingLeads } from './lib/leadsDb'
import { syncPendingLeads } from './lib/leadsSync'
import { listAdminLeads, type RemoteLead } from './lib/adminLeads'
import { buildLeadsCsv } from './lib/leadsCsv'

interface AdminPanelProps {
  config: GameConfig
  onClose: () => void
}

type PanelView = 'secret' | 'dashboard'
type DashboardMode = 'online' | 'offline'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 60

export function AdminPanel({ config, onClose }: AdminPanelProps) {
  const [view, setView] = useState<PanelView>('secret')
  const [mode, setMode] = useState<DashboardMode>('online')
  const [secretInput, setSecretInput] = useState('')
  const [authSecret, setAuthSecret] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockCountdown, setLockCountdown] = useState(0)
  const [remoteLeads, setRemoteLeads] = useState<RemoteLead[]>([])
  const [syncedLeads, setSyncedLeads] = useState(0)
  const [pendingLeads, setPendingLeads] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    if (!lockedUntil) return
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setAttempts(0)
        clearInterval(interval)
      } else {
        setLockCountdown(remaining)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  function registerFailedAttempt(message: string) {
    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    setSecretInput('')
    setAuthError(message)
    if (nextAttempts >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000)
      setLockCountdown(LOCKOUT_SECONDS)
    }
  }

  async function computeCounts(remote: RemoteLead[]) {
    const pending = await getPendingLeads()
    setSyncedLeads(remote.length)
    setPendingLeads(pending.length)
    setTotalLeads(remote.length + pending.length)
  }

  async function enterOnline(secret: string, leads: RemoteLead[]) {
    setAuthSecret(secret)
    setRemoteLeads(leads)
    setMode('online')
    setView('dashboard')
    await computeCounts(leads)
  }

  async function enterOffline() {
    const all = await getAllLeads()
    setRemoteLeads([])
    setPendingLeads(all.filter((lead) => !lead.synced).length)
    setTotalLeads(all.length)
    setMode('offline')
    setView('dashboard')
  }

  async function handleOnlineUnlock(secret: string) {
    setIsAuthenticating(true)
    try {
      const result = await listAdminLeads(config.event.id, secret)
      if (result.status === 'authorized') {
        setAuthError(null)
        setAttempts(0)
        setSecretInput('')
        await enterOnline(secret, result.leads)
      } else if (result.status === 'unauthorized') {
        registerFailedAttempt('Senha incorreta.')
      } else {
        setAuthError('Sem conexão. Use o PIN de export offline para os leads locais.')
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'erro desconhecido'
      setAuthError(`Falha ao autorizar: ${detail}`)
    } finally {
      setIsAuthenticating(false)
    }
  }

  async function handleSubmit() {
    if (lockedUntil || isAuthenticating) return
    const secret = secretInput
    if (secret.length === 0) return

    if (!navigator.onLine) {
      if (secret === config.offlineExportPin) {
        setAuthError(null)
        setAttempts(0)
        setSecretInput('')
        await enterOffline()
      } else {
        registerFailedAttempt('PIN de export offline incorreto.')
      }
      return
    }

    await handleOnlineUnlock(secret)
  }

  async function handleForceSync() {
    setIsSyncing(true)
    setSyncMessage('')
    try {
      await syncPendingLeads()
      const result = await listAdminLeads(config.event.id, authSecret)
      if (result.status === 'authorized') {
        setStatsError(null)
        setRemoteLeads(result.leads)
        await computeCounts(result.leads)
      } else if (result.status === 'unauthorized') {
        setStatsError('Sessão expirou. Reabra o painel e informe a senha novamente.')
      } else {
        setStatsError('Sem conexão para atualizar os sincronizados.')
      }
      setSyncMessage('Sincronização concluída.')
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'erro desconhecido'
      setStatsError(`Falha ao sincronizar: ${detail}`)
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleExportCsv() {
    const allLocal = await getAllLeads()
    const csvContent =
      mode === 'online'
        ? buildLeadsCsv(config, remoteLeads, allLocal.filter((lead) => !lead.synced))
        : buildLeadsCsv(config, [], allLocal)

    const today = new Date().toISOString().slice(0, 10)
    const filename = `leads-${config.event.id}-${today}.csv`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (view === 'secret') {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
        <form
          className="bg-gray-900 rounded-2xl p-8 w-96 flex flex-col items-center gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <h2 className="text-white text-2xl font-bold">Admin</h2>

          <p className="text-gray-300 text-sm text-center">
            {offline
              ? 'Sem conexão — informe o PIN de export offline (leads locais deste dispositivo).'
              : 'Informe a senha do painel para acessar os leads do evento.'}
          </p>

          <input
            type="password"
            className="w-full bg-gray-800 text-white text-center text-xl rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
            value={secretInput}
            aria-label={offline ? 'PIN de export offline' : 'Senha do painel admin'}
            autoComplete="off"
            autoFocus
            disabled={!!lockedUntil || isAuthenticating}
            onChange={(e) => setSecretInput(e.target.value)}
          />

          {lockedUntil ? (
            <p className="text-red-400 text-center">Bloqueado por {lockCountdown}s</p>
          ) : (
            authError && <p className="text-red-400 text-sm text-center">{authError}</p>
          )}
          {!lockedUntil && attempts > 0 && (
            <p className="text-gray-400 text-xs">
              Tentativa {attempts}/{MAX_ATTEMPTS}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-lg font-bold rounded-xl py-3 transition-colors disabled:opacity-40"
            disabled={!!lockedUntil || isAuthenticating || secretInput.length === 0}
          >
            {isAuthenticating ? 'Verificando...' : 'Entrar'}
          </button>
          <button
            type="button"
            className="w-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-lg rounded-xl py-3 transition-colors"
            onClick={onClose}
          >
            Sair
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col p-8 z-50 overflow-y-auto">
      <h2 className="text-white text-3xl font-bold mb-6">Painel Admin</h2>

      {mode === 'offline' && (
        <div className="bg-yellow-900 border border-yellow-500 rounded-xl p-4 mb-6 text-yellow-200 text-sm">
          Modo offline: exibindo apenas os leads locais deste dispositivo. Os
          totais sincronizados ficam indisponíveis sem conexão.
        </div>
      )}

      {statsError && (
        <div className="bg-red-900 border border-red-500 rounded-xl p-4 mb-6 text-red-200 text-sm">
          {statsError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">
            {mode === 'offline' ? 'Total local' : 'Total de leads'}
          </p>
          <p className="text-white text-4xl font-bold">{totalLeads}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Sincronizados</p>
          {mode === 'offline' ? (
            <p className="text-gray-500 text-lg font-bold mt-3">indisponível offline</p>
          ) : (
            <p className="text-green-400 text-4xl font-bold">{syncedLeads}</p>
          )}
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Pendentes</p>
          <p className="text-yellow-400 text-4xl font-bold">{pendingLeads}</p>
        </div>
      </div>

      {syncMessage && <p className="text-green-400 mb-4">{syncMessage}</p>}

      <div className="flex flex-col gap-4">
        <button
          className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xl font-bold rounded-xl py-4 transition-colors"
          onClick={handleExportCsv}
        >
          Exportar CSV
        </button>
        {mode === 'online' && (
          <button
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold rounded-xl py-4 transition-colors disabled:opacity-50"
            disabled={isSyncing}
            onClick={handleForceSync}
          >
            {isSyncing ? 'Sincronizando...' : 'Forçar Sync'}
          </button>
        )}
        <button
          className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xl font-bold rounded-xl py-4 transition-colors"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
