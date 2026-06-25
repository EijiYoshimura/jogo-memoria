Você vai conduzir o PO/PM Sync. Execute como o Orchestrator, coordenando `product-owner` e `product-manager`.

O PO/PM Sync ocorre **no mínimo 2x por semana**: o PO apresenta o status das entregas, o PM valida o alinhamento com os objetivos de negócio e OKRs.

## Fluxo

### Etapa 1 — PO levanta o status das entregas

Via MCP do Linear, liste as Issues do Cycle ativo com seus status. O `product-owner` resume o andamento de cada entrega.

### Etapa 2 — PM valida alinhamento de negócio

Para cada Issue em andamento/concluída, o `product-manager` avalia se está alinhada aos OKRs e à estratégia de produto. Desvios são escalados ao Orchestrator com proposta de ação corretiva.

### Etapa 3 — Salvar o arquivo

Gere `docs/ceremonies/sprint-{n}/po-pm-sync-YYYY-MM-DD.md` e commite ao final:

```markdown
# PO/PM Sync — YYYY-MM-DD

## Participantes
- Product Owner: (nome/agente)
- Product Manager: (nome/agente)

## Status das entregas vs. objetivos de negócio

| Issue | Status | Alinhado ao negócio? | Observações |
|-------|--------|----------------------|-------------|
| LIN-XX | In Progress | Sim / Não | ... |

## Desvios identificados
- (lista de desvios ou "Nenhum")

## Decisões e alinhamentos
- (lista de decisões ou ajustes de direção)

## Próximos passos acordados
- (ações concretas com responsável)
```
