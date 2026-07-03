// Constantes do domínio de captura por CPF (HUB-87, antifraude). Módulo puro,
// sem React/DOM. Mantido separado das constantes de LGPD (outro domínio), conforme
// spec docs/specs/HUB-87-cpf-antifraude.md §5.

/**
 * Limite de participações por CPF aplicado quando `leadForm.maxParticipations`
 * está ausente no `config.json`. `1` = uma participação por CPF por evento.
 * `0` (quando configurado explicitamente) significa ilimitado.
 */
export const DEFAULT_MAX_PARTICIPATIONS = 1
