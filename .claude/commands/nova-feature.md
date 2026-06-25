Você vai orquestrar o fluxo completo de desenvolvimento de uma nova feature seguindo as diretrizes do time em CLAUDE.md.

**Feature solicitada:** $ARGUMENTS

## Etapa 0 — Triagem de complexidade (escolha a trilha)

Antes de spawnar qualquer agente, classifique a feature. **Cada spawn é um cold start que recarrega contexto** — não dispare papéis que a feature não exige.

| Critério | Trilha Lite | Trilha Completa |
|----------|-------------|-----------------|
| Estimativa | ≤ 3 pontos | ≥ 5 pontos, ou épico |
| Risco de negócio/arquitetura | baixo, alinhado a OKR já validado | novo território, decisão estratégica |
| Interface | sem UI nova ou UI trivial reusando design system | UI nova/complexa |

- **Trilha Lite:** o Orchestrator escreve User Story + critérios de aceite **inline** (sem spawnar PM nem PO), pula o Designer, e spawna **apenas o Tech Lead** para a spec técnica (e o dev). Pule as Etapas 1 e 3-Designer. Use quando todos os critérios da coluna Lite baterem.
- **Trilha Completa:** execute todas as etapas abaixo. Use quando **qualquer** critério cair na coluna Completa.

Na dúvida entre as duas, pergunte ao usuário qual trilha seguir antes de spawnar.

## Fluxo completo

### Etapa 1 — Validação de Negócio (Product Manager) — *só na Trilha Completa*

Spawne o agente `product-manager` com o seguinte prompt:
> Valide a demanda abaixo do ponto de vista de negócio e produza o documento de Validação de Negócio no formato definido no seu system prompt.
> Demanda: $ARGUMENTS

Aguarde o resultado antes de continuar.

### Etapa 2 — User Story (Product Owner) — *na Trilha Lite, escrita inline pelo Orchestrator*

Trilha Completa: se o PM aprovou, spawne o agente `product-owner` com:
> Com base na validação de negócio abaixo, escreva a User Story completa com critérios de aceite no formato padrão.
> [resultado do PM]

Trilha Lite: o Orchestrator escreve a User Story + critérios de aceite diretamente, sem spawn.

### Etapa 3 — Spec de Design + Spec Técnica

`tech-lead` é **sempre** spawnado para a spec técnica. `product-designer` só é spawnado se a feature tiver UI nova/relevante (na Trilha Lite, em geral, é pulado).

Spawne (em paralelo quando ambos se aplicam):

- `tech-lead`: produza a spec técnica para a feature abaixo, incluindo arquitetura envolvida, contratos de API, modelo de dados e estimativa. User Story: [resultado do PO ou da triagem]
- `product-designer` *(só se houver UI nova)*: produza a spec de design — fluxo UX, estados e acessibilidade. User Story: [resultado do PO]

Aguarde concluírem.

### Etapa 4 — Criar Spec consolidada

Monte o documento de spec completo em `/docs/specs/[nome-da-feature].md` combinando:
- User Story (do PO, ou escrita inline na Trilha Lite)
- Spec de Design do Designer (quando houver)
- Spec Técnica do Tech Lead

Use o template `docs/specs/_template.md`.

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
