import { useEffect } from 'react'
import type { GameStatus } from '../domain/entities/GameSession'

interface TimerProps {
  status: GameStatus
  timeRemaining: number
  onTick: (remaining: number) => void
  onTimeout: () => void
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function Timer({ status, timeRemaining, onTick, onTimeout }: TimerProps) {
  useEffect(() => {
    if (status !== 'playing') return

    const id = setInterval(() => {
      onTick(timeRemaining - 1)
    }, 1000)

    return () => clearInterval(id)
  }, [status, timeRemaining, onTick])

  useEffect(() => {
    if (timeRemaining <= 0 && status === 'playing') {
      onTimeout()
    }
  }, [timeRemaining, status, onTimeout])

  const isUrgent = timeRemaining <= 10

  return (
    <div
      className={`text-4xl font-bold tabular-nums ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white'}`}
    >
      {formatTime(timeRemaining)}
    </div>
  )
}
