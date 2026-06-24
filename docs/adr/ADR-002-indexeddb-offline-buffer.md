# ADR-002 — IndexedDB como buffer offline obrigatório

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

Eventos presenciais têm WiFi instável. Um lead perdido por queda de conexão é inaceitável do ponto de vista de negócio.

## Decisão

Todo lead é salvo no IndexedDB **antes** de qualquer chamada de rede. O Supabase é tentado imediatamente após, e em caso de falha o lead permanece na fila local com `synced: false`. Um listener `window.online` drena a fila automaticamente ao reconectar.

## Consequências

### Positivas
- Garantia de zero perda de leads independente de conectividade
- Mesma estratégia do Hub de Ativações (ADR-003 do Hub) — consistência arquitetural
- Export CSV funciona mesmo completamente offline (dados no IndexedDB)

### Negativas / Trade-offs
- Complexidade adicional no código de persistência
- Deduplicação necessária no export CSV (Supabase + IndexedDB `synced: false`)
- IndexedDB é por dispositivo — se o totem for trocado sem sync, leads podem ficar presos
