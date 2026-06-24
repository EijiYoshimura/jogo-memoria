# Sprint Review — Sprint 1 — 2026-06-24

## Participantes
Orchestrator, Dev Front, Tech Lead, QA, Product Owner

## Objetivo da Sprint
Entregar um jogo da memória standalone funcional, pronto para uso em totem/tablet em eventos presenciais — com captura de leads antes do jogo, persistência em banco de dados (Supabase) com fallback offline, e painel admin para exportação dos dados.

## Demonstração de entregas

| Issue | Título | Pts | Status | Demo realizada? |
|-------|--------|-----|--------|-----------------|
| HUB-28 | Setup do projeto | 2 | Done | Sim — `npm run dev` e `npm run build` passando |
| HUB-29 | ConfigLoader | 2 | Done | Sim — `config.json` carregado, erro bloqueante validado |
| HUB-30 | Formulário de Lead | 3 | Done | Sim — campos dinâmicos, validação, máscara tel |
| HUB-31 | Persistência IndexedDB + Supabase | 3 | Done | Sim — lead inserido no Supabase; fallback offline validado |
| HUB-32 | Jogo de Memória | 5 | Done | Sim — fluxo completo, flip 3D, timer, match |
| HUB-33 | Tela de Resultado | 2 | Done | Sim — vitória e derrota, auto-reset |
| HUB-34 | Tela Splash | 1 | Done | Sim — branding, pulse, gesto oculto |
| HUB-35 | Painel Admin | 3 | Done | Sim — PIN, stats, export CSV, force sync |
| HUB-36 | QA — dispositivos e offline | 2 | Done | Sim — validado pelo operador em dispositivo real |

## Métricas finais da Sprint

| Métrica | Valor |
|---------|-------|
| Pontos comprometidos | 23 |
| Pontos entregues | 23 |
| Velocity | 23 pts |
| Issues Done | 9 / 9 |
| Issues não concluídas | 0 |

## O que foi entregue (highlights)
- Aplicação standalone completa: Splash → Lead Form → Jogo → Resultado → Admin
- Domínio limpo (`src/game/`) isolado da casca standalone — pronto para integração ao Hub via Module Federation
- Persistência dupla: IndexedDB como buffer offline + Supabase como banco de dados definitivo
- Painel admin com teclado numérico on-screen, sync status em tempo real e export CSV sem servidor
- 14 testes unitários cobrindo a lógica de domínio crítica (StartGame, FlipCard)
- Deploy possível via Cloudflare Pages com custo zero

## O que ficou para trás e por quê
Nada — sprint entregue 100% dentro do prazo.

## Observações do QA
- Teste manual em dispositivo validou o fluxo completo
- Imagens reais do evento precisam substituir os placeholders antes do uso em produção
- Cenário offline (WiFi desligado + reconexão) funcionou conforme especificado

## Feedback sobre as entregas
Sprint concluída com sucesso. O código passou por dois ciclos de review — o primeiro reprovado por ausência de testes (bloqueante resolvido) e o segundo aprovado. A arquitetura está alinhada com os requisitos de integração futura ao Hub.
