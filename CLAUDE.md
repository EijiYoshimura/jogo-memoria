# Diretrizes do Time de Agentes

## Visão Geral

Este repositório define o modelo padrão de equipe de agentes a ser utilizado em todos os projetos. A equipe é composta por papéis especializados que colaboram seguindo metodologia ágil, com obrigatoriedade de Spec Driven Development, Clean Code e Clean Architecture.

---

## Equipe

| Agente | Papel |
|--------|-------|
| `orchestrator` | Coordena o time, roteia tarefas, garante o fluxo |
| `product-manager` | Visão de produto, roadmap, métricas de negócio |
| `product-owner` | Backlog, user stories, critérios de aceite |
| `tech-lead` | Arquitetura, padrões técnicos, code review |
| `dev-front` | Desenvolvimento frontend |
| `dev-back` | Desenvolvimento backend |
| `product-designer` | UX/UI, design system, acessibilidade |
| `qa` | Plano de testes, validação de specs, qualidade |
| `process-auditor` | Auditoria de processo, identificação de desperdícios e melhorias |

---

## Board — Linear

**Ferramenta oficial:** [Linear](https://linear.app) (tier gratuito)

O Linear é a ferramenta de gestão de board da equipe. O MCP oficial do Linear (`https://mcp.linear.app/sse`) deve estar configurado em todos os projetos que usam este template.

### Estrutura no Linear

- **Workspace:** um por organização/empresa
- **Teams:** um por projeto
- **Cycles:** representam as Sprints (1-2 semanas)
- **Issues:** tarefas individuais com estimativa em pontos
- **Projects:** agrupam iniciativas maiores
- **Labels obrigatórias:** `spec`, `feature`, `bug`, `tech-debt`, `design`, `qa`

### Regras de uso do board

1. Nenhuma tarefa entra em desenvolvimento sem uma Issue no Linear
2. Toda Issue deve ter: título claro, descrição, critérios de aceite, estimativa (story points) e label
3. O status das Issues deve ser atualizado em tempo real: `Backlog → Todo → In Progress → In Review → Done`
4. O Orchestrator é responsável por criar e atualizar Issues via MCP do Linear
5. PRs devem referenciar o ID da Issue (`LIN-123`)

---

## Isolamento de Agentes — Processos e Branches

### Princípio de Isolamento

Cada sub-agente opera em um **processo independente do Claude Code** e em um **branch git dedicado via `git worktree`**. Isso garante que múltiplos agentes trabalhem em paralelo no mesmo repositório sem conflitos de working tree ou de branch.

### Como funciona o git worktree

`git worktree` permite múltiplos checkouts simultâneos do mesmo repositório em diretórios separados. Cada agente recebe seu próprio diretório de trabalho, isolado dos demais:

```
projeto/                              ← working tree principal (main/develop) — Orchestrator
.worktrees/
├── dev-back/LIN-42-user-auth/        ← worktree exclusivo do dev-back
├── dev-front/LIN-42-login-form/      ← worktree exclusivo do dev-front
└── qa/LIN-42-user-auth/              ← worktree exclusivo do QA (quando necessário)
```

### Convenção de Branches

| Padrão | Exemplo |
|--------|---------|
| `dev-back/{issue-id}-{slug}` | `dev-back/LIN-42-user-auth` |
| `dev-front/{issue-id}-{slug}` | `dev-front/LIN-42-login-form` |
| `qa/{issue-id}-{slug}` | `qa/LIN-42-user-auth` |
| `tech-lead/{issue-id}-{slug}` | `tech-lead/LIN-42-arch-decision` |

**Regra:** nenhum agente commita diretamente em `main`, `master` ou `develop`.

### Ciclo de Vida de um Worktree

**1. Orchestrator cria o branch e o worktree antes de delegar a tarefa:**

```bash
git worktree add .worktrees/dev-back/LIN-42-user-auth -b dev-back/LIN-42-user-auth origin/develop
```

**2. Orchestrator instrui o agente com o caminho exato do worktree como diretório de trabalho:**

```
Diretório de trabalho: /projeto/.worktrees/dev-back/LIN-42-user-auth/
Branch: dev-back/LIN-42-user-auth
Issue: LIN-42
Spec: /projeto/docs/specs/LIN-42-user-auth.md
```

**3. Agente trabalha exclusivamente dentro do seu worktree, commita e faz push:**

```bash
# Executado dentro do worktree do agente
git add .
git commit -m "feat(LIN-42): implementa autenticação de usuário"
git push origin dev-back/LIN-42-user-auth
```

**4. Agente abre PR apontando para `develop` (ou `main`), referencia o ID da Issue e notifica o Orchestrator.**

**5. Orchestrator remove o worktree após merge aprovado:**

```bash
git worktree remove .worktrees/dev-back/LIN-42-user-auth
git branch -d dev-back/LIN-42-user-auth
```

### Regras de Isolamento

1. **Nunca** executar `git checkout` ou `git switch` na working tree principal enquanto outros agentes estão ativos
2. Cada agente opera **somente dentro do seu worktree** — não lê nem modifica arquivos de worktrees alheios
3. O Orchestrator é o **único responsável** por criar, registrar e remover worktrees
4. Branches de agentes são **temporários** — deletados após o merge do PR
5. Conflitos de merge são resolvidos pelo agente responsável, com apoio do Tech Lead se necessário
6. A working tree principal (raiz do projeto) é reservada ao Orchestrator e ao Tech Lead para code review
7. **O Orchestrator nunca dispara atividades com dependências em paralelo** — uma tarefa só é iniciada quando todos os seus bloqueantes têm PR aprovado e mergeado em `develop`/`main`. Atividades sem dependências entre si podem e devem ser paralelizadas.

### Fluxo de PR e Merge com Isolamento

```
Orchestrator cria worktree + branch para o agente
    ↓
Agente desenvolve no seu worktree (processo isolado)
    ↓
Agente abre PR: {branch do agente} → develop
    ↓
Tech Lead faz code review (no seu contexto, sem mudar de branch)
    ↓
QA valida (pode receber worktree próprio se precisar executar a feature)
    ↓
Tech Lead aprova e faz merge via GitHub/GitLab
    ↓
Orchestrator remove o worktree e o branch
    ↓
Orchestrator atualiza status no Linear para Done
```

### O que o Orchestrator registra ao criar um worktree

O Orchestrator documenta cada worktree ativo em `/docs/worktrees-ativos.md` (ou mantém no Linear como comentário da Issue) com:

| Campo | Valor |
|-------|-------|
| Agente | `dev-back` |
| Issue | `LIN-42` |
| Branch | `dev-back/LIN-42-user-auth` |
| Worktree | `.worktrees/dev-back/LIN-42-user-auth/` |
| Status | `In Progress` |
| Criado em | `YYYY-MM-DD` |

---

## Metodologia Ágil

### Cerimônias

| Cerimônia | Responsável | Frequência | Arquivo gerado |
|-----------|-------------|------------|----------------|
| Sprint Planning | Orchestrator + PO + Tech Lead | Início de cada ciclo | `/docs/ceremonies/sprint-{n}/planning.md` |
| Daily Standup | Todos os agentes | Diário (1ª atividade) | `/docs/ceremonies/sprint-{n}/daily-YYYY-MM-DD.md` |
| PO/PM Sync | PO + PM | 2x por semana | `/docs/ceremonies/sprint-{n}/po-pm-sync-YYYY-MM-DD.md` |
| Sprint Review | Todos os agentes | Fim de cada ciclo (obrigatória) | `/docs/ceremonies/sprint-{n}/review.md` |
| Retrospectiva | Todos os agentes | Fim de cada ciclo (obrigatória, logo após a Review) | `/docs/ceremonies/sprint-{n}/retrospective.md` |
| Backlog Grooming | PO + PM + Tech Lead | Meio do ciclo | `/docs/ceremonies/sprint-{n}/grooming.md` |

**Regras obrigatórias:**
- **A primeira atividade de cada dia é sempre o Daily Standup.** O Orchestrator o conduz e salva o arquivo antes de qualquer outra tarefa ser iniciada ou retomada.
- **Ao final de cada sprint, Sprint Review e Retrospectiva são obrigatórias e ocorrem nessa ordem**, sem exceção. A sprint só é encerrada após ambas concluídas e documentadas.
- Toda cerimônia deve gerar um arquivo Markdown salvo no repositório imediatamente após sua execução. Nenhuma cerimônia é considerada concluída sem o arquivo correspondente commitado.

### Fluxo de uma Feature

```
PM define requisito
    ↓
PO escreve User Story + critérios de aceite
    ↓
Designer cria spec visual (se aplicável)
    ↓
Tech Lead valida arquitetura e cria spec técnica
    ↓
PO aprova spec funcional | PM valida alinhamento de negócio
    ↓
** SPEC APROVADA (PO + PM + Tech Lead) → só então inicia o desenvolvimento **
    ↓
Dev Front / Dev Back implementam seguindo a spec
  → rodam suite de testes antes de iniciar (baseline)
  → rodam suite de testes ao finalizar (regressão + novos testes)
    ↓
QA valida contra critérios de aceite
    ↓
PO aprova o PR (critérios de aceite atendidos?)
    ↓
Tech Lead faz code review rigoroso (spec, arquitetura, clean code, evidência de testes)
    ↓
Orchestrator atualiza Linear e fecha a Issue
```

### Story Points (Fibonacci)

| Pontos | Complexidade |
|--------|-------------|
| 1 | Trivial, menos de 1h |
| 2 | Simples, até meio dia |
| 3 | Moderado, até 1 dia |
| 5 | Complexo, 2-3 dias |
| 8 | Muito complexo, semana |
| 13 | Épico, quebrar em partes |

---

## Documentação de Cerimônias e Relatórios

### Estrutura de arquivos

```
docs/
├── ceremonies/
│   └── sprint-{n}/
│       ├── planning.md                  # Sprint Planning
│       ├── daily-YYYY-MM-DD.md          # Daily Standup (um por dia — 1ª atividade)
│       ├── po-pm-sync-YYYY-MM-DD.md     # PO/PM Sync (2x por semana)
│       ├── grooming.md                  # Backlog Grooming
│       ├── review.md                    # Sprint Review
│       └── retrospective.md             # Retrospectiva
├── audits/
│   └── audit-YYYY-MM-DD.md             # Relatório de Auditoria de Processo
└── reports/
    └── daily/
        └── YYYY-MM-DD.md                # Relatório diário de evolução
```

### Template de Daily Standup (`daily-YYYY-MM-DD.md`)

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
| HUB-XX | In Progress | In Review |

## Impedimentos ativos
- (lista ou "Nenhum")
```

### Template de Relatório Diário (`reports/daily/YYYY-MM-DD.md`)

```markdown
# Relatório Diário — YYYY-MM-DD

## Progresso da Sprint {n}

### Issues concluídas hoje
- [ ] HUB-XX — Título (N pts)

### Issues em andamento
- HUB-XX — Título | responsável: agente | % estimado: XX%

### Issues bloqueadas
- HUB-XX — Título | motivo: ...

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

### Template de PO/PM Sync (`po-pm-sync-YYYY-MM-DD.md`)

```markdown
# PO/PM Sync — YYYY-MM-DD

## Participantes
- Product Owner: (nome/agente)
- Product Manager: (nome/agente)

## Status das entregas vs. objetivos de negócio

| Issue | Status | Alinhado ao negócio? | Observações |
|-------|--------|----------------------|-------------|
| LIN-XX | In Progress | Sim / Não | ... |

## Desvios identificados
- (lista de desvios ou "Nenhum")

## Decisões e alinhamentos
- (lista de decisões ou ajustes de direção)

## Próximos passos acordados
- (ações concretas com responsável)
```

### Template de Sprint Review (`review.md`)

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

### Template de Retrospectiva (`retrospective.md`)

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
| 2 | ... | agente | ... | ... |

**Tipos de melhoria:**
- `processo` — mudança em cerimônia, fluxo ou regra de trabalho
- `diretriz` — atualização do CLAUDE.md ou de arquivos em `guidelines/`
- `agente` — ajuste na definição de um sub-agente em `.claude/agents/`
- `código` — tech-debt ou padrão técnico a corrigir

## Itens aplicados nesta retro
- (mudanças que já foram commitadas ao final desta sessão)

## Itens pendentes para a próxima sprint
- (melhorias que virarão Issues no Linear com label `tech-debt` ou `processo`)
```

### Regras de Review e Retrospectiva

1. Review e Retro ocorrem **sempre no mesmo dia**, ao final da sprint, nessa ordem — nunca separadas
2. **Todos os agentes participam** de ambas as cerimônias
3. **O `process-auditor` executa a auditoria de sprint antes da Retrospectiva** — o relatório (`/docs/audits/audit-YYYY-MM-DD.md`) é insumo obrigatório para o Plano de Ação da Retro
4. Na Retrospectiva, o time valida coletivamente o que funcionou, o que não funcionou e o que pode melhorar — em processo, fluxo, diretrizes e código; os achados do auditor são o ponto de partida
5. **Melhorias identificadas são obrigatoriamente implementadas**: mudanças em processo → atualizar `CLAUDE.md`; mudanças em agentes → atualizar `.claude/agents/`; mudanças em guias → atualizar `guidelines/`
6. O que não puder ser aplicado imediatamente vira Issue no Linear com label `processo` ou `tech-debt` e entra no backlog da próxima sprint
7. O Orchestrator commita as mudanças ao final da cerimônia — a Retro só é **Done** quando as melhorias aplicáveis estão commitadas
8. A próxima Sprint Planning só inicia após Review e Retro concluídas e documentadas

### Regras de documentação e relatórios

1. O Orchestrator é responsável por gerar o arquivo de cada cerimônia ao final da mesma
2. O relatório diário (`reports/daily/YYYY-MM-DD.md`) deve ser gerado pelo Orchestrator ao final de cada dia de trabalho ou quando solicitado pelo usuário
3. O Daily Standup é gerado como parte do relatório diário — ambos os arquivos devem existir
4. Os arquivos devem ser salvos no repositório; o Orchestrator faz o commit ao final da cerimônia/dia
5. Nenhuma cerimônia é considerada **Done** sem seu arquivo correspondente gerado e salvo
6. O relatório diário consolida: evolução do board no Linear, decisões tomadas e impedimentos
7. O PO/PM Sync ocorre **no mínimo 2x por semana** — PO apresenta o status das entregas, PM valida o alinhamento com os objetivos de negócio e OKRs. O arquivo de registro é gerado ao final de cada sync.

---

## Spec Driven Development (SDD)

**Obrigatório.** Nenhuma linha de código é escrita sem spec aprovada.

### O que é uma Spec

Uma spec é um documento estruturado que descreve **o que** será construído antes do **como**. Ela serve como contrato entre PM, PO, Designer, Tech Lead e Devs.

### Estrutura obrigatória de uma Spec

```markdown
# Spec: [Nome da Feature]

## Contexto
Por que esta feature existe? Qual problema resolve?

## User Story
Como [perfil de usuário], quero [ação], para que [benefício].

## Critérios de Aceite
- [ ] Critério 1 (Given / When / Then)
- [ ] Critério 2
- [ ] ...

## Design (link Figma/Excalidraw)
URL ou referência ao design aprovado

## Spec Técnica
### Arquitetura envolvida
### Contratos de API (se houver)
### Modelo de dados (se houver)
### Considerações de performance/segurança

## Fora de Escopo
O que explicitamente NÃO será feito nesta entrega

## Definition of Done
- [ ] Critérios de aceite validados pelo QA
- [ ] Code review aprovado pelo Tech Lead
- [ ] Issue atualizada no Linear
- [ ] Documentação atualizada (se necessário)
```

### Regras do SDD

1. A spec é escrita pelo PO (parte funcional) + Tech Lead (parte técnica)
2. O PM valida alinhamento com a visão de produto
3. O Designer valida/contribui com a parte visual
4. O QA valida se os critérios de aceite são testáveis
5. **O PO aprova explicitamente** a spec funcional antes de qualquer implementação — aprovação tácita não é aceita
6. Spec deve ser aprovada por todos antes de qualquer implementação
7. Mudanças de escopo durante o desenvolvimento exigem atualização da spec e nova aprovação do PO
8. As specs ficam versionadas no repositório em `/docs/specs/`
9. **O PO aprova o PR** de toda Issue sob sua responsabilidade antes do merge — verificando que os critérios de aceite foram cumpridos

---

## Clean Code

**Obrigatório** em todo código produzido por qualquer agente dev.

### Princípios

- **Nomes significativos:** variáveis, funções e classes com nomes que revelam intenção
- **Funções pequenas:** cada função faz uma única coisa e faz bem
- **DRY (Don't Repeat Yourself):** abstrair duplicação de forma genuína, não prematura
- **YAGNI (You Aren't Gonna Need It):** não implementar o que não está na spec
- **Comentários apenas quando o "porquê" não é óbvio** do código
- **Tratamento de erro explícito:** nunca silenciar erros
- **Testes como cidadãos de primeira classe:** código sem teste não entra em produção

### Regras

1. Funções com mais de 20 linhas devem ser revisadas para extração
2. Nenhum magic number/string — usar constantes nomeadas
3. Complexidade ciclomática máxima de 10 por função
4. Cobertura mínima de testes: 80% para lógica de negócio
5. Sem código comentado — usar git para histórico
6. Sem `console.log` / `print` de debug em produção

### Regras Invioláveis para Devs

Estas regras **nunca podem ser quebradas**, independentemente de prazo, pressão ou tamanho da tarefa:

1. **Código limpo sempre** — não existe "farei depois" ou "por enquanto assim está bom"
2. **Zero código morto** — imports, funções, variáveis, arquivos e rotas não utilizadas devem ser removidos imediatamente; o que não serve mais não fica no codebase
3. **O que funciona continua funcionando** — nenhuma implementação pode quebrar funcionalidades existentes; regressão é bloqueante
4. **Baseline de testes antes de iniciar** — antes de escrever qualquer linha de código, rodar a suite completa de testes e confirmar que todos passam; se houver falhas pré-existentes, reportar ao Tech Lead antes de continuar
5. **Validação de regressão ao finalizar** — ao concluir o desenvolvimento, rodar novamente a suite completa; os testes anteriores devem continuar passando e os novos testes devem passar
6. **Todo PR exige evidência de testes** — a descrição do PR deve incluir o log ou screenshot da execução dos testes, demonstrando que: (a) testes existentes passam e (b) novos testes passam; PR sem evidência não é aceito para review

---

## Clean Architecture

**Obrigatório** na estrutura de todos os projetos.

### Camadas (de dentro para fora)

```
┌─────────────────────────────────────────┐
│            Frameworks & Drivers          │  ← UI, DB, Web, Devices
├─────────────────────────────────────────┤
│          Interface Adapters              │  ← Controllers, Presenters, Gateways
├─────────────────────────────────────────┤
│          Application (Use Cases)         │  ← Regras de aplicação
├─────────────────────────────────────────┤
│            Domain (Entities)             │  ← Regras de negócio puras
└─────────────────────────────────────────┘
```

### Regras de Dependência

- Dependências apontam **sempre para dentro** (em direção ao domínio)
- O domínio não conhece frameworks, banco de dados ou UI
- Use cases não conhecem a camada de apresentação
- Interfaces (ports) são definidas no interior, implementações no exterior

### Estrutura de pastas padrão

```
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   └── repositories/ (interfaces)
├── application/
│   ├── use-cases/
│   ├── dtos/
│   └── ports/
├── infrastructure/
│   ├── repositories/ (implementações)
│   ├── database/
│   └── external-services/
└── presentation/
    ├── controllers/ (ou components/ no front)
    ├── viewmodels/
    └── routes/
```

### SOLID

| Princípio | Regra |
|-----------|-------|
| **S**ingle Responsibility | Cada classe/módulo tem um único motivo para mudar |
| **O**pen/Closed | Aberto para extensão, fechado para modificação |
| **L**iskov Substitution | Subtipos devem ser substituíveis por seus tipos base |
| **I**nterface Segregation | Interfaces específicas são melhores que uma genérica |
| **D**ependency Inversion | Dependa de abstrações, não de implementações |

---

## Regras Gerais do Time

1. Nenhum agente age fora do seu escopo sem autorização do Orchestrator
2. Toda decisão técnica relevante é registrada como ADR (Architecture Decision Record) em `/docs/adr/`
3. O Orchestrator atualiza o Linear ao final de cada tarefa concluída
4. O QA valida **contra a spec**, não contra o código
5. Code review é feito pelo Tech Lead — nenhum PR é mergeado sem aprovação
6. Dúvidas de escopo são resolvidas com o PO, não durante o desenvolvimento
7. Mudanças de arquitetura passam pelo Tech Lead antes de qualquer implementação

### Responsabilidades específicas por papel

**Tech Lead — Rigor não negociável:**
- O Tech Lead é o guardião de SDD, Clean Architecture, Clean Code e boas práticas — sem exceções para urgências ou prazos
- Todo code review deve verificar explicitamente: aderência à spec, separação de camadas (Clean Architecture), qualidade de código (Clean Code), cobertura de testes, ausência de código morto e evidência de testes passando
- O Tech Lead tem autoridade para **bloquear qualquer PR** que viole esses padrões, independentemente de quem solicitou ou da pressão de entrega
- Aprovação do Tech Lead é necessária mesmo para mudanças pequenas — não existe PR "trivial demais para review"

**Product Owner — Aprovação e alinhamento:**
- O PO aprova explicitamente specs e PRs das Issues sob sua responsabilidade — nunca por omissão
- O PO se reúne com o PM **no mínimo 2x por semana** para reportar o status das entregas e garantir alinhamento com os objetivos de negócio
- Toda reunião PO/PM é documentada em `/docs/ceremonies/sprint-{n}/po-pm-sync-YYYY-MM-DD.md`

**Product Manager — Validação de negócio:**
- O PM valida no PO/PM Sync que as entregas em andamento e concluídas estão alinhadas com OKRs e estratégia de produto
- Desvios identificados devem ser escalados imediatamente ao Orchestrator com proposta de ação corretiva

**Process Auditor — Observação independente:**
- O `process-auditor` é acionado pelo Orchestrator ao final de cada sprint (antes da Retro) e sob demanda a qualquer momento
- Achados classificados como 🔴 Crítico são reportados imediatamente ao Orchestrator — não aguardam o ciclo de auditoria
- O auditor não bloqueia o fluxo, não aprova nem reprova trabalho — apenas observa, mede e recomenda
- Relatórios de auditoria ficam em `/docs/audits/` e são sempre commitados ao repositório
