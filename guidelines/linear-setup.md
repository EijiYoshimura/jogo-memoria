# Configuração do Linear MCP

## Por que Linear?

O Linear é a ferramenta oficial de gestão de board deste time de agentes. Foi escolhido por:

- Tier gratuito robusto (sem limite de issues ou membros)
- MCP oficial e mantido pela própria Linear
- Suporte nativo a Cycles (Sprints), Projects, Issues e Milestones
- Interface rápida e focada em times de desenvolvimento
- Integração nativa com GitHub (referência de PRs por ID)

## Configuração Inicial

### 1. Criar conta no Linear

Acesse [linear.app](https://linear.app) e crie uma conta gratuita.

### 2. Criar o Workspace e Team

- Crie um Workspace para sua organização
- Crie um Team para cada projeto que usar este template

### 3. Conectar o MCP ao Claude Code

O MCP do Linear já está configurado em `.claude/settings.json`:

```json
{
  "mcpServers": {
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.app/sse"
    }
  }
}
```

Na primeira vez que o Orchestrator tentar usar o Linear, o Claude Code abrirá um fluxo de OAuth para autenticação. Basta autorizar o acesso.

### 4. Configurar Labels no Linear

Criar as seguintes labels no seu Team:

| Label | Cor sugerida | Uso |
|-------|-------------|-----|
| `spec` | Azul | Issues que são specs/documentação |
| `feature` | Verde | Novas funcionalidades |
| `bug` | Vermelho | Defeitos a corrigir |
| `tech-debt` | Laranja | Melhorias técnicas internas |
| `design` | Roxo | Tasks do Product Designer |
| `qa` | Amarelo | Tasks de validação do QA |

### 5. Configurar Workflow States

Configurar os seguintes estados no Linear:

```
Backlog → Todo → In Progress → In Review → Done
```

### 6. Criar o primeiro Cycle (Sprint)

- Acesse Settings → Cycles no seu Team
- Configure a duração (recomendado: 2 semanas)
- Crie o primeiro Cycle e nomeie como "Sprint 1"

## Estrutura de Issues

### Formato do Título

```
[TIPO] Descrição clara da tarefa
```

Tipos: `[FEAT]`, `[BUG]`, `[DESIGN]`, `[QA]`, `[TECH]`, `[SPEC]`

### Campos obrigatórios

- **Título:** formato acima
- **Descrição:** link para a spec + critérios de aceite
- **Assignee:** agente responsável (ou desenvolvedor real)
- **Label:** uma das labels configuradas
- **Estimate:** story points em Fibonacci
- **Cycle:** sprint atual
- **Status:** estado correto no workflow

## Uso pelo Orchestrator

O Orchestrator gerencia o Linear via MCP. Exemplos de operações:

```
# Criar issue
mcp__linear__create_issue(title, description, teamId, labelIds, estimate, cycleId)

# Atualizar status
mcp__linear__update_issue(issueId, stateId)

# Adicionar comentário
mcp__linear__create_comment(issueId, body)

# Listar issues do ciclo atual
mcp__linear__list_issues(filter: { cycle: current })
```

## Integração com GitHub

Ao criar PRs, referenciar sempre o ID da Issue do Linear no título e/ou corpo:

```
git commit -m "feat: implement user authentication (LIN-42)"
```

O Linear detecta automaticamente e vincula o PR à Issue.
