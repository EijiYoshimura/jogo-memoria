# ADR-007 — Isolamento estrito entre src/game/ e src/standalone/

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O código do jogo precisa ser um plugin reutilizável do Hub. Se `src/game/` importar de `src/standalone/`, a integração ao Hub exigirá refatoração — exatamente o que queremos evitar.

## Decisão

Regra inviolável: `src/game/` não pode importar nada de `src/standalone/`. A dependência é unidirecional: `src/standalone/` importa de `src/game/`, nunca o contrário.

- `src/game/` contém: entidades, use-cases, componentes visuais, `GameConfig` interface, entry point do plugin
- `src/standalone/` contém: ConfigLoader, LeadForm, AdminPanel, SplashScreen, ResultScreen, hooks de persistência, main.tsx

## Consequências

### Positivas
- `src/game/` é um módulo puro: testável isoladamente, sem dependências de infra standalone
- Integração ao Hub = remover `src/standalone/` e conectar o Hub Runtime ao `src/game/index.tsx`
- Separação forçada impede acúmulo de acoplamento ao longo do tempo

### Negativas / Trade-offs
- Disciplina necessária a cada PR — o Tech Lead deve verificar explicitamente no code review
- Alguns dados precisam ser passados por props em vez de context (contextos do standalone não podem ser importados pelo game)
