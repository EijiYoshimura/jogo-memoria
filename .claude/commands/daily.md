Você vai conduzir o Daily Standup do time. Execute como o Orchestrator.

## Fluxo do Daily

### Etapa 1 — Buscar status atual no Linear

Via MCP do Linear, liste todas as Issues do Cycle ativo com status `In Progress` e `In Review`.

### Etapa 2 — Gerar relatório de status por agente

Para cada Issue em andamento, informe:
- Qual agente está responsável
- Há quanto tempo está no status atual
- Se há algum bloqueio registrado nos comentários

### Etapa 3 — Identificar impedimentos

Verifique se alguma Issue está há mais de 2 dias no mesmo status — isso é sinal de bloqueio. Liste essas Issues como alertas.

### Etapa 4 — Apresentar o Daily

Mostre ao usuário no formato:

```
## Daily Standup — [data de hoje]

### Em andamento

**LIN-XX — [Título]**
- Responsável: [agente]
- Status: In Progress (Xd)
- Update: [último comentário ou "sem atualização"]

...

### Bloqueios / Alertas
- LIN-XX: [descrição do bloqueio]

### Concluído desde o último daily
- LIN-XX: [Título] ✓

### Sprint Progress
Concluído: X pontos / Y pontos (Z%)
Dias restantes na sprint: N
```

### Etapa 5 — Ações necessárias

Se houver bloqueios, pergunte ao usuário como deseja proceder e acione o agente adequado para resolver.
