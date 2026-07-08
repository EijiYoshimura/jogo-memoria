import { describe, it, expect, beforeEach } from 'vitest'
import { getOrCreateDeviceId } from '../deviceId'

const STORAGE_KEY = 'jogo-memoria:device-id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('gera um novo UUID na 1ª chamada e persiste em localStorage', () => {
    const deviceId = getOrCreateDeviceId()

    expect(deviceId).toMatch(UUID_PATTERN)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(deviceId)
  })

  it('reaproveita o id persistido nas chamadas seguintes, sem gerar um novo', () => {
    const first = getOrCreateDeviceId()
    const second = getOrCreateDeviceId()
    const third = getOrCreateDeviceId()

    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('lê o id já existente em localStorage (ex.: persistido em outra sessão) em vez de gerar um novo', () => {
    localStorage.setItem(STORAGE_KEY, 'id-ja-persistido-antes')

    expect(getOrCreateDeviceId()).toBe('id-ja-persistido-antes')
  })
})
