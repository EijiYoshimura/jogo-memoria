# ADR-006 — Export CSV gerado no browser via Blob

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O operador precisa exportar os leads após o evento. Não há backend próprio para gerar o arquivo server-side.

## Decisão

CSV gerado inteiramente no browser usando `Blob` + `URL.createObjectURL` + link com `download` attribute. Dados combinados de Supabase (online) e IndexedDB `synced: false` (offline), deduplicados por `localId`.

## Consequências

### Positivas
- Zero infraestrutura de servidor para export
- Funciona completamente offline se IndexedDB tiver os dados
- Nome do arquivo inclui `event.id` e data — rastreável

### Negativas / Trade-offs
- Limitado pelo tamanho de memória do browser (prático para eventos com < 10.000 leads)
- Sem streaming — carrega todos os leads em memória antes de gerar o arquivo
