Você vai conduzir a cerimônia de Sprint Planning. Execute como o Orchestrator.

**Sprint:** $ARGUMENTS

## Fluxo do Sprint Planning

### Etapa 1 — Listar backlog priorizado

Via MCP do Linear, busque as Issues com status `Backlog` ou `Todo` ordenadas por prioridade:
- Filtre apenas Issues com critérios de aceite preenchidos
- Liste em formato de tabela: ID | Título | Pontos | Label

### Etapa 2 — Validação de capacidade

Pergunte ao usuário:
> Qual a capacidade do time nesta sprint? (em story points, ex: 30)

### Etapa 3 — Seleção das Issues

Com base na capacidade informada, sugira quais Issues entram na sprint (do topo da lista priorizada até atingir a capacidade). Mostre ao usuário para aprovação.

### Etapa 4 — Validação técnica (Tech Lead)

Para cada Issue selecionada, spawne `tech-lead`:
> Valide se as seguintes Issues estão tecnicamente prontas para desenvolvimento (spec técnica ok, sem dependências bloqueantes): [lista de Issues]
> Se alguma tiver problema, aponte o que falta.

### Etapa 5 — Criar o Cycle no Linear

Via MCP do Linear:
- Crie ou ative o Cycle com o nome informado em $ARGUMENTS
- Mova as Issues aprovadas para o Cycle
- Atualize o status de todas para `Todo`

### Etapa 6 — Relatório final

Mostre ao usuário:

```
## Sprint Planning — [Nome da Sprint]

**Capacidade:** X pontos
**Issues selecionadas:** N issues / Y pontos

| ID | Título | Pontos | Responsável |
|----|--------|--------|-------------|
| LIN-XX | ... | X | dev-back |
...

**Issues deixadas para a próxima sprint:**
- LIN-XX: [motivo]

**Início:** [data]
**Fim:** [data]
```
