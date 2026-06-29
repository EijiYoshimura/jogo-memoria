# Spec: Validar esquema de URL de config (hardening anti-XSS)

> Issue: **HUB-61** · Tipo: tech-debt · Prioridade: Low · Sprint 1
> Origem: ressalva não-bloqueante do code review do PR #6 (HUB-60).

## Contexto

URLs vindas do arquivo de configuração do operador são renderizadas diretamente
em atributos do DOM sem validação de esquema:

- `config.lgpd.privacyPolicyUrl` → `href` do link "Ler Política de Privacidade"
  em `src/standalone/TermsModal.tsx`.
- `config.event.logo` → `src` da imagem em `src/standalone/SplashScreen.tsx`.

Um valor `javascript:...` em `href` executa script ao clique; um `data:...` em
`href`/`src` é um vetor teórico de injeção. Como o config é controlado pelo
operador o risco é baixo, mas é defesa em profundidade barata e elimina a
ressalva herdada da HUB-60. Comportamento **pré-existente** (não introduzido pela
HUB-60).

## User Story

Como **operador responsável pela configuração do totem**, quero que URLs
inválidas ou perigosas no config sejam ignoradas em vez de renderizadas, para que
um valor malformado (acidental ou malicioso) não vire um vetor de execução de
script na tela do participante.

## Critérios de Aceite

- [ ] **CA1 — href seguro:** Given um `lgpd.privacyPolicyUrl` com esquema
  `http:`, `https:` ou uma URL relativa, When a `TermsModal` renderiza, Then o
  link "Ler Política de Privacidade" é exibido com esse `href`.
- [ ] **CA2 — href perigoso rejeitado:** Given um `lgpd.privacyPolicyUrl` com
  esquema `javascript:`, `data:`, `vbscript:` ou `file:`, When a `TermsModal`
  renderiza, Then o link **não** é renderizado (tratado como ausente) — nenhum
  `href` perigoso chega ao DOM.
- [ ] **CA3 — logo seguro:** Given um `event.logo` com esquema perigoso, When a
  `SplashScreen` renderiza, Then o `src` não recebe o valor perigoso (imagem
  omitida); URLs `http(s):`/relativas continuam funcionando normalmente.
- [ ] **CA4 — testes:** existe teste cobrindo a rejeição de pelo menos um esquema
  perigoso para `privacyPolicyUrl` e para `event.logo`, além do caminho feliz.
- [ ] **CA5 — gate completo verde:** lint + type-check + testes passam, sem
  regressão nas suítes existentes (`TermsModal`, `SplashScreen`).

## Design

Sem componente visual novo. Comportamento puramente defensivo: quando a URL é
rejeitada, o link/imagem simplesmente não aparece (mesma UX de "config ausente",
que já é suportada — ambos os campos são opcionais).

## Spec Técnica

### Arquitetura envolvida

- **Nova função pura** `sanitizeExternalUrl(raw: string | undefined): string | undefined`
  em `src/standalone/lib/` (camada de utilidades — sem dependência de React/DOM).
  - Allowlist de esquemas: `http:`, `https:`.
  - URLs relativas (sem esquema — começam com `/`, `./`, `../` ou sem `:` antes
    de `/`) são permitidas.
  - Qualquer outro esquema (`javascript:`, `data:`, `vbscript:`, `file:`, …)
    retorna `undefined`.
  - Parsing robusto via `new URL(raw, base)` com `try/catch`; entradas que não
    parseiam retornam `undefined` (fail-safe — erro não é silenciado, é
    convertido em "URL ausente", que é estado válido e tratado).

  **Detalhes de implementação (Tech Lead — obrigatórios):**
  1. **Retornar o `raw` original, NUNCA `parsed.href`.** Use `new URL` apenas
     para *validar* o esquema (`parsed.protocol`). Se retornasse `parsed.href`,
     uma URL relativa válida (`/policy.html`) seria resolvida contra a `base`
     sintética e viraria uma absoluta apontando para domínio falso — regressão.
     No caminho feliz, devolva a string como veio do config.
  2. **Base sintética fixa** (ex.: `new URL(raw, 'https://example.invalid/')`)
     para resolver relativas de forma determinística, sem depender de
     `window.location`. URLs relativas resolvem com `protocol` `https:` e passam
     na allowlist; absolutas mantêm seu próprio protocolo.
  3. **Não fazer matching ingênuo de string** (`raw.startsWith('http')`): é
     contornável por `JavaScript:`, ` javascript:`, `java\tscript:`. O
     `new URL` já normaliza caixa e remove espaços/controles do esquema, então
     a checagem deve ser sobre `parsed.protocol` (que vem minúsculo).
  4. Allowlist concreta: `const ALLOWED = new Set(['http:', 'https:'])`;
     `return ALLOWED.has(parsed.protocol) ? raw : undefined`.
  5. `raw` `undefined`/`''` → retorno `undefined`/falsy (early return); o padrão
     `valor && (<elemento/>)` já omite o elemento naturalmente.
- **Consumo:** `TermsModal` e `SplashScreen` passam o valor do config por
  `sanitizeExternalUrl` antes de usá-lo em `href`/`src`. Onde já existe o padrão
  `valor && (<a/>)`, o link/imagem some naturalmente quando o retorno é
  `undefined`.

> Clean Architecture: a regra de saneamento é uma utilidade pura na borda de
> infraestrutura/apresentação; os componentes apenas a consomem. Sem
> dependências apontando para fora.

### Contratos de API
N/A (sem rede; pura transformação de string).

### Modelo de dados
N/A (sem mudança em tipos do config — campos seguem opcionais).

### Considerações de performance/segurança
- **Segurança:** allowlist (não blocklist) de esquemas — postura segura por
  default; esquemas desconhecidos são rejeitados.
- **Performance:** desprezível (uma análise de string por render de tela
  estática).

## Fora de Escopo

- Sanitização de conteúdo HTML/Markdown (não há `dangerouslySetInnerHTML` em jogo).
- Validação de URLs estáticas hardcoded no código (`/images/logo_bb.png` etc.) —
  não vêm do config, não são superfície de ataque.
- Mudança de tipos/contrato do config ou de UX para "URL inválida" além de
  omitir o elemento.

## Definition of Done

- [ ] Critérios de aceite (CA1–CA5) validados pelo QA
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO
- [ ] Issue HUB-61 atualizada no Linear (→ Done)
- [ ] Nenhum comando exigiu aprovação manual de sandbox (DoD de qualidade)
