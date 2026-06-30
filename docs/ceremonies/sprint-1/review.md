# Sprint Review — Sprint 1 — 2026-06-30

## Participantes
Orchestrator, Dev Front, Tech Lead, QA, Product Owner, Product Manager

## Período da Sprint
2026-06-24 → 2026-06-30 (7 dias corridos / 5 dias úteis)

## Meta da Sprint

> Entregar um jogo da memória funcional, standalone, pronto para uso em totem/tablet em eventos presenciais — com captura de leads antes do jogo, persistência em banco de dados (Supabase) com fallback offline, e painel admin para export dos dados.

**Status da meta: ATINGIDA.** A aplicação está em produção e validada para o evento.

---

## Demonstração de entregas

### Fundação (06-24)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-28 | Setup jogo-memoria — Vite + React 19 + Module Federation | 2 | Done | `npm run dev` e `npm run build` passando |
| HUB-29 | ConfigLoader — carregamento de config via JSON | 2 | Done | `config.json` carregado, erro bloqueante validado |
| HUB-30 | Formulário de Lead — captura de dados | 3 | Done | Campos dinâmicos, validação, máscara tel |
| HUB-31 | Persistência de Leads — IndexedDB + sync Supabase | 3 | Done | Lead inserido no Supabase; fallback offline validado |
| HUB-32 | Jogo de Memória — domínio, grid e flip animation | 5 | Done | Fluxo completo, flip 3D, timer, match |
| HUB-33 | Tela de Resultado — score e transição | 2 | Done | Vitória e derrota, auto-reset |
| HUB-34 | Tela Splash — branding e trigger admin | 1 | Done | Branding, pulse, gesto oculto |
| HUB-35 | Painel Admin — PIN + sync + export CSV | 3 | Done | PIN, stats, export CSV, force sync |
| HUB-36 | QA Validação em dispositivos e resiliência offline | 2 | Done | Validado em dispositivo real |
| HUB-37 | [BUG] Admin exibe 0 leads em outros dispositivos | 2 | Done | RLS Supabase corrigido |

### Go-live (06-25)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-49 | [OPS] Go-live jogo standalone — Cloudflare Pages | 2 | Done | Deploy fim-a-fim validado |

### Visual BB Seguros (06-25 a 06-26)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-63 | Layout do board fiel ao mockup BB Seguros | 3 | Done | Grid, gap, aspect-ratio e cores do mockup |
| HUB-64 | Refino visual do board — borda branca + cards maiores | 2 | Done | Ajuste fino aprovado pelo stakeholder |
| HUB-65 | Layout do formulário de lead fiel ao mockup + fonte BB | 3 | Done | Re-skin completo, fonte BB Seguros |
| HUB-66 | Conversão de fontes BB para woff2 | 1 | Done | Performance de carregamento melhorada |
| HUB-68 | Logo maior e formulário centralizado verticalmente | 1 | Done | Layout equilibrado com teclado ligado |
| HUB-70 | Splash com logo maior, sem nome do evento, CTA em botão BB | 2 | Done | Visual alinhado ao branding |
| HUB-72 | Moldura branca arredondada na tela de entrada | 1 | Done | Borda aplicada via CSS |
| HUB-73 | Conteúdo tela final — parabéns/brinde + botão BB | 2 | Done | Textos +60%, botão com cor BB |
| HUB-74 | Modal de termos — 80% de largura + rótulos corretos | 2 | Done | Modal acessível, scroll, fechar |

### Consentimento LGPD (06-26)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-67 | Consentimento LGPD no formulário — checkbox + modal obrigatório | 5 | Done | Checkbox required, modal com termos, fluxo bloqueante |

### Teclado Virtual (06-26 a 06-29)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-57 | Teclado virtual on-screen para formulário (configurável, default off) | 5 | Done | Teclado em `src/lead-capture/keyboard/`; reutilizável |
| HUB-59 | Teclado estilo smartphone Samsung — long-press acentos + símbolos | 8 | Done | Layout completo, popup de acentos ancorado à tecla |
| HUB-78 | Supressão do teclado nativo Android (readOnly + caret custom) | 2 | Done | Teclado do SO não sobe; caret customizado visível |
| HUB-85 | Teclado de e-mail — layout alfanumérico + fileira de domínios | 3 | Done | Layout numérica + ?123 + linha de domínios |
| HUB-86 | Dismiss do teclado ao tocar fora dos campos | 2 | Done | Toque em qualquer área fora fecha o teclado |

### Edição com Caret (06-28 a 06-29)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-69 | Edição com cursor — inserir/apagar na posição do caret | 5 | Done | Caret visível, inserção/deleção na posição correta |
| HUB-71 | Correção do SHIFT — regressão HUB-69 + auto-shift 1ª letra | 3 | Done | SHIFT funciona em re-foco; auto-shift no nome |

### PWA e Modo Kiosk (06-28 a 06-29)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-79 | Tela de resultado responsiva — textos clamp/vw | 1 | Done | Texto proporcional à largura em qualquer resolução |
| HUB-80 | PWA instalável — manifest + ícones + fullscreen/retrato | 3 | Done | App instalável; abre em fullscreen retrato |
| HUB-81 | PWA offline — precache app-shell + Supabase NetworkOnly | 3 | Done | App carrega sem internet após primeira visita |
| HUB-82 | Kiosk hardening — wake lock + fullscreen + anti-zoom/seleção | 3 | Done | Tela não apaga; zoom e seleção de texto desabilitados |
| HUB-84 | Imagens offline — remove mockups do precache + NetworkFirst | 2 | Done | Imagens do evento carregam; cache correto |

### Features de Jogo (06-29)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-76 | Show before — preview das cartas viradas antes de iniciar | 3 | Done | Cartas visíveis por N segundos; `game.showBefore` config |

### Segurança (06-29)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-61 | [TECH-DEBT] Validar esquema URL — anti-XSS em privacyPolicyUrl e logo | 2 | Done | `javascript:` e `data:` bloqueados; apenas `https://` aceito |

### Fix de processo (06-28)

| Issue | Título | Pts | Status | Demo |
|-------|--------|-----|--------|------|
| HUB-77 | [FIX] Restaura gate verde após commit direto em master | 1 | Done | Gate lint+tsc+vitest verde restaurado |

---

## Issues não concluídas

| Issue | Título | Status | Motivo | Destino |
|-------|--------|--------|--------|---------|
| HUB-56 | Trocar config demo pelos assets reais do evento | Bloqueada | Aguarda assets do operador | Projeto principal HUB |
| HUB-58 | [TECH-DEBT] Extrair LeadCaptureForm para pacote reutilizável | Todo | Prioridade deferida | Projeto principal HUB |

---

## Métricas finais da Sprint

| Métrica | Valor |
|---------|-------|
| Pontos comprometidos (planning original) | 23 |
| Pontos entregues | ~76 (escopo expandiu com requisitos do evento) |
| Issues Done | 29 |
| Issues não concluídas | 2 (→ projeto HUB) |
| PRs mergeados | 32 |
| Regressões em produção | 0 |

---

## O que foi entregue (highlights)

- **Aplicação completa pronta para o evento:** Splash → Consentimento LGPD → Lead Form → Jogo → Resultado → Admin — fluxo 100% funcional em totem retrato
- **Teclado virtual completo:** base configurável + estilo Samsung + supressão Android + layout e-mail + dismiss on-tap-outside
- **Visual 100% fiel ao mockup BB Seguros:** board, formulário, splash, resultado e modal de termos com fonte e cores corretas
- **PWA instalável e kiosk-ready:** fullscreen, wake lock, offline precache, anti-zoom — sem necessidade de app nativo
- **Consentimento LGPD obrigatório:** checkbox bloqueante + modal de termos/política
- **Preview das cartas configurável:** `game.showBefore` permite N segundos de memorização antes de iniciar
- **Segurança anti-XSS:** URLs do config validadas — apenas `https://` aceito
- **Domínio isolado** `src/game/` pronto para integração ao Hub via Module Federation

## O que ficou para trás e por quê

- **HUB-56 (assets reais):** bloqueada por dependência externa — os assets do operador ainda não foram fornecidos. Não bloqueia o evento pois o `config.json` pode ser atualizado manualmente pelo operador no deploy.
- **HUB-58 (refatoração LeadCaptureForm):** tech-debt diferido por decisão de prioridade — o código funciona; a extração para pacote reutilizável faz mais sentido ser feita já no contexto do projeto Hub.

## Feedback do PO/PM sobre as entregas

Sprint superou a meta original (23pts → ~76pts), incorporando todos os requisitos do cliente BB Seguros que emergiram durante o ciclo. A aplicação está validada e pronta para o evento. As 2 issues pendentes não bloqueiam o evento e serão endereçadas no projeto principal do Hub na próxima sprint.
