# Backlog Grooming — Sprint 1 — 2026-06-24

## Participantes

- Orchestrator
- Product Owner
- Tech Lead

## Objetivos desta sessão

- Refinar todas as histórias da Sprint 1 (urgência: prazo de dias)
- Confirmar critérios de aceite testáveis
- Validar estimativas
- Registrar decisões técnicas relevantes

---

## Refinamento por Issue

### MEM-01 — Setup do projeto (2pts) ✅ Ready

**Decisões tomadas:**
- Stack confirmada: React 19 + Vite + TypeScript + Tailwind
- `vite-plugin-federation` configurado desde o início (caminho de integração ao Hub)
- Estrutura de pastas reflete separação plugin/standalone:
  - `src/game/` → código que vira plugin Hub
  - `src/standalone/` → casca descartável ao integrar ao Hub
- Variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

**Fora de escopo desta issue:**
- CI/CD (não bloqueia o evento)
- Testes unitários de setup (cobertura entra nas issues de feature)

---

### MEM-02 — ConfigLoader (2pts) ✅ Ready

**Interface `GameConfig` acordada:**

```typescript
interface GameConfig {
  event: {
    id: string           // usado como event_id nos leads
    name: string
    logo: string         // path relativo em /public/images/
    primaryColor: string
    backgroundColor: string
  }
  game: {
    pairs: number        // mín. 4, máx. 12
    cardImages: string[] // length deve ser >= pairs
    cardBack: string
    timeLimitSeconds: number
    autoResetSeconds?: number  // padrão: 30
  }
  leadForm: {
    title: string
    fields: Array<{
      id: string
      label: string
      type: 'text' | 'email' | 'tel'
      required: boolean
      mask?: string      // ex: '(99) 99999-9999' para telefone
    }>
  }
  adminPin: string
}
```

**Decisão:** config carregada via `fetch('/config.json')` no mount do App. Erro de config bloqueia a aplicação com tela de erro amigável (não silencia).

---

### MEM-03 — Formulário de Lead (3pts) ✅ Ready

**Decisões de UX para totem:**
- Font size mínimo: 18px para labels, 20px para inputs
- Height mínima dos campos: 56px (área de toque confortável)
- Teclado virtual do browser é suficiente (sem implementar teclado customizado)
- Scroll no formulário permitido se houver muitos campos (overflow-y: auto)
- Sem autofill do browser (totem compartilhado: `autocomplete="off"`)

**Campos mínimos sugeridos no config.json de exemplo:**
- Nome (text, required)
- E-mail (email, required)
- WhatsApp (tel, optional) com máscara `(99) 99999-9999`

**Fora de escopo:**
- Consentimento LGPD explícito na tela (será incluído na Sprint 2 se o cliente exigir)
- Foto do participante

---

### MEM-04 — Persistência de Leads (3pts) ✅ Ready

**Esquema da tabela Supabase:**

```sql
CREATE TABLE leads (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     text    NOT NULL,
  data         jsonb   NOT NULL,
  score        integer,
  time_taken   integer,           -- em segundos
  played_at    timestamptz DEFAULT now(),
  synced_from  text    DEFAULT 'online',  -- 'online' | 'offline-sync'
  created_at   timestamptz DEFAULT now()
);

-- RLS: anon pode inserir, não pode ler/alterar/deletar
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert only"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Service role tem acesso total (para admin export e futuro Hub)
```

**Estrutura IndexedDB:**
- Database: `jogo-memoria-db`
- Store: `leads-queue`
- Cada item: `{ localId, eventId, data, score, timeTaken, playedAt, synced: boolean }`

**Fluxo de sync:**
1. Salva no IndexedDB com `synced: false`
2. Tenta insert no Supabase
3. Se OK → atualiza `synced: true` no IndexedDB
4. Se falha → mantém `synced: false`, listener de `window.addEventListener('online', ...)` tenta novamente

**Deduplicação no CSV:**
- IndexedDB retorna todos; filtro `synced: false` evita duplicatas com Supabase
- CSV exportado = Supabase leads + IndexedDB `synced: false`

---

### MEM-05 — Jogo de Memória (5pts) ✅ Ready

**Domínio:**
```
GameSession
  - id: string
  - cards: Card[]
  - flippedCards: Card[]    // máx. 2
  - matchedPairs: number
  - totalPairs: number
  - timeRemaining: number
  - status: 'idle' | 'playing' | 'won' | 'lost'

Card
  - id: string
  - pairId: string          // identifica o par
  - imageUrl: string
  - state: 'hidden' | 'flipped' | 'matched'
```

**Regras do jogo:**
- Embaralhamento: Fisher-Yates no `StartGame`
- Bloqueio: enquanto 2 cartas estão viradas e não combinam, novas viradas são ignoradas
- Delay de 1000ms antes de virar de volta as cartas que não combinam
- Sem limite de tentativas (só tempo)

**Animação:**
- CSS transform: `rotateY(180deg)` com `perspective` no container
- `backface-visibility: hidden` em frente e verso
- Transição: 400ms ease-in-out

**Fora de escopo:**
- Ranking/leaderboard (Sprint 2)
- Som/áudio (Sprint 2)
- RFID/QR input (Hub, Fase 2)

---

### MEM-06 — Tela de Resultado (2pts) ✅ Ready

**Layout:**
- Vitória: ícone de troféu, cor `primaryColor`, "Parabéns! Você encontrou todos os pares em Xs!"
- Derrota: ícone neutro, "Você encontrou X de Y pares. Tente de novo!"
- Score salvo no lead (MEM-04) antes de exibir a tela

**Auto-reset:** após `config.game.autoResetSeconds` (padrão 30s) sem toque, volta para Splash automaticamente. Contador visível.

---

### MEM-07 — Tela Splash (1pt) ✅ Ready

**Trigger do Admin:**
- 5 toques no logo em menos de 3 segundos
- Sem feedback visual (gesto discreto)
- Após o gesto, modal de PIN aparece sobre a Splash

---

### MEM-08 — Painel Admin (3pts) ✅ Ready

**Acesso:**
- PIN digitado via teclado numérico customizado na tela (não depende do teclado do browser)
- 3 tentativas erradas → bloqueia por 60s

**Export CSV:**
- Cabeçalho dinâmico baseado nos campos do `leadForm.fields`
- Colunas fixas ao final: `played_at`, `score`, `time_taken`, `synced_from`
- Gerado no browser via `Blob` + `URL.createObjectURL` (sem servidor)
- Nome do arquivo: `leads-{event.id}-{YYYY-MM-DD}.csv`

---

### MEM-09 — QA (2pts) ✅ Ready

**Ambiente de teste:**
- Chrome no modo quiosque: `google-chrome --kiosk --disable-pinch --overscroll-history-navigation=0 http://localhost:5173`
- Tablet: acesso via IP local da rede

**Checklist de regressão:**
- [ ] Fluxo completo: Splash → Lead Form → Jogo → Resultado → Splash
- [ ] Offline completo desde o início (sem sync inicial)
- [ ] Offline após sync parcial
- [ ] Config com 4 pares (mínimo)
- [ ] Config com 12 pares (máximo)
- [ ] Campo obrigatório vazio no Lead Form
- [ ] PIN errado 3x no Admin
- [ ] Export CSV com leads offline + online misturados

---

## Decisões Técnicas Registradas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Supabase para persistência standalone | Zero API layer, setup em minutos, PostgreSQL compatível com Hub/Neon futuro |
| 2 | IndexedDB como buffer offline obrigatório | Eventos têm WiFi instável; nenhum lead pode ser perdido |
| 3 | vite-plugin-federation desde o início | Custo zero agora, elimina reescrita na integração com Hub |
| 4 | Config via JSON estático | Sem backend próprio no standalone; operador edita o arquivo antes do evento |
| 5 | PIN numérico customizado no Admin | Teclado virtual do browser não é confiável em modo quiosque |
| 6 | Export CSV no browser (Blob) | Sem servidor, funciona offline se IndexedDB tiver os dados |
| 7 | `src/game/` isolado de `src/standalone/` | Garante que o plugin não acumule dependências do wrapper standalone |

---

## Prioridade de Desenvolvimento

Dado o prazo de 5 dias e as dependências entre issues:

| Dia | Issues | Obs |
|---|---|---|
| Dia 1 (Seg) | MEM-01 + MEM-02 | Setup + Config (desbloqueiam tudo) |
| Dia 2 (Ter) | MEM-03 + MEM-04 | Lead Form + Persistência (podem ser paralelos após MEM-02) |
| Dia 3 (Qua) | MEM-05 | Jogo (maior complexidade, precisa de tempo) |
| Dia 4 (Qui) | MEM-06 + MEM-07 + MEM-08 | Resultado + Splash + Admin |
| Dia 5 (Sex) | MEM-09 | QA + ajustes finais |

## Definition of Ready — confirmado para todas as issues ✅

- [x] User Story escrita
- [x] Critérios de aceite claros e testáveis
- [x] Estimativa em story points
- [x] Decisões técnicas registradas
- [x] Sem dependências bloqueantes não resolvidas
