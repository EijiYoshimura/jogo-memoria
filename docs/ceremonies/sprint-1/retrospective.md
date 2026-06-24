# Retrospectiva — Sprint 1 — 2026-06-24

## Participantes
Orchestrator, Dev Front, Tech Lead, QA, Process Auditor

---

## O que funcionou bem

- **Tech Lead atuou corretamente como guardião:** bloqueou o PR no primeiro ciclo por ausência de testes unitários — regra inviolável do CLAUDE.md cumprida mesmo sob prazo de dias
- **Planning e grooming de alta qualidade:** interface `GameConfig`, esquema SQL, entidades de domínio e critérios de aceite detalhados documentados antes do desenvolvimento — supriram parcialmente a ausência de spec formal
- **Isolamento arquitetural respeitado:** `src/game/` (plugin Hub-ready) separado de `src/standalone/` (casca descartável) — caminho de integração ao Hub está limpo
- **Testes concentrados no domínio crítico:** 14 testes cobrindo `StartGame` e `FlipCard` — os dois use cases com toda a lógica de negócio
- **Velocity excepcional:** 23/23 pts em 1 dia — meta da sprint 100% entregue dentro do prazo de urgência
- **Documentação gerada no mesmo dia:** Daily, Review e Relatório Diário commitados em 2026-06-24

---

## O que não funcionou

- **Sem spec formal em `/docs/specs/`** antes do desenvolvimento — violação do SDD; mitigada pela qualidade do grooming, mas o artefato obrigatório estava ausente
- **Vitest não configurado antes do primeiro PR** — dev-front submeteu PR sem infraestrutura de testes; era previsível e deveria ser parte do setup (HUB-28)
- **Configuração de agentes incompleta antes do início:** regras de `cd` e permissões de `tee` ajustadas durante a sprint — deveriam ser pré-condição
- **ADRs ausentes:** 7 decisões técnicas relevantes registradas apenas no grooming, não em `/docs/adr/` conforme CLAUDE.md
- **IDs inconsistentes:** planning usou `MEM-01..09`, Linear criou `HUB-28..36` — sem mapeamento explícito
- **`.worktrees/` não ignorado pelo git** e diretório residual rastreado após remoção do worktree

---

## O que pode ser melhorado

- Criar spec formal em `/docs/specs/` antes de qualquer desenvolvimento — mesmo em sprints de urgência, o grooming deve ser promovido a spec
- Incluir configuração de Vitest no checklist de setup de projeto (HUB-28 equivalente)
- Executar checklist de configuração de agentes antes da primeira tarefa de desenvolvimento
- Criar ADRs no início do projeto para cada decisão técnica relevante
- Usar os IDs do Linear no planning.md diretamente (criar issues antes do planning)
- Adicionar `.worktrees/` ao `.gitignore` desde o `git init`

---

## Plano de ação — melhorias a implementar

| # | Melhoria | Responsável | Tipo | Prazo |
|---|----------|-------------|------|-------|
| 1 | Criar spec formal de `jogo-memoria` em `/docs/specs/` (backfill Sprint 1) | Tech Lead + PO | processo | Imediato — nesta retro |
| 2 | Criar ADRs para as 7 decisões técnicas da Sprint 1 | Tech Lead | processo | Imediato — nesta retro |
| 3 | Adicionar `.worktrees/` ao `.gitignore` e remover diretório residual | Orchestrator | código | Imediato — nesta retro |
| 4 | Atualizar `dev-front.md`: incluir Vitest no checklist de setup de projeto | Orchestrator | agente | Imediato — nesta retro |
| 5 | Atualizar `orchestrator.md`: criar issues no Linear ANTES do planning.md | Orchestrator | agente | Imediato — nesta retro |
| 6 | Criar `docs/worktrees-ativos.md` e mantê-lo durante a sprint | Orchestrator | processo | Sprint 2 |
| 7 | Checklist pré-sprint de agentes (permissões, `.gitignore`, Vitest) | Orchestrator | processo | Sprint 2 |

## Itens aplicados nesta retro
- `docs/specs/jogo-memoria.md` criado (backfill)
- `docs/adr/` criado com ADRs das 7 decisões técnicas da Sprint 1
- `.worktrees/` adicionado ao `.gitignore`
- `dev-front.md` atualizado: Vitest no checklist de setup
- `orchestrator.md` atualizado: issues no Linear antes do planning

## Itens pendentes para a próxima sprint
- Criar `docs/worktrees-ativos.md` ao iniciar Sprint 2
- Aplicar checklist pré-sprint completo antes do primeiro desenvolvimento
