# Retrospectiva — Sprint 1 — 2026-06-30

## Participantes
Orchestrator, Dev Front, Tech Lead, QA, Product Owner, Product Manager, Process Auditor

> **Insumo:** `docs/audits/audit-2026-06-30.md` — 14 achados (2 críticos, 6 de atenção, 5 positivos, 1 otimização)

---

## O que funcionou bem

- **Meta superada com 0 regressões:** 29 issues Done (~76pts entregues vs 23pts comprometidos) sem nenhuma regressão em produção — a expansão de escopo absorveu todos os requisitos do cliente BB Seguros sem quebrar o que já existia
- **Todos os achados da auditoria anterior (06-24) endereçados:** specs saíram de 0 para 14 arquivos; ADRs saíram de 0 para 10; `.gitignore` corrigido; agentes atualizados; IDs consistentes nos documentos
- **Cultura de PR estabelecida e mantida:** 95%+ dos commits de feature passaram por PR com gate verde — apenas 2 commits diretos fugiram à regra (vide "O que não funcionou")
- **Gate quebrado → restaurado via processo correto:** quando o gate foi quebrado por commit direto em master (`15f1a5b`), a correção veio por PR (HUB-77) e não por supressão — o instinto de process-safety prevaleceu
- **Isolamento arquitetural `src/game/`:** o domínio manteve-se limpo durante toda a expansão de escopo; a integração ao Hub permanece viável sem refatoração
- **Teclado virtual como decisão de design:** a escolha de torná-lo configurável e reutilizável (default off, em `src/lead-capture/`) pagou dividendos ao longo de toda a sprint (HUB-57 → HUB-59 → HUB-78 → HUB-85 → HUB-86 sem reescritas)

---

## O que não funcionou

- **Commits diretos em `master` (2 ocorrências):** `fde5f52` ("add images", 26/06) e `15f1a5b` ("some fixes", 28/06) foram aplicados sem PR. O segundo quebrou `lint+tsc+vitest`. Nenhuma convenção ou instrução de agente resolve isso com confiabilidade — apenas branch protection técnica resolve
- **Spec criada após implementação (HUB-75/PWA):** a spec de PWA/kiosk foi commitada depois que HUB-80, HUB-81 e HUB-82 já foram mergeados — inversão do SDD que torna a spec um documento histórico em vez de contrato
- **`docs/worktrees-ativos.md` comprometido e não entregue:** estava no plano de ação da Retro de 06-24 como ação para Sprint 2; não foi criado em nenhum momento da sprint
- **PO/PM Sync abaixo da frequência exigida:** apenas 1 sync documentado (2026-06-24) vs mínimo de 2x por semana; em uma sprint de 7 dias isso equivale a 2 syncs esperados — apenas metade cumprida
- **Status de HUB-56 inconsistente:** registrada como "Bloqueada (aguarda assets)" nos relatórios diários, mas marcada como Done no Linear — os commits `fde5f52` sugerem que os assets foram adicionados diretamente sem rastreamento no board
- **Daily de encerramento (30/06) não gerado antes das atividades:** cerimônia de encerramento iniciou sem o Daily do dia, contrariando a regra "1ª atividade do dia"

---

## O que pode ser melhorado

- **Branch protection** como medida técnica irrevogável — não depender de disciplina individual para impedir commits diretos em master
- **Spec-before-code** mesmo para features que surgem no meio da sprint — se a spec só pode ser escrita depois, é sinal de que a implementação foi prematura; criar spec rascunho antes de iniciar, mesmo que refinada depois
- **PO/PM Sync como cerimônia agendada, não ad-hoc** — em sprints curtas (≤7 dias), 2 syncs fixos no começo e meio da sprint evitam a lacuna
- **Status do board refletir em tempo real** — quando assets são adicionados via commit direto, o Orchestrator deve atualizar o Linear imediatamente; inconsistência entre board e código é ruído de auditoria
- **Daily antes de qualquer atividade — inclusive cerimônias de encerramento**

---

## Plano de ação — melhorias a implementar

| # | Melhoria | Responsável | Tipo | Prazo |
|---|----------|-------------|------|-------|
| 1 | Ativar branch protection no GitHub: require PR + status checks em `master` | Orchestrator | processo | **Nesta retro — imediato** |
| 2 | Corrigir status de HUB-56 no Linear para refletir o estado real (Done ou Bloqueada) | Orchestrator | processo | **Nesta retro — imediato** |
| 3 | Gerar Daily de 30/06 retroativamente | Orchestrator | processo | **Nesta retro — imediato** |
| 4 | Criar `docs/worktrees-ativos.md` no início da próxima sprint (comprometido desde 06-24) | Orchestrator | processo | Início da Sprint 2 |
| 5 | Agendar PO/PM Sync fixo 2x/semana no início da próxima sprint | Orchestrator + PO + PM | processo | Início da Sprint 2 |
| 6 | Criar spec rascunho antes de iniciar feature emergente — mesmo que aprovada retroativamente | Tech Lead + PO | processo | Sprint 2 |

## Itens aplicados nesta retro

- `docs/ceremonies/sprint-1/review.md` atualizado com todas as 29 issues Done (+ 2 pendentes)
- `docs/audits/audit-2026-06-30.md` gerado e commitado pelo process-auditor
- Branch protection: **a ser ativada pelo operador no GitHub** (não automatizável via CLI neste contexto)
- Status de HUB-56 no Linear: **a verificar e corrigir** (operador confirma se assets foram entregues)

## Itens pendentes para a próxima sprint

- Criar `docs/worktrees-ativos.md` como primeiro artefato da Sprint 2
- PO/PM Sync 2x/semana — agenda fixa, não ad-hoc
- Daily como primeira atividade irrevogável — inclusive nos dias de cerimônia
- Spec-before-code para features emergentes: rascunho antes, refinamento depois, nunca após o merge
