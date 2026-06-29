import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useKioskMode } from '../useKioskMode'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator as object, 'wakeLock')
  Reflect.deleteProperty(screen as object, 'orientation')
})

describe('useKioskMode', () => {
  it('prevents the global context menu (long-press)', () => {
    renderHook(() => useKioskMode())

    const event = new Event('contextmenu', { cancelable: true })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('requests fullscreen on the first user gesture, only once', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.documentElement.requestFullscreen = requestFullscreen

    renderHook(() => useKioskMode())

    window.dispatchEvent(new Event('pointerdown'))
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1))

    // Segundo toque não dispara fullscreen de novo (listener `once`).
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('attempts to lock portrait orientation on the first gesture', async () => {
    document.documentElement.requestFullscreen = vi
      .fn()
      .mockResolvedValue(undefined)
    const lock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { lock },
    })

    renderHook(() => useKioskMode())
    window.dispatchEvent(new Event('pointerdown'))

    await waitFor(() => expect(lock).toHaveBeenCalledWith('portrait'))
  })

  it('does not throw when fullscreen/orientation APIs are unavailable', () => {
    Reflect.deleteProperty(
      document.documentElement as object,
      'requestFullscreen',
    )

    expect(() => {
      renderHook(() => useKioskMode())
      window.dispatchEvent(new Event('pointerdown'))
    }).not.toThrow()
  })

  it('logs the reason without throwing when fullscreen is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    document.documentElement.requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error('NotAllowedError'))

    renderHook(() => useKioskMode())
    window.dispatchEvent(new Event('pointerdown'))

    await waitFor(() => expect(warn).toHaveBeenCalled())
  })

  it('removes the context menu listener on unmount', () => {
    const { unmount } = renderHook(() => useKioskMode())
    unmount()

    const event = new Event('contextmenu', { cancelable: true })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
