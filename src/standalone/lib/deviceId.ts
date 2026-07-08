const DEVICE_ID_STORAGE_KEY = 'jogo-memoria:device-id'

/**
 * Identificador estável deste dispositivo (não de usuário — ADR-012), usado apenas como
 * parâmetro `p_device_id` da RPC `admin_purge_leads` (HUB-151/ADR-015). Função pura quanto
 * a rede: nunca envia o valor a lugar nenhum — isso é responsabilidade de quem a chama.
 *
 * Gerado com `crypto.randomUUID()` na primeira chamada e persistido em `localStorage`;
 * chamadas seguintes reaproveitam o mesmo valor.
 */
export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing

  const deviceId = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
  return deviceId
}
