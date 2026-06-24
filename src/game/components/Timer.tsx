import { useEffect, useRef } from 'react'

interface TimerProps {
  timeRemaining: number
  onTick: () => void
  onTimeout: () => void
  isRunning: boolean
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function Timer({ timeRemaining, onTick, onTimeout, isRunning }: TimerProps) {
  const onTickRef = useRef(onTick)
  const onTimeoutRef = useRef(onTimeout)
  onTickRef.current = onTick
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return
    const interval = setInterval(() => {
      onTickRef.current()
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, timeRemaining])

  useEffect(() => {
    if (timeRemaining <= 0 && isRunning) {
      onTimeoutRef.current()
    }
  }, [timeRemaining, isRunning])

  const isUrgent = timeRemaining <= 10

  return (
    <div
      className={`text-4xl font-bold tabular-nums ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white'}`}
    >
      {formatTime(timeRemaining)}
    </div>
  )
}
