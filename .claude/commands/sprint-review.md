Você vai conduzir a Sprint Review e a Retrospectiva. Execute como o Orchestrator.

**Sprint:** $ARGUMENTS

Review e Retro ocorrem **sempre no mesmo dia, nessa ordem**, com todos os agentes participando. O `process-auditor` executa a auditoria de sprint **antes** da Retro — o relatório (`docs/audits/audit-YYYY-MM-DD.md`) é insumo obrigatório do Plano de Ação.

## Fluxo

### Etapa 1 — Sprint Review

Via MCP do Linear, levante as Issues do Cycle e seus status. Conduza a demonstração das entregas e consolide as métricas finais.

### Etapa 2 — Auditoria de sprint

Spawne `process-auditor` para gerar `docs/audits/audit-YYYY-MM-DD.md`. Use os achados como ponto de partida da Retro.

### Etapa 3 — Retrospectiva

O time valida o que funcionou, o que não funcionou e o que melhorar (processo, fluxo, diretrizes, código). Melhorias aplicáveis são **implementadas e commitadas** ao final; o que não puder ser aplicado vira Issue no Linear com label `processo`/`tech-debt`.

### Etapa 4 — Salvar os arquivos

Gere **ambos** e commite ao final.

**`docs/ceremonies/sprint-{n}/review.md`:**

```markdown
# Sprint Review — Sprint {n} — YYYY-MM-DD

## Participantes
- Orchestrator, PO, PM, Tech Lead, Dev Back, Dev Front, QA, Designer

## Objetivo da Sprint
(meta definida no planning)

## Demonstração de entregas

| Issue | Título | Pts | Status | Demo realizada? |
|-------|--------|-----|--------|-----------------|
| LIN-XX | ... | X | Done | Sim / Não |
| LIN-XX | ... | X | In Progress | — |

## Métricas finais da Sprint

| Métrica | Valor |
|---------|-------|
| Pontos comprometidos | X |
| Pontos entregues | X |
| Velocity | X pts |
| Issues Done | X |
| Issues não concluídas | X |

## O que foi entregue (highlights)
- (lista dos principais entregáveis)

## O que ficou para trás e por quê
- (issues não concluídas + motivo)

## Feedback do PO/PM sobre as entregas
- (alinhamento com critérios de aceite e objetivos de negócio)
```

**`docs/ceremonies/sprint-{n}/retrospective.md`:**

```markdown
# Retrospectiva — Sprint {n} — YYYY-MM-DD

## Participantes
- Orchestrator, PO, PM, Tech Lead, Dev Back, Dev Front, QA, Designer

---

## O que funcionou bem
- (práticas, dinâmicas e decisões que devem ser mantidas)

## O que não funcionou
- (problemas de processo, comunicação, qualidade ou fluxo)

## O que pode ser melhorado
- (sugestões concretas do time)

---

## Plano de ação — melhorias a implementar

| # | Melhoria | Responsável | Tipo | Prazo |
|---|----------|-------------|------|-------|
| 1 | ... | agente | processo / diretriz / código | próxima sprint |

**Tipos de melhoria:**
- `processo` — mudança em cerimônia, fluxo ou regra de trabalho
- `diretriz` — atualização do CLAUDE.md ou de arquivos em `guidelines/`
- `agente` — ajuste na definição de um sub-agente em `.claude/agents/`
- `código` — tech-debt ou padrão técnico a corrigir

## Itens aplicados nesta retro
- (mudanças já commitadas ao final desta sessão)

## Itens pendentes para a próxima sprint
- (melhorias que virarão Issues no Linear com label `tech-debt` ou `processo`)
```
