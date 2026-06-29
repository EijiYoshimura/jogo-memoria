import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWakeLock } from '../useWakeLock'

interface FakeSentinel {
  released: boolean
  release: ReturnType<typeof vi.fn>
}

function createSentinel(): FakeSentinel {
  return { released: false, release: vi.fn().mockResolvedValue(undefined) }
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function installWakeLock(
  request: ReturnType<typeof vi.fn>,
): void {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request },
  })
}

function removeWakeLock(): void {
  Reflect.deleteProperty(navigator as object, 'wakeLock')
}

describe('useWakeLock', () => {
  beforeEach(() => {
    setVisibility('visible')
  })

  afterEach(() => {
    removeWakeLock()
    vi.restoreAllMocks()
  })

  it('acquires a screen wake lock on mount', async () => {
    const sentinel = createSentinel()
    const request = vi.fn().mockResolvedValue(sentinel)
    installWakeLock(request)

    renderHook(() => useWakeLock())

    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('re-acquires the lock when the document becomes visible again', async () => {
    const first = createSentinel()
    const second = createSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
    installWakeLock(request)

    renderHook(() => useWakeLock())
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    // O SO libera o lock ao ocultar a aba; ao voltar, o hook re-adquire.
    first.released = true
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })

  it('does not re-acquire while the still-active lock is held', async () => {
    const sentinel = createSentinel()
    const request = vi.fn().mockResolvedValue(sentinel)
    installWakeLock(request)

    renderHook(() => useWakeLock())
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    // Lock ainda ativo (released=false) → nova visibilidade não re-solicita.
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('releases the lock on unmount', async () => {
    const sentinel = createSentinel()
    const request = vi.fn().mockResolvedValue(sentinel)
    installWakeLock(request)

    const { unmount } = renderHook(() => useWakeLock())
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    unmount()

    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('is a graceful no-op when the Wake Lock API is unavailable', async () => {
    removeWakeLock()

    expect(() => {
      const { unmount } = renderHook(() => useWakeLock())
      unmount()
    }).not.toThrow()
  })

  it('logs the reason without throwing when the request is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const request = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    installWakeLock(request)

    renderHook(() => useWakeLock())

    await waitFor(() => expect(warn).toHaveBeenCalled())
  })

  it('does not request a lock while the document is hidden', async () => {
    setVisibility('hidden')
    const request = vi.fn().mockResolvedValue(createSentinel())
    installWakeLock(request)

    renderHook(() => useWakeLock())
    await Promise.resolve()

    expect(request).not.toHaveBeenCalled()
  })
})
