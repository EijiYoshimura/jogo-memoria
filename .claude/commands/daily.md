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

### Etapa 6 — Salvar os arquivos

Gere **ambos** os arquivos no repositório e commite ao final.

**`docs/ceremonies/sprint-{n}/daily-YYYY-MM-DD.md`:**

```markdown
# Daily Standup — YYYY-MM-DD

## Resumo do time

| Agente | O que fez ontem | O que fará hoje | Impedimentos |
|--------|----------------|-----------------|--------------|
| dev-back | ... | ... | Nenhum |
| dev-front | ... | ... | ... |
| qa | ... | ... | ... |

## Issues movidas hoje

| Issue | De | Para |
|-------|----|------|
| LIN-XX | In Progress | In Review |

## Impedimentos ativos
- (lista ou "Nenhum")
```

**`docs/reports/daily/YYYY-MM-DD.md`:**

```markdown
# Relatório Diário — YYYY-MM-DD

## Progresso da Sprint {n}

### Issues concluídas hoje
- [ ] LIN-XX — Título (N pts)

### Issues em andamento
- LIN-XX — Título | responsável: agente | % estimado: XX%

### Issues bloqueadas
- LIN-XX — Título | motivo: ...

## Métricas do ciclo

| Métrica | Valor |
|---------|-------|
| Pontos entregues (sprint) | X / Y |
| Velocity do dia | X pts |
| Issues Done | X |
| Issues In Progress | X |
| Issues Todo | X |

## Decisões tomadas hoje
- (lista de decisões relevantes ou "Nenhuma")

## Próximos passos
- (lista das principais ações previstas para amanhã)
```
