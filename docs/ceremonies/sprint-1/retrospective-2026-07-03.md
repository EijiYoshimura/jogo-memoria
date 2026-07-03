# Retrospectiva — Sprint 1 (incremento 2: CPF antifraude + segurança) — 2026-07-03

> Segundo encerramento do cycle "Sprint 1" (o 1º foi em 30/06). **Insumo obrigatório:** `docs/audits/audit-2026-07-03.md` — 8 achados (1 🔴, 4 🟡, 3 🟢).

## Participantes
- Orchestrator, PO, PM, Tech Lead, Dev Back, Dev Front, QA, Product Designer, Process Auditor

---

## O que funcionou bem
- **Engenharia amadureceu (auditoria):** 7/7 PRs referenciam issue e trazem evidência do gate (lint+tsc+testes); trilha AUD-04 (TL·QA·PO) completa nas entregas centrais — a melhor da série; 0 retrabalho de status; 0 worktrees órfãos.
- **Rede de gates multicamada pegou o que uma camada perdeu:** o QA capturou o `reconciliation.ts` como binário (bytes NUL) que o diff escondeu do Tech Lead no PR #38, e forçou a correção antes do merge. Nada defeituoso passou.
- **Ordenação por dependências:** ondas paralelizaram o independente (HUB-89/90/93 juntos) e serializaram o dependente (91 → 92), sem furar bloqueios.
- **Melhorias #1/#2 (contexto/recorte de spec) deram efeito medível:** prefill do agente caiu **1596s → 582s → 158s** (HUB-91 → HUB-92 → HUB-94) conforme o briefing passou de "leia o spec inteiro" para "recorte + contrato pronto".
- **Segurança na ordem certa:** fechou a exposição de PII (HUB-88) **antes** de ampliar a coleta de dado sensível (CPF).

## O que não funcionou
- 🔴 **PO/PM Sync sumiu de novo** (repete achado de 30/06): só há sync de 24/06, zero na semana de decisões LGPD. Consequência: **HUB-95** (controlador inconsistente) segue live em produção no Backlog, e **HUB-96** só foi decidido no último dia.
- 🟡 **Modelo de sprint incoerente:** um único ciclo Linear recebeu Review+Retro duas vezes; a auditoria de 02/07 chamou o mesmo trabalho de "Sprint 2"; ceremonies datadas conviveram com não-datadas. Não dava para dizer "em que sprint estamos".
- 🟡 **Daily não foi a 1ª atividade:** o daily de 02/07 foi escrito às 22:53, depois de todo o ciclo do HUB-88.
- 🟡 **`cd … && …` (proibido no sandbox) cresceu 72 → 183 ocorrências** (52% dos comandos); 0 aprovações dispararam (sorte de config), mas o risco latente subiu — com agentes auto-atestando "nenhum comando exigiu aprovação" enquanto o usavam.

## O que pode ser melhorado
- Recorte de spec deixar de ser ad-hoc e virar **regra** (o outlier HUB-91 estourou 302k de contexto porque leu specs inteiros).
- Um **guard automático barato** para o achado do binário, em vez de depender do olho do QA.
- Cadência de PO/PM Sync **fixada** e cobrada no encerramento.
- **Sprint = ciclo Linear (1:1)** para acabar com a ambiguidade.

---

## Plano de ação — melhorias

| # | Melhoria | Responsável | Tipo | Status |
|---|----------|-------------|------|--------|
| 1 | Recorte de spec obrigatório em issues ≥5 pts + orçamento de contexto (~120k) — Orchestrator injeta extrato, nunca "leia o doc inteiro" | Orchestrator | diretriz | ✅ aplicado (CLAUDE.md) |
| 2 | Batch de tool calls independentes (reads juntos; lint+tsc+test em paralelo) | devs/TL/QA | diretriz | ✅ aplicado (CLAUDE.md) |
| 3 | Erradicar `cd … && …` → `git -C` / `npm --prefix` / binário por caminho absoluto | todos | diretriz | ✅ aplicado (CLAUDE.md, tabela sandbox) |
| 4 | Daily como **1ª atividade real** — abrir/gerar o daily antes de disparar o 1º agente do dia | Orchestrator | processo | ✅ aplicado (CLAUDE.md) |
| 5 | PO/PM Sync: 2 dias fixos no Planning + gate "≥2 syncs/semana" no encerramento | PO/PM/Orchestrator | processo | ✅ aplicado (CLAUDE.md) |
| 6 | **Sprint := ciclo Linear (1:1)** + convenção de nome das cerimônias (datadas quando o ciclo tem +1 incremento) | Orchestrator | processo | ✅ aplicado (CLAUDE.md) |
| 7 | Regra de merge: nenhum PR com arquivo-fonte **binário** (`numstat - -`) ou com bytes de controle é mergeado | Tech Lead/Orchestrator | diretriz | ✅ aplicado (CLAUDE.md) |
| 8 | **Guard automático** (script/pre-commit ou passo do gate) que detecta arquivo-fonte binário/bytes de controle | dev-front | código | → Linear (`tech-debt`) |
| 9 | Compartilhar `node_modules` entre worktrees (pnpm store / cache comum) | dev/Orchestrator | código | → Linear (`tech-debt`) |
| 10 | HUB-95: prioridade + due date + cobrança no próximo PO/PM Sync | PO | processo | ✅ aplicado (board) |

## Itens aplicados nesta retro (commitados)
- Edições no `CLAUDE.md`: tabela sandbox (`cd &&`), regra de batching, orçamento de contexto + recorte de spec, daily-1ª-atividade, cadência de PO/PM Sync + gate, sprint:=ciclo Linear + naming, regra de PR-binário.
- Ações de board: HUB-95 repriorizada (due date 2026-07-10); issues de tech-debt criadas — **HUB-100** (guard de binário, item 8) e **HUB-101** (`node_modules` compartilhado, item 9).

## Itens pendentes para a próxima sprint (Linear)
- **HUB-100** — guard automático de arquivo binário (`tech-debt`).
- **HUB-101** — `node_modules` compartilhado entre worktrees (`tech-debt`).
- HUB-95 — resolução do controlador de dados (aguarda jurídico).
