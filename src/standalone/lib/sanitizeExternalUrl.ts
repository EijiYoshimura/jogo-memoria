// Saneamento defensivo (anti-XSS) de URLs vindas do config do operador antes de
// renderizá-las em atributos do DOM (href/src). Allowlist de esquemas: somente
// http:/https: e URLs relativas são permitidas; esquemas perigosos
// (javascript:, data:, vbscript:, file:, ...) são rejeitados.
//
// Função pura, sem dependência de React/DOM. Erro de parsing não é silenciado:
// é convertido em "URL ausente" (undefined), estado válido e tratado pelos
// consumidores via o padrão `valor && (<elemento/>)`.

// Esquemas permitidos. URLs relativas resolvem para https: contra a base
// sintética e também passam.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

// Base fixa e determinística para resolver URLs relativas sem depender de
// window.location. `.invalid` é um TLD reservado (RFC 2606), garantidamente
// não roteável.
const SYNTHETIC_BASE = 'https://example.invalid/'

/**
 * Valida o esquema de uma URL de config. Retorna a string original quando o
 * esquema é permitido (http/https/relativa) ou `undefined` quando é perigoso,
 * malformado, vazio ou ausente.
 *
 * IMPORTANTE: retorna sempre o `raw` original, nunca `parsed.href` — resolver a
 * relativa contra a base sintética e devolvê-la transformaria `/policy.html` em
 * uma absoluta apontando para o domínio falso (regressão).
 */
export function sanitizeExternalUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined

  try {
    const parsed = new URL(raw, SYNTHETIC_BASE)
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? raw : undefined
  } catch {
    // URL inválida (não parseável) → tratada como ausente (fail-safe).
    return undefined
  }
}
