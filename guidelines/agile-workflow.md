# Fluxo Ágil do Time

## Visão Geral das Cerimônias

### Sprint Planning (início de cada ciclo)

**Responsável:** Orchestrator  
**Participantes:** PO + Tech Lead + todos os devs  
**Duração:** até 2h para sprint de 2 semanas

**Agenda:**
1. PO apresenta as histórias priorizadas do backlog
2. Tech Lead valida viabilidade técnica
3. Time estima em story points (Planning Poker com Fibonacci)
4. Orchestrator monta o Cycle no Linear com as issues selecionadas
5. Definição da capacidade da sprint (velocity)

**Output:** Cycle no Linear com issues estimadas e assignadas

---

### Daily Standup (diário)

**Responsável:** Orchestrator  
**Formato assíncrono — cada agente reporta:**

```
**[Nome do Agente] — Daily**
- Ontem: [o que foi feito]
- Hoje: [o que será feito]
- Impedimentos: [se houver, ou "nenhum"]
```

O Orchestrator consolida e atualiza o Linear se necessário.

---

### Backlog Grooming (meio do ciclo)

**Responsável:** PO + PM + Tech Lead  
**Frequência:** uma vez por sprint, no meio do ciclo

**Agenda:**
1. Revisar histórias candidatas para a próxima sprint
2. Refinar critérios de aceite que estejam vagos
3. Quebrar histórias grandes em menores (máx. 8 pontos por história)
4. Estimar histórias ainda não estimadas
5. Priorizar o topo do backlog

**Output:** Backlog refinado e priorizado no Linear para a próxima sprint

---

### Sprint Review (fim de cada ciclo)

**Responsável:** PO  
**Participantes:** todos os agentes + stakeholders

**Agenda:**
1. Demo das features entregues no ciclo
2. Validação dos critérios de aceite com o PO
3. Discussão sobre o que ficou de fora e por quê
4. Atualização do roadmap com base no aprendizado

**Output:** Issues do ciclo finalizadas no Linear, roadmap atualizado

---

### Retrospectiva (fim de cada ciclo)

**Responsável:** Orchestrator  
**Participantes:** todos os agentes

**Formato (Start / Stop / Continue):**

```
**Start:** O que deveríamos começar a fazer?
**Stop:** O que deveríamos parar de fazer?
**Continue:** O que está funcionando e devemos manter?
```

**Output:** Action items registrados como Issues no Linear com label `tech-debt` ou `process`

---

## Estados de uma Issue no Linear

```
Backlog
  ↓  (selecionada para sprint)
Todo
  ↓  (desenvolvimento iniciado)
In Progress
  ↓  (implementação concluída, aguardando validação)
In Review   ← QA valida aqui
  ↓  (QA aprovou, aguarda code review)
In Review   ← Tech Lead revisa aqui
  ↓  (code review aprovado, PR mergeado)
Done
```

## Definition of Ready (para entrar na Sprint)

Uma Issue só entra no sprint planning se tiver:

- [ ] User Story escrita no formato padrão
- [ ] Critérios de aceite claros e testáveis
- [ ] Design aprovado (se houver interface)
- [ ] Spec técnica esboçada pelo Tech Lead
- [ ] Estimativa em story points
- [ ] Sem dependências bloqueantes não resolvidas

## Definition of Done (para fechar a Issue)

Uma Issue só vai para `Done` se:

- [ ] Todos os critérios de aceite foram validados pelo QA
- [ ] Code review aprovado pelo Tech Lead
- [ ] Testes automatizados passando no CI
- [ ] PR mergeado na branch principal
- [ ] Issue atualizada para `Done` no Linear
- [ ] Documentação atualizada (se necessário)
- [ ] Sem bugs críticos abertos relacionados
