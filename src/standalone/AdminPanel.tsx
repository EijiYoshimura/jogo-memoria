import { useState, useEffect, useCallback } from 'react'
import type { GameConfig } from '../game/types'
import { getAllLeads, getPendingLeads } from './lib/leadsDb'
import { syncPendingLeads } from './lib/leadsSync'
import { supabase } from './lib/supabaseClient'

interface AdminPanelProps {
  config: GameConfig
  onClose: () => void
}

type PanelView = 'pin' | 'dashboard'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 60
const PIN_LENGTH = 4

export function AdminPanel({ config, onClose }: AdminPanelProps) {
  const [view, setView] = useState<PanelView>('pin')
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockCountdown, setLockCountdown] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const [syncedLeads, setSyncedLeads] = useState(0)
  const [pendingLeads, setPendingLeads] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

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

  const loadStats = useCallback(async () => {
    const all = await getAllLeads()
    const pending = await getPendingLeads()
    setTotalLeads(all.length)
    setPendingLeads(pending.length)
    setSyncedLeads(all.filter((l) => l.synced).length)
  }, [])

  useEffect(() => {
    if (view === 'dashboard') {
      loadStats()
    }
  }, [view, loadStats])

  function handleDigit(digit: string) {
    if (lockedUntil) return
    if (pin.length >= PIN_LENGTH) return
    const next = pin + digit
    setPin(next)

    if (next.length === PIN_LENGTH) {
      if (next === config.adminPin) {
        setPin('')
        setView('dashboard')
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setPin('')
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000)
          setLockCountdown(LOCKOUT_SECONDS)
        }
      }
    }
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1))
  }

  async function handleForceSync() {
    setIsSyncing(true)
    setSyncMessage('')
    await syncPendingLeads()
    await loadStats()
    setIsSyncing(false)
    setSyncMessage('Sincronização concluída.')
  }

  async function handleExportCsv() {
    const localLeads = await getAllLeads()
    const localPending = localLeads.filter((l) => !l.synced)

    const { data: remoteLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('event_id', config.event.id)

    const fieldIds = config.leadForm.fields.map((f) => f.id)
    const fieldLabels = config.leadForm.fields.map((f) => f.label)
    const fixedHeaders = ['played_at', 'score', 'time_taken', 'synced_from']
    const headers = [...fieldLabels, ...fixedHeaders]

    const rows: string[][] = []

    if (remoteLeads) {
      for (const lead of remoteLeads) {
        const row = [
          ...fieldIds.map((id) => (lead.data as Record<string, string>)[id] ?? ''),
          lead.played_at ?? '',
          String(lead.score ?? ''),
          String(lead.time_taken ?? ''),
          lead.synced_from ?? 'online',
        ]
        rows.push(row)
      }
    }

    for (const lead of localPending) {
      const row = [
        ...fieldIds.map((id) => lead.data[id] ?? ''),
        lead.playedAt,
        String(lead.score),
        String(lead.timeTaken),
        'offline-sync',
      ]
      rows.push(row)
    }

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

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

  if (view === 'pin') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-2xl p-8 w-80 flex flex-col items-center gap-6">
          <h2 className="text-white text-2xl font-bold">Admin</h2>

          <div className="flex gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 ${
                  i < pin.length ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                }`}
              />
            ))}
          </div>

          {lockedUntil ? (
            <p className="text-red-400 text-center">
              Bloqueado por {lockCountdown}s
            </p>
          ) : (
            attempts > 0 && (
              <p className="text-red-400 text-sm">
                PIN incorreto. Tentativa {attempts}/{MAX_ATTEMPTS}
              </p>
            )
          )}

          <div className="grid grid-cols-3 gap-3 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-2xl font-bold rounded-xl py-4 transition-colors disabled:opacity-40"
                disabled={!!lockedUntil}
                onClick={() => handleDigit(digit)}
              >
                {digit}
              </button>
            ))}
            <button
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-lg rounded-xl py-4 transition-colors"
              onClick={onClose}
            >
              Sair
            </button>
            <button
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-2xl font-bold rounded-xl py-4 transition-colors disabled:opacity-40"
              disabled={!!lockedUntil}
              onClick={() => handleDigit('0')}
            >
              0
            </button>
            <button
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-lg rounded-xl py-4 transition-colors"
              onClick={handleBackspace}
            >
              ←
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col p-8 z-50 overflow-y-auto">
      <h2 className="text-white text-3xl font-bold mb-6">Painel Admin</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Total de leads</p>
          <p className="text-white text-4xl font-bold">{totalLeads}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Sincronizados</p>
          <p className="text-green-400 text-4xl font-bold">{syncedLeads}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">Pendentes</p>
          <p className="text-yellow-400 text-4xl font-bold">{pendingLeads}</p>
        </div>
      </div>

      {syncMessage && (
        <p className="text-green-400 mb-4">{syncMessage}</p>
      )}

      <div className="flex flex-col gap-4">
        <button
          className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xl font-bold rounded-xl py-4 transition-colors"
          onClick={handleExportCsv}
        >
          Exportar CSV
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold rounded-xl py-4 transition-colors disabled:opacity-50"
          disabled={isSyncing}
          onClick={handleForceSync}
        >
          {isSyncing ? 'Sincronizando...' : 'Forçar Sync'}
        </button>
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
