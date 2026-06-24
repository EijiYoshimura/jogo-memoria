# ADR-003 — Module Federation configurado desde o início

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O jogo-memoria é standalone agora, mas será um plugin do Hub de Ativações no futuro. O Hub usa Module Federation (vite-plugin-federation) para carregar plugins dinamicamente. Configurar o Module Federation apenas na integração exigiria mudanças no `vite.config.ts` e potencial ajuste de imports.

## Decisão

`vite-plugin-federation` configurado desde o setup inicial, expondo `./MemoryGame` via `src/game/index.tsx`. A casca standalone (`src/standalone/`) é descartável — ao integrar ao Hub, apenas ela é removida.

## Consequências

### Positivas
- Custo zero agora (apenas configuração, sem overhead em runtime standalone)
- Integração ao Hub é trocar o config-loader, não reescrever o jogo
- Força a separação rigorosa entre `src/game/` (plugin) e `src/standalone/` (wrapper)

### Negativas / Trade-offs
- `vite-plugin-federation` aumenta levemente a complexidade do build
- `remoteEntry.js` gerado mas não usado no standalone — overhead mínimo
