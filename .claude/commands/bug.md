Você vai executar o fluxo de reporte e correção de um bug.

**Bug reportado:** $ARGUMENTS

## Fluxo de Bug

### Etapa 1 — QA estrutura o report

Spawne o agente `qa`:
> Estruture um bug report completo para o seguinte problema relatado: $ARGUMENTS
> Use o formato de Bug Report definido no seu system prompt. Inclua:
> - Severidade (Crítico / Alto / Médio / Baixo)
> - Passos de reprodução (peça ao usuário se não souber)
> - Comportamento esperado vs atual
> - Sugestão de critérios de aceite para a correção

### Etapa 2 — Tech Lead faz triagem

Spawne o agente `tech-lead`:
> Faça a triagem técnica do bug abaixo. Identifique:
> - Qual camada da arquitetura está afetada
> - Causa provável
> - Complexidade da correção (story points)
> - Se é um quick fix ou precisa de spec técnica
> Bug: [resultado do QA]

### Etapa 3 — Criar Issue no Linear

Via MCP do Linear, crie a Issue:
- Título: `[BUG] $ARGUMENTS`
- Descrição: report do QA + triagem do Tech Lead
- Label: `bug`
- Estimate: story points da triagem
- Prioridade: baseada na severidade (Crítico → Urgent, Alto → High, Médio → Medium, Baixo → Low)
- Status: `Todo`

Mostre o ID da Issue criada ao usuário.

### Etapa 4 — Decidir ação

Pergunte ao usuário:
> Bug criado como LIN-XX. Deseja iniciar a correção agora ou deixar para o próximo ciclo?

**Se iniciar agora:**

### Etapa 5 — Correção

Spawne o agente adequado (`dev-back` ou `dev-front`) conforme a triagem do Tech Lead:
> Corrija o bug abaixo seguindo as orientações da triagem técnica. A Issue é LIN-XX.
> [report completo + triagem]

### Etapa 6 — Validação

Spawne `qa` para validar a correção:
> Valide que o bug LIN-XX foi corrigido. Verifique também se a correção não introduziu regressões.

### Etapa 7 — Finalizar

Atualize a Issue no Linear para `Done` e reporte ao usuário.
