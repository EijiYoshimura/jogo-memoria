import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVirtualKeyboard } from '../useVirtualKeyboard'

describe('useVirtualKeyboard', () => {
  it('re-focar o MESMO campo NÃO reseta o shift (fix do re-foco — Cenário 2)', () => {
    const { result } = renderHook(() => useVirtualKeyboard(true))

    act(() => result.current.setActiveField('name'))
    act(() => result.current.setShift(true))
    expect(result.current.isShifted).toBe(true)

    // Simula o re-foco do mesmo campo (efeito do reposicionamento de caret — HUB-69).
    act(() => result.current.setActiveField('name'))
    act(() => result.current.setActiveField('name'))
    expect(result.current.isShifted).toBe(true)
    expect(result.current.activeFieldId).toBe('name')
  })

  it('trocar para outro campo (id diferente) reseta o shift (Cenário 9)', () => {
    const { result } = renderHook(() => useVirtualKeyboard(true))

    act(() => result.current.setActiveField('name'))
    act(() => result.current.setShift(true))
    expect(result.current.isShifted).toBe(true)

    act(() => result.current.setActiveField('email'))
    expect(result.current.isShifted).toBe(false)
    expect(result.current.activeFieldId).toBe('email')
  })

  it('com enabled:false os setters são no-op (regressão HUB-57)', () => {
    const { result } = renderHook(() => useVirtualKeyboard(false))

    act(() => result.current.setActiveField('name'))
    act(() => result.current.setShift(true))
    expect(result.current.activeFieldId).toBeNull()
    expect(result.current.isShifted).toBe(false)
  })

  it('setShift alterna o shift sem afetar o campo ativo', () => {
    const { result } = renderHook(() => useVirtualKeyboard(true))

    act(() => result.current.setActiveField('name'))
    act(() => result.current.setShift(true))
    expect(result.current.isShifted).toBe(true)
    act(() => result.current.setShift(false))
    expect(result.current.isShifted).toBe(false)
    expect(result.current.activeFieldId).toBe('name')
  })
})
