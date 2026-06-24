Você vai criar a spec completa de uma feature sem iniciar o desenvolvimento. Útil para refinar antes do sprint planning.

**Feature:** $ARGUMENTS

## Fluxo

### Etapa 1 — Product Owner escreve a User Story

Spawne o agente `product-owner`:
> Escreva a User Story completa com critérios de aceite para a seguinte feature: $ARGUMENTS
> Use o formato padrão definido no seu system prompt.

### Etapa 2 — Designer e Tech Lead produzem specs (paralelo)

Com a User Story em mãos, spawne **simultaneamente**:

- `product-designer`: produza a spec de design (fluxo UX, estados, acessibilidade, responsividade) para a User Story abaixo. [User Story]
- `tech-lead`: produza a spec técnica (arquitetura, contratos de API, modelo de dados, estimativa em story points) para a User Story abaixo. [User Story]

### Etapa 3 — Consolidar e salvar

Crie o arquivo `/docs/specs/[nome-kebab-case].md` com a spec consolidada no formato:

```markdown
# Spec: [Nome da Feature]

## Contexto
## User Story
## Critérios de Aceite
## Design
## Spec Técnica
## Fora de Escopo
## Definition of Done
```

### Etapa 4 — Reportar

Mostre ao usuário:
- Caminho do arquivo criado
- Estimativa total em story points
- Checklist de aprovação pendente (PO / Designer / Tech Lead / QA)
