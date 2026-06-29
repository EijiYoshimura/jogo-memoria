# Spec: HUB-76 — "Show before": preview das cartas viradas antes de iniciar (configurável)

## Contexto

O app de totem do Jogo da Memória (BB Seguros) capta leads através de uma ativação rápida, com o fluxo `splash → form (consentimento LGPD) → game → result`. Hoje, ao iniciar a partida, todas as cartas já entram no **verso** e o participante começa a jogar imediatamente, sem qualquer fase de memorização.

Em ativações presenciais, uma fase curta de memorização (mostrar as cartas com a face para cima por alguns segundos antes de começar) aumenta o **engajamento** e dá ao participante uma chance justa de memorizar as posições, tornando a partida mais divertida e fluida — especialmente para públicos diversos que passam rápido pelo totem. Isso reduz a frustração de "começar no escuro" e melhora a experiência percebida da marca.

Esta feature adiciona, de forma **opcional e configurável pelo operador**, uma fase de preview ("show before"): ao iniciar a partida, todas as cartas aparecem com a **face para cima** por N segundos (default 2), com **toque bloqueado**; passado o tempo, todas viram para o **verso** e o jogo é liberado. A funcionalidade é **retrocompatível**: se o bloco de configuração estiver ausente, o comportamento atual é preservado (sem preview).

## User Story

**Como** participante da ativação no totem,
**quero** que, ao iniciar a partida, as cartas apareçam viradas para cima por alguns segundos antes de começarem a contar,
**para que** eu possa memorizar as posições e ter uma experiência de jogo mais justa e divertida.

**Como** operador do totem,
**quero** poder ativar/desativar o preview e definir por quantos segundos ele dura via configuração,
**para que** eu adapte a dificuldade e o ritmo da ativação ao público e ao evento, sem precisar alterar código.

## Critérios de Aceite

- [ ] **CA1 — Preview ativo exibe faces e bloqueia toque**
  - **Dado** que `config.game.showBefore.enabled = true` e `seconds = 2`
  - **Quando** a partida inicia (entrada na tela de game)
  - **Então** todas as cartas aparecem com a **face para cima** simultaneamente
  - **E** qualquer toque/clique nas cartas é **ignorado** (interação bloqueada) durante toda a duração do preview.

- [ ] **CA2 — Fim do preview vira para o verso e libera o jogo**
  - **Dado** que o preview está em andamento com `seconds = 2`
  - **Quando** transcorrem os 2 segundos
  - **Então** todas as cartas viram para o **verso** simultaneamente
  - **E** o jogo passa para o estado **jogável** (status `playing`), permitindo a primeira interação do participante.

- [ ] **CA3 — Preview inativo mantém comportamento atual**
  - **Dado** que `config.game.showBefore.enabled = false`
  - **Quando** a partida inicia
  - **Então** todas as cartas iniciam direto no **verso** (comportamento atual)
  - **E** o jogo está imediatamente **jogável**, sem qualquer fase de preview nem atraso.

- [ ] **CA4 — Duração configurável é respeitada**
  - **Dado** que `config.game.showBefore.enabled = true` e `seconds = 4`
  - **Quando** a partida inicia
  - **Então** as cartas permanecem com a face para cima por **4 segundos** antes de virar para o verso
  - **E** o jogo só libera após esse intervalo (o tempo de exibição respeita o valor configurado).

- [ ] **CA5 — Fallback seguro quando o bloco está ausente**
  - **Dado** que `config.game.showBefore` **não existe** no `config.json`
  - **Quando** o app carrega a configuração e a partida inicia
  - **Então** o app aplica o fallback seguro (`enabled: false`, `seconds: 2`) **sem lançar erro**
  - **E** a partida inicia direto no verso, como no comportamento atual.

- [ ] **CA6 — `public/config.json` atualizado com o default de produção**
  - **Dado** o arquivo `public/config.json`
  - **Quando** a feature é entregue
  - **Então** ele contém o bloco `game.showBefore` com exatamente **`{ "enabled": true, "seconds": 2 }`** (decisão do PM — preview ligado por padrão em produção, 2s).
  - **E** esse valor de produção **não se confunde** com o *fallback do tipo* (`GameConfig.game.showBefore` ausente ⇒ `enabled: false`, `seconds: 2`, validado pelo CA5): o `config.json` real entrega o preview **ligado**; o fallback existe apenas como rede de segurança para configs sem o bloco.

- [ ] **CA7 — Zero regressão**
  - **Dado** o app com a feature integrada
  - **Quando** uma partida completa é jogada (com ou sem preview)
  - **Então** o flip, o match, a detecção de vitória e a contagem de pares funcionam como antes
  - **E** o timer (HUB-63) inicia/conta corretamente após a liberação do jogo
  - **E** o layout do board (HUB-63/64) permanece fiel ao mockup
  - **E** o fluxo completo `splash → form → game → result` permanece intacto.

## Design (link Figma/Excalidraw)

Não há novo asset visual a ser produzido: as cartas **já possuem face e verso** (entregues em HUB-63), e o preview reutiliza esses estados visuais existentes.

Pontos de UX a validar com o Product Designer (detalhe visual, não bloqueante para a parte funcional):
- Durante o preview deve haver uma **indicação clara** de que o jogo está em fase de memorização/aguardo (ex.: rótulo "Memorize!" / "Aguarde..." ou tratamento visual sutil), comunicando que o toque ainda não está liberado.
- A indicação **não pode** sugerir que as cartas são clicáveis durante o preview — o toque permanece bloqueado.
- A transição de faces para versos ao fim do preview deve ser perceptível e clara, sinalizando que o jogo começou.

### Diretriz de UX — Product Designer (VALIDADO em 2026-06-29)

Diretriz objetiva e implementável pelo dev-front **sem novos assets**, reutilizando os estados visuais de carta (HUB-63), o layout (HUB-63/64) e a paleta BB.

#### 1. Indicação de preview / "aguarde"

- **Onde:** na **faixa inferior reservada** abaixo do board (o espaçador `grow-[8]` em `src/game/index.tsx`, hoje vazio e destinado ao futuro botão COMEÇAR). Esse é o local correto — **não sobrepor nem poluir o board** e **não competir com o logo** no header. A indicação ocupa esse respiro apenas enquanto `session.status === 'preview'` e some ao entrar em `'playing'`.
- **Conteúdo (dois elementos empilhados e centralizados):**
  1. **Rótulo:** texto fixo **"Memorize as cartas"**. Curto, imperativo, comunica a tarefa. Sem reticências animadas.
  2. **Contador regressivo:** número inteiro de segundos restantes do preview (ex.: `2` → `1`), atualizado **uma vez por segundo**. Comunica que é uma espera curta e definida. Deriva de `showBefore.seconds` (a mesma fonte do `setTimeout` da apresentação) — **não** reaproveitar o `timeRemaining` do jogo.
- **Tipografia e cor (paleta BB):**
  - Rótulo: `font-bb-titulos`, peso semibold/bold, tamanho ~`text-3xl`/`text-4xl` (legível à distância de totem), cor **branca** (`#FFFFFF`).
  - Contador: `font-bb-titulos`, `tabular-nums` (evita "pulo" de largura), tamanho maior (~`text-6xl`), cor de destaque **amarelo `#FCFC30`** — cria a hierarquia "leia o número, a espera é curta".
  - Fundo: a própria faixa azul `#0333BD` (sem caixa/badge extra). Contraste branco→azul e amarelo→azul muito acima de WCAG 2.1 AA (ambos > 7:1).
- **Minimalismo (YAGNI):** sem badge, sem overlay escurecendo o board, sem ícone, sem barra de progresso, sem animação elaborada. A própria virada de carta existente (400ms, HUB-63) já comunica início/fim. Fora de escopo qualquer efeito além disso.

#### 2. Acessibilidade (WCAG 2.1 AA — mínimo)

- **Anúncio por leitor de tela:** envolver a indicação numa região com `aria-live="polite"` e `role="status"`. Ao entrar em `'preview'`, anunciar algo como **"Memorize as cartas. Aguarde, o jogo vai começar."**; ao transicionar para `'playing'`, a região passa a anunciar **"O jogo começou. Pode jogar."** (o conteúdo da live region muda com o status, disparando o anúncio). Usar `polite` (não `assertive`) para não atropelar.
- **Estado não-interativo perceptível:** as cartas **não** são focáveis nem clicáveis durante o preview (já garantido pelo guard `status !== 'playing'` e por `Card.tsx` só acionar `onClick` em `state === 'hidden'`). Não adicionar `tabindex`/`role="button"` às cartas em preview. Marcar o container do board com `aria-busy="true"` durante `'preview'` reforça semanticamente "aguarde".
- **`prefers-reduced-motion`:** o contador **troca o número a cada 1s** (sem flicker, sem fade rápido, sem `animate-pulse`). Não introduzir nenhuma animação nova condicionada a movimento; a transição de virada existente é discreta e mantida. Garantir que nada pisque (sem blink/pulse na faixa de preview).

#### 3. Timer do jogo (HUB-63) durante o preview

- **Recomendação: ocultar o Timer durante o preview** — renderizá-lo **apenas** quando `session.status === 'playing'` (e demais estados finais), não em `'preview'`. Dois mostradores numéricos simultâneos (cronômetro do jogo + contador do preview) confundem o participante sobre "o que já está contando". Como o domínio já garante que o Timer só conta em `'playing'`, ocultá-lo no preview é puramente apresentação e **zero risco**. Ao liberar o jogo, o Timer surge no header já com o tempo cheio — sinal claro de "agora sim, começou a contar". (Alternativa aceitável se ocultar for custoso: manter o Timer visível porém com opacidade reduzida/neutra; a recomendação preferida é ocultar.)

#### 4. Coerência com o layout atual

- **Header intacto:** logo permanece como está (`w-3/4`, centralizado). Nada é adicionado ao header durante o preview.
- **Board intacto:** mesma grade e moldura (HUB-63/64); o preview apenas exibe as cartas em `flipped` (face para cima) — sem alterar posição, tamanho ou moldura.
- **Faixa inferior:** a indicação de preview vive no espaço já reservado abaixo do board e o libera assim que o jogo começa, sem reflow perceptível do board (o board permanece ancorado pela razão de espaçadores 3:8 existente).
- **Transição:** `preview → playing` = cartas viram para o verso (400ms existente) + indicação inferior some + Timer aparece no header. Conjunto comunica inequivocamente "pode jogar".

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. **APROVO a arquitetura** abaixo; aguardando validações Designer/PM e aprovação final do PO.

### Decisão de arquitetura (onde mora a fase de preview)

**Escolhida: a fase de preview é um estado do domínio.** Adiciona-se o status `'preview'` a `GameStatus`; o `startGame` passa a aceitar um flag opcional `showBefore` e, quando ligado, retorna **todas as cartas em `'flipped'`** (face para cima) com `status: 'preview'`. Uma transição **pura** (`beginPlay`) vira todas de `'flipped'` para `'hidden'` e seta `status: 'playing'`. A **camera de apresentação** (`src/game/index.tsx`) é responsável apenas pelo **efeito de tempo** (`setTimeout(seconds * 1000)`) que dispara `beginPlay`, e pela limpeza desse timer.

**Por que no domínio (e não só na apresentação):**
- **Clean Architecture / fonte única da verdade:** o estado das cartas e do jogo já vive no domínio (`GameSession`/`Card`). Modelar o preview como mais um `GameStatus` mantém a máquina de estados coesa e evita um "estado paralelo" na apresentação que precisaria espelhar/transformar `card.state` por fora — duplicação e risco de divergência.
- **Reuso dos guards existentes (zero regressão barata):** `flipCard` já ignora quando `status !== 'playing'`; `handleCardClick` (apresentação) já barra `status !== 'playing'`; o `Timer` só conta quando `status === 'playing'`. Com `'preview'` sendo apenas mais um status `!== 'playing'`, **o bloqueio de toque e a não-contagem do timer durante o preview saem de graça**, sem novos ramos de lógica.
- **Reuso do visual existente:** em `Card.tsx`, `isVisible = card.state !== 'hidden'` — ou seja, `'flipped'` **já** renderiza a face para cima com a animação de virada (400ms) existente. O preview não exige nenhum novo estado visual nem asset (alinhado ao "Design" da spec).
- **Testabilidade:** `startGame(..., showBefore)` e `beginPlay(session)` são funções **puras** → cobertura unitária determinística no domínio, sem timers nem DOM.

**Alternativa avaliada e rejeitada — gerir só na apresentação:** manter o domínio intacto e simular o preview com um `useState` local (ex.: `isPreviewing`) renderizando as faces por fora. **Rejeitada:** vazaria regra de estado do jogo para a UI, exigiria recalcular/forçar `card.state` na apresentação (duplicando a lógica de virada), e os guards de toque/timer teriam de ser reescritos em torno de um flag ad-hoc em vez do `status` canônico. Mais código, menos testável, maior risco de regressão.

### Contratos / assinaturas (novas e alteradas)

**1. `GameStatus` (`src/game/domain/entities/GameSession.ts`) — adicionar `'preview'`:**
```ts
export type GameStatus = 'idle' | 'preview' | 'playing' | 'won' | 'lost'
```
`GameSession` permanece com a mesma forma (nenhum campo novo). `'preview'` é um estado intermediário antes de `'playing'`.

**2. `startGame` (`src/game/domain/use-cases/StartGame.ts`) — 4º parâmetro opcional, retrocompatível:**
```ts
export function startGame(
  pairs: number,
  cardImages: string[],
  timeLimitSeconds: number,
  showBefore = false, // novo; default false ⇒ comportamento idêntico ao atual
): GameSession
```
- `showBefore === false` (default): cartas em `'hidden'`, `status: 'playing'` — **saída byte-a-byte igual à atual** (as chamadas e testes de 3 argumentos não mudam de comportamento).
- `showBefore === true`: cartas em `'flipped'`, `status: 'preview'`. `timeRemaining` continua `= timeLimitSeconds` (o `Timer` não conta em `'preview'`, então não há vazamento de tempo). O embaralhamento (Fisher-Yates) é idêntico.

> Decisão: o domínio recebe apenas o **booleano** `showBefore`, não os `seconds`. A duração é uma preocupação de **temporização da apresentação** (um `setTimeout`), não do estado do jogo — manter `seconds` fora do domínio respeita a separação de camadas.

**3. `beginPlay` (NOVO — `src/game/domain/use-cases/BeginPlay.ts`) — transição pura:**
```ts
import type { GameSession } from '../entities/GameSession'

/** Encerra o preview: vira todas as cartas para o verso e libera o jogo. No-op
 *  fora de 'preview' (idempotente / seguro contra disparo duplicado do timer). */
export function beginPlay(session: GameSession): GameSession {
  if (session.status !== 'preview') return session
  const hiddenCards = session.cards.map((c) =>
    c.state === 'flipped' ? { ...c, state: 'hidden' as const } : c
  )
  return { ...session, cards: hiddenCards, status: 'playing' }
}
```
Arquivo próprio (espelha `StartGame.ts`/`FlipCard.ts`), responsabilidade única. O guard `status !== 'preview'` torna a função idempotente — protege contra re-disparo (StrictMode/efeito reexecutado).

**4. Config (`src/game/types.ts`) — campo opcional/retrocompatível em `GameConfig.game`:**
```ts
/**
 * Preview "show before" (HUB-76). Opcional e retrocompatível.
 * Ausente ⇒ fallback { enabled: false, seconds: 2 } ⇒ comportamento atual (sem preview).
 * `enabled` liga a fase de memorização; `seconds` é a duração (default 2).
 */
showBefore?: { enabled: boolean; seconds: number }
```

### Camada de apresentação (`src/game/index.tsx`) — mudanças

**a) Resolver default e iniciar a sessão:**
```ts
const showBefore = config.game.showBefore ?? { enabled: false, seconds: 2 }
const [session, setSession] = useState<GameSession>(() =>
  startGame(config.game.pairs, config.game.cardImages, config.game.timeLimitSeconds, showBefore.enabled)
)
```
O **default de fallback é aplicado na apresentação** (não no domínio), pois é onde a config é consumida — `?? { enabled: false, seconds: 2 }` cobre o bloco ausente (CA5) sem lançar erro.

**b) Efeito do preview (timer único + limpeza — DoD "sem vazar timer"):**
```ts
useEffect(() => {
  if (session.status !== 'preview') return
  // Defensivo: seconds inválido (≤0/NaN) cai no default 2; evita preview "infinito" ou negativo.
  const raw = config.game.showBefore?.seconds
  const seconds = Number.isFinite(raw) && (raw as number) > 0 ? (raw as number) : 2
  const id = setTimeout(() => {
    startTimeRef.current = Date.now() // cronômetro começa ao LIBERAR o jogo, não no preview
    setSession((prev) => beginPlay(prev))
  }, seconds * 1000)
  return () => clearTimeout(id) // unmount / troca de status / troca de config ⇒ sem leak
}, [session.status, config.game.showBefore?.seconds])
```

**c) `startTime` deixa de ser fixo no mount — passa a `ref` setado ao começar a jogar**, para que `timeTaken` (passado a `onComplete`) **não inclua os segundos de preview**:
```ts
const startTimeRef = useRef<number>(Date.now()) // correto p/ o caso sem preview (joga já no mount)
// ...usar startTimeRef.current onde hoje se usa startTime (handleCardClick / vitória).
```
No caminho com preview, `startTimeRef.current` é reescrito dentro do efeito (item b) no instante do `beginPlay`. Sem preview, o valor do mount já é o correto.

**d) Bloqueio de toque:** `handleCardClick` já retorna cedo em `isLocked || session.status !== 'playing'` — **cobre `'preview'` sem alteração**. Reforço redundante (defense-in-depth) já existente: `Card.tsx` só chama `onClick` quando `card.state === 'hidden'` (em preview as cartas estão `'flipped'`). Nenhuma mudança necessária para o bloqueio (CA1).

**e) Indicação visual de preview (UX/A11y — coordenar com Designer):** renderizar, quando `session.status === 'preview'`, um rótulo do tipo "Memorize!"/"Aguarde…" numa região `aria-live="polite"` (anuncia a fase e que o toque está bloqueado), sem sugerir que as cartas são clicáveis. Detalhe visual e textual é **decisão do Product Designer** (a spec já marca isso como não-bloqueante para a parte funcional). O `Timer` (quando habilitado) permanece visível porém estático durante o preview — confirmar com o Designer se deve ficar oculto até `'playing'`.

### Modelo de dados / config

- `public/config.json` → adicionar em `game`:
```json
"showBefore": { "enabled": true, "seconds": 2 }
```
- Sem migração de dados (config é estático same-origin). Sem mudança de schema de leads/idb/Supabase. Sem novos endpoints (N/A contratos de API).

### Arquivos a alterar (lista fechada)

| Arquivo | Mudança | Camada |
|---------|---------|--------|
| `src/game/domain/entities/GameSession.ts` | `+ 'preview'` em `GameStatus` | Domain |
| `src/game/domain/use-cases/StartGame.ts` | 4º param `showBefore = false`; estado/status iniciais condicionais | Domain (use-case) |
| `src/game/domain/use-cases/BeginPlay.ts` **(novo)** | `beginPlay(session)` puro | Domain (use-case) |
| `src/game/types.ts` | `showBefore?: { enabled: boolean; seconds: number }` em `game` | Tipos/contrato |
| `src/game/index.tsx` | default fallback, chamada do `startGame`, efeito `setTimeout`→`beginPlay` + cleanup, `startTimeRef`, rótulo de preview | Presentation |
| `public/config.json` | bloco `game.showBefore` | Config |
| `src/game/domain/use-cases/__tests__/StartGame.test.ts` | casos com `showBefore=true` (cartas `flipped`/`preview`) + garantir os casos atuais (3 args) inalterados | Testes |
| `src/game/domain/use-cases/__tests__/BeginPlay.test.ts` **(novo)** | `flipped→hidden`+`playing`; no-op fora de `preview`; idempotência | Testes |
| `src/game/__tests__/` (componente MemoryGame) | com fake timers: preview bloqueia clique; após `seconds`, vira p/ verso e libera; `enabled=false` inicia em `playing`; cleanup do timer no unmount | Testes |

**Intocados (zero regressão):** `FlipCard.ts` (flip/match/vitória), `Card.tsx`/`Board.tsx` (layout HUB-63/64), `Timer.tsx` (HUB-63 — o guard `status==='playing'` já isola o preview), fluxo `splash→form→game→result`, persistência/sync de leads.

### Considerações de performance, segurança e acessibilidade

- **Performance:** desprezível. Um único `setTimeout`; nenhuma rede; sem reembaralhar. O `beginPlay` vira N cartas (≤ 12) num único `setState` → uma reconciliação React + as transições CSS (400ms) já existentes. Sem N+1, sem custo de layout novo.
- **Segurança:** sem nova superfície. `seconds` vem do `config.json` same-origin (confiável); ainda assim a apresentação faz **clamp defensivo** (`>0` e finito, senão default 2) para não permitir preview infinito/negativo por config malformada.
- **Acessibilidade:** durante o preview, além do bloqueio de toque, expor uma **região `aria-live`** anunciando "memorize/aguarde" e a liberação ao iniciar; não tornar as cartas focáveis/clicáveis no preview (já garantido pela lógica). Texto/rótulo final e contraste a validar com o **Product Designer** (não bloqueante para a função). Touch-only (totem): sem dependência de hover.

### Estimativa técnica

- **Story points: 3** (alinhado ao PO). Núcleo puro pequeno (`startGame` flag + `beginPlay`), uma mudança de tipo, um efeito de timer com cleanup na apresentação e atualização de testes. Risco baixo graças ao reuso dos guards de status existentes.
- **Riscos técnicos:** (1) esquecer a limpeza do `setTimeout` → leak/`setState` após unmount — mitigado pelo `clearTimeout` no cleanup; (2) contar o tempo de preview no `timeTaken` — mitigado movendo `startTime` para o início do `'playing'`; (3) StrictMode reexecutar o efeito → `beginPlay` idempotente + clamp. Nenhuma dependência externa bloqueante.

## Fora de Escopo

- Qualquer mudança no schema do jogo **além** do bloco `config.game.showBefore` (`enabled`, `seconds`).
- Animações elaboradas de virada (flip 3D sofisticado, partículas, efeitos sonoros) — reutiliza-se a transição de carta existente.
- Mudanças no fluxo de `form` (consentimento LGPD) ou na tela de `result`.
- Configuração de preview por dificuldade, por tipo de carta ou com tempos variáveis por carta — o preview é global e único por partida.
- Reexibição do preview durante a partida (ex.: "dica" no meio do jogo).

## Definition of Done

- [ ] Critérios de aceite (CA1–CA7) validados pelo QA contra a spec
- [ ] Spec Técnica preenchida e aprovada pelo Tech Lead
- [ ] Code review aprovado pelo Tech Lead (spec, Clean Architecture, Clean Code, ausência de código morto)
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (checks existentes continuam passando + novos passam), com evidência no PR
- [ ] `public/config.json` atualizado com `game.showBefore`; tipo `GameConfig.game` (`src/game/types.ts`) com campo opcional/retrocompatível e fallback seguro
- [ ] Sem regressão em flip/match/vitória/contagem de pares, timer (HUB-63), layout do board (HUB-63/64) e fluxo completo
- [ ] Validação visual/UX do Product Designer (indicação de preview)
- [ ] Validação do stakeholder
- [ ] Issue HUB-76 atualizada no Linear; PR referenciando a issue
- [ ] Gate do PO: critérios de aceite cumpridos → aprovação do PR
