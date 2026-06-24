Você vai executar o code review de uma implementação através do Tech Lead.

**Alvo do review:** $ARGUMENTS

## Fluxo de Code Review

### Etapa 1 — Contexto

Se $ARGUMENTS for um ID de Issue do Linear (ex: LIN-42), busque a spec via MCP do Linear para o Tech Lead ter o contexto completo dos critérios de aceite e spec técnica.

Se $ARGUMENTS for um path de arquivo ou branch, use diretamente.

### Etapa 2 — Tech Lead executa o review

Spawne o agente `tech-lead`:
> Execute o code review completo para: $ARGUMENTS
>
> Use o checklist de Code Review do seu system prompt. Para cada item:
> - ✅ OK — breve justificativa
> - ❌ Problema — descrição clara + sugestão de correção
> - ⚠️ Sugestão — melhoria não bloqueante
>
> Classifique o resultado final como:
> - **APROVADO** — pode mergear
> - **APROVADO COM RESSALVAS** — ressalvas devem ser endereçadas mas não bloqueiam
> - **REPROVADO** — correções obrigatórias antes do merge

### Etapa 3 — Apresentar resultado

Mostre o resultado completo do review ao usuário no formato:

```
## Code Review — [alvo]

**Resultado:** [APROVADO / APROVADO COM RESSALVAS / REPROVADO]

### Problemas bloqueantes (❌)
- ...

### Sugestões não bloqueantes (⚠️)
- ...

### Pontos positivos (✅)
- ...
```

### Etapa 4 — Ação conforme resultado

**Se REPROVADO:**
- Liste as correções obrigatórias
- Spawne o agente dev responsável para corrigir: `dev-front` ou `dev-back`
- Após correção, execute o review novamente

**Se APROVADO ou APROVADO COM RESSALVAS:**
- Se houver Issue no Linear, atualize o status para `Done`
- Reporte que o PR está pronto para merge
