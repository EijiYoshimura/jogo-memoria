Você vai orquestrar o fluxo completo de desenvolvimento de uma nova feature seguindo as diretrizes do time em CLAUDE.md.

**Feature solicitada:** $ARGUMENTS

## Fluxo a executar

### Etapa 1 — Validação de Negócio (Product Manager)

Spawne o agente `product-manager` com o seguinte prompt:
> Valide a demanda abaixo do ponto de vista de negócio e produza o documento de Validação de Negócio no formato definido no seu system prompt.
> Demanda: $ARGUMENTS

Aguarde o resultado antes de continuar.

### Etapa 2 — User Story (Product Owner)

Se o PM aprovou, spawne o agente `product-owner` com:
> Com base na validação de negócio abaixo, escreva a User Story completa com critérios de aceite no formato padrão.
> [resultado do PM]

### Etapa 3 — Spec de Design + Spec Técnica (paralelo)

Spawne **simultaneamente** os agentes `product-designer` e `tech-lead`:

- `product-designer`: produza a spec de design para a feature abaixo, incluindo fluxo UX, estados e considerações de acessibilidade. User Story: [resultado do PO]
- `tech-lead`: produza a spec técnica para a feature abaixo, incluindo arquitetura envolvida, contratos de API, modelo de dados e estimativa. User Story: [resultado do PO]

Aguarde ambos concluírem.

### Etapa 4 — Criar Spec consolidada

Monte o documento de spec completo em `/docs/specs/[nome-da-feature].md` combinando:
- User Story do PO
- Spec de Design do Designer
- Spec Técnica do Tech Lead

Siga o formato de spec definido em CLAUDE.md.

### Etapa 5 — Criar Issue no Linear

Via MCP do Linear, crie a Issue com:
- Título: `[FEAT] $ARGUMENTS`
- Descrição: link para a spec + critérios de aceite
- Label: `feature`
- Estimate: story points da spec técnica
- Status: `Todo`

### Etapa 6 — Confirmação para desenvolvimento

Apresente ao usuário:
- Resumo da spec
- Link da Issue no Linear
- Pergunta: "Aprovar spec e iniciar desenvolvimento? (sim/não)"

Se aprovado, spawne **simultaneamente** `dev-front` e/ou `dev-back` conforme a natureza da feature, passando a spec completa como contexto.

### Etapa 7 — QA

Após devs concluírem, spawne `qa` para validação contra os critérios de aceite.

### Etapa 8 — Code Review

Após QA aprovar, spawne `tech-lead` para code review final.

### Etapa 9 — Finalizar

Atualize a Issue no Linear para `Done` e reporte o status final ao usuário.
