# Sprint Planning — Sprint 1 — 2026-06-24

## Meta da Sprint

> Entregar um jogo da memória funcional, standalone, pronto para uso em totem/tablet em eventos presenciais — com captura de leads antes do jogo, persistência em banco de dados (Supabase) com fallback offline, e painel admin para export dos dados.

## Período

| | |
|---|---|
| Início | 2026-06-24 |
| Término | 2026-07-01 |
| Duração | 7 dias corridos / 5 dias úteis |

## Participantes

- Orchestrator
- Tech Lead
- Dev Front
- QA

## Capacidade da Sprint

| Fator | Valor |
|---|---|
| Dias úteis | 5 |
| Velocity estimada | 23 story points |
| Complexidade geral | Alta (prazo apertado, stack nova) |

---

## Backlog da Sprint

### MEM-01 — [TECH] Setup do projeto
**Label:** tech-debt | **Estimativa:** 2pts | **Responsável:** dev-front

**Critérios de aceite:**
- [ ] Vite + React 19 + TypeScript rodando localmente
- [ ] Tailwind CSS configurado
- [ ] vite-plugin-federation configurado (exposes `./MemoryGame` de `src/game/index.tsx`)
- [ ] Supabase client inicializado via variáveis de ambiente
- [ ] `idb` instalado para IndexedDB
- [ ] Estrutura de pastas `src/game/` e `src/standalone/` criadas
- [ ] `config.json` de exemplo em `public/`

**Dependências:** nenhuma

---

### MEM-02 — [FEAT] ConfigLoader — carregamento de configuração do evento
**Label:** Feature | **Estimativa:** 2pts | **Responsável:** dev-front

**User Story:**
> Como operador, quero configurar o jogo por evento via um arquivo JSON, para que eu não precise alterar código para cada evento.

**Critérios de aceite:**
- [ ] `ConfigLoader.tsx` lê `/public/config.json` em runtime
- [ ] Interface `GameConfig` tipada em TypeScript cobre todos os campos obrigatórios
- [ ] Erro amigável exibido se config estiver mal formada ou ausente
- [ ] Config propagada via Context para todos os componentes filhos

**Dependências:** MEM-01

---

### MEM-03 — [FEAT] Formulário de Lead
**Label:** Feature | **Estimativa:** 3pts | **Responsável:** dev-front

**User Story:**
> Como participante do evento, quero preencher meus dados antes de jogar, para que a empresa possa me contatar com promoções.

**Critérios de aceite:**
- [ ] Campos renderizados dinamicamente a partir do array `leadForm.fields` do config
- [ ] Validação de campos `required: true` antes de submeter
- [ ] Feedback visual de erro por campo (inline)
- [ ] Inputs e botões com tamanho adequado para toque em totem (mín. 48px height)
- [ ] Ao submeter com sucesso, transição para o jogo
- [ ] Dados do lead disponíveis para persistência (MEM-04)

**Dependências:** MEM-02

---

### MEM-04 — [FEAT] Persistência de Leads (IndexedDB + Supabase)
**Label:** Feature | **Estimativa:** 3pts | **Responsável:** dev-front

**User Story:**
> Como organizador do evento, quero que nenhum lead seja perdido mesmo se a internet cair, para que eu tenha todos os dados dos participantes.

**Critérios de aceite:**
- [ ] Lead salvo no IndexedDB imediatamente ao submeter o formulário (antes de qualquer chamada de rede)
- [ ] Tentativa de insert no Supabase logo após salvar localmente
- [ ] Se Supabase falhar (offline): lead permanece na fila do IndexedDB com flag `synced: false`
- [ ] Listener de reconexão (`online` event) drena a fila automaticamente
- [ ] Cada lead persistido inclui: `event_id`, `data` (jsonb), `score`, `time_taken`, `played_at`
- [ ] Tabela `leads` no Supabase com RLS: anon pode inserir, não pode listar/deletar

**Dependências:** MEM-01

---

### MEM-05 — [FEAT] Jogo de Memória — domínio e componentes
**Label:** Feature | **Estimativa:** 5pts | **Responsável:** dev-front

**User Story:**
> Como participante, quero jogar o jogo da memória com cartas personalizadas do evento, dentro de um tempo limite, para concorrer a prêmios.

**Critérios de aceite:**
- [ ] Entidade `GameSession` com: estado do grid, pares encontrados, timer, status (playing/won/lost)
- [ ] Use case `StartGame`: embaralha pares de imagens, inicializa o grid
- [ ] Use case `FlipCard`: lógica de virar carta, checar match, bloquear duplo-clique
- [ ] `Board.tsx`: renderiza grid `N×M` configurável via `game.pairs` do config
- [ ] `Card.tsx`: animação CSS 3D flip (frente = imagem, verso = `game.cardBack`)
- [ ] Máximo 2 cartas viradas simultaneamente; se não combinam, viram de volta após 1s
- [ ] Timer countdown exibido; ao zerar, jogo encerra com status `lost`
- [ ] Ao encontrar todos os pares, jogo encerra com status `won`

**Dependências:** MEM-02

---

### MEM-06 — [FEAT] Tela de Resultado
**Label:** Feature | **Estimativa:** 2pts | **Responsável:** dev-front

**User Story:**
> Como participante, quero ver meu resultado ao terminar o jogo, para saber como me saí.

**Critérios de aceite:**
- [ ] Exibe: pares encontrados / total, tempo gasto (ou "tempo esgotado")
- [ ] Visual diferenciado para vitória vs. derrota por tempo
- [ ] Score e `time_taken` enviados para MEM-04 para persistência
- [ ] Botão "Próximo participante" reinicia o fluxo a partir da Splash
- [ ] Auto-reset após 30s sem interação (configurável no config)

**Dependências:** MEM-04, MEM-05

---

### MEM-07 — [FEAT] Tela Splash
**Label:** Feature | **Estimativa:** 1pt | **Responsável:** dev-front

**User Story:**
> Como operador, quero uma tela de apresentação com a identidade do evento, para que o totem atraia participantes.

**Critérios de aceite:**
- [ ] Exibe logo do evento (`event.logo`) e nome (`event.name`)
- [ ] Cores de fundo e destaque lidas do config (`primaryColor`, `backgroundColor`)
- [ ] Texto "Toque para jogar" com animação de pulso
- [ ] Toque em qualquer lugar inicia o fluxo (vai para Lead Form)
- [ ] Gesto oculto: 5 toques no logo → abre Admin (PIN solicitado)

**Dependências:** MEM-02

---

### MEM-08 — [FEAT] Painel Admin
**Label:** Feature | **Estimativa:** 3pts | **Responsável:** dev-front

**User Story:**
> Como operador, quero acessar um painel protegido por PIN para ver o status dos leads e exportá-los como CSV após o evento.

**Critérios de aceite:**
- [ ] Acesso via PIN de 4 dígitos (do `config.adminPin`)
- [ ] Exibe: total de leads coletados / sincronizados com Supabase / pendentes offline
- [ ] Botão "Exportar CSV": gera arquivo com todos os leads (Supabase + IndexedDB pendentes, sem duplicatas)
- [ ] Colunas do CSV: todos os campos do lead form + `played_at`, `score`, `time_taken`
- [ ] Botão "Forçar Sync": tenta sincronizar pendentes imediatamente
- [ ] Botão "Fechar Admin": volta para Splash

**Dependências:** MEM-04

---

### MEM-09 — [QA] Validação em dispositivos e resiliência offline
**Label:** qa | **Estimativa:** 2pts | **Responsável:** qa

**Critérios de aceite:**
- [ ] Testado em Chrome fullscreen (modo quiosque: `--kiosk --disable-pinch`)
- [ ] Testado em tablet (Chrome mobile ou Safari mobile)
- [ ] Cenário offline: WiFi desligado → lead salvo no IndexedDB → sem erro visível ao usuário
- [ ] Cenário reconexão: WiFi religado → sync automático → lead aparece no Supabase
- [ ] Sem scroll indesejado na página (totem não deve ter scroll)
- [ ] Sem zoom por pinça (meta viewport configurado)

**Dependências:** MEM-01 a MEM-08

---

## Resumo de Pontuação

| Issue | Título | Pts |
|---|---|---|
| MEM-01 | Setup do projeto | 2 |
| MEM-02 | ConfigLoader | 2 |
| MEM-03 | Formulário de Lead | 3 |
| MEM-04 | Persistência de Leads | 3 |
| MEM-05 | Jogo de Memória | 5 |
| MEM-06 | Tela de Resultado | 2 |
| MEM-07 | Tela Splash | 1 |
| MEM-08 | Painel Admin | 3 |
| MEM-09 | Validação QA | 2 |
| **Total** | | **23 pts** |

## Ordem de desenvolvimento (considerando dependências)

```
MEM-01 (setup)
  ↓
MEM-02 (config) + MEM-04 (persistência) — paralelo
  ↓
MEM-03 (lead form) + MEM-05 (jogo) — paralelo
  ↓
MEM-06 (resultado) + MEM-07 (splash) + MEM-08 (admin) — paralelo
  ↓
MEM-09 (QA)
```

## Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| WiFi instável no evento | Alta | Alto | IndexedDB offline buffer (MEM-04) |
| Config.json mal configurado pelo operador | Média | Alto | Validação + mensagem de erro clara (MEM-02) |
| Touch events inconsistentes entre dispositivos | Média | Médio | Teste em totem e tablet (MEM-09) |
| Prazo apertado (5 dias) | Alta | Alto | MEM-05 tem maior complexidade — iniciar no dia 1 |
