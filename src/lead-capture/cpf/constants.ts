// Constantes do domínio de captura por CPF (HUB-87, antifraude). Módulo puro,
// sem React/DOM. Mantido separado das constantes de LGPD (outro domínio), conforme
// spec docs/specs/HUB-87-cpf-antifraude.md §5.

/**
 * Limite de participações por CPF aplicado quando `leadForm.maxParticipations`
 * está ausente no `config.json`. `1` = uma participação por CPF por evento.
 * `0` (quando configurado explicitamente) significa ilimitado.
 */
export const DEFAULT_MAX_PARTICIPATIONS = 1

/**
 * Código sentinela de participante estrangeiro (HUB-109). NÃO é um CPF válido —
 * `isValidCpf` continua rejeitando-o; o gate o trata como exceção nomeada, sem
 * consulta online, sem autofill e sem limite de participações.
 */
export const FOREIGN_CPF = '11111111111'

/** `true` apenas para o código estrangeiro exato (dígitos já sanitizados). */
export function isForeignCpf(digits: string): boolean {
  return digits === FOREIGN_CPF
}
