# Spec: HUB-75 — PWA + modo kiosk (ativação em tela cheia para tablet touch no totem)

## Contexto

A ativação (app standalone do Jogo da Memória) precisa rodar em um **tablet touch (retrato)**
num totem de evento, em **tela cheia / modo kiosk**, com operação contínua e resiliente a
quedas de rede. Hoje o app **não** é instalável: não há manifest, ícones nem service worker.
A persistência offline de leads já existe (idb `leadsDb`/`leadsSync` + sync com Supabase), e o
deploy é feito via Cloudflare. Falta transformá-lo em **PWA instalável** com app-shell offline
e "endurecer" a experiência para o totem (sem barras do browser, sem zoom/scroll/menus
acidentais, tela sempre ligada), além de documentar como travar o tablet em kiosk.

Esta entrega adiciona a camada PWA/kiosk **sem alterar a lógica de jogo nem as telas** já
entregues, e **sem regredir** a persistência/sync de leads existente.

## User Story

**Como** integrante da equipe de campo que opera o totem num evento,
**quero** instalar o app no tablet e travá-lo em tela cheia/kiosk, com a tela sempre ligada e à prova de toques acidentais,
**para que** o totem funcione o dia todo sem intervenção, mesmo com a internet instável, e o participante não consiga sair do app.

**E como** participante que se aproxima do totem,
**quero** usar o jogo em tela cheia, em retrato, sem barras de navegador nem menus que atrapalhem,
**para que** a experiência seja imersiva e simples, como a de um aplicativo dedicado.

## Critérios de Aceite

**Cenário 1: App instalável como PWA**
- [ ] **Dado** o app servido em produção (HTTPS)
- **Quando** o tablet acessa a URL num browser compatível
- **Então** o app é instalável (manifest válido com `name`/`short_name`, ícones 192/512 + maskable, `start_url`, `scope`)
- **E** uma auditoria Lighthouse marca o app como "installable" (categoria PWA)

**Cenário 2: Abre em tela cheia e retrato, sem chrome do browser**
- [ ] **Dado** o app instalado como PWA no tablet
- **Quando** a equipe abre o app a partir do ícone instalado
- **Então** ele abre em tela cheia (`display: fullscreen`, com fallback `standalone`), em orientação retrato
- **E** não exibe barra de endereço nem controles de navegação do browser

**Cenário 3: Funciona offline (app-shell em cache)**
- [ ] **Dado** que o app foi aberto ao menos uma vez com rede (app-shell precacheado)
- **Quando** o tablet perde a conexão e o app é recarregado/reaberto
- **Então** o app carrega normalmente a partir do cache (HTML, JS/CSS, fontes BB, imagens), sem tela de erro de rede
- **E** o fluxo splash → form → game → result permanece utilizável offline

**Cenário 4: Leads persistem offline e sincronizam ao reconectar (sem regressão)**
- [ ] **Dado** o app offline com um participante completando o formulário e o jogo
- **Quando** o lead é submetido sem rede
- **Então** o lead é persistido localmente (idb), como hoje, sem perda
- **E quando** a conexão retorna
- **Então** os leads pendentes são sincronizados com o backend (Supabase), exatamente como antes desta entrega — sem regressão na persistência/sync

**Cenário 5: Tela permanece ligada (wake lock) com fallback**
- [ ] **Dado** o app em operação no tablet
- **Quando** o app está em primeiro plano e ninguém interage por um tempo
- **Então** a tela permanece ligada via Screen Wake Lock (re-adquirido após `visibilitychange`)
- **E** em browsers/tablets sem suporte a Wake Lock, há um fallback documentado (ex.: ajuste de auto-lock no setup do kiosk) para que a tela não apague

**Cenário 6: Sem zoom**
- [ ] **Dado** o app aberto
- **Quando** o participante faz gesto de pinça ou duplo-toque
- **Então** o conteúdo não dá zoom (escala fixa)

**Cenário 7: Sem seleção de texto e sem menu de contexto acidentais**
- [ ] **Dado** o app aberto
- **Quando** o participante faz long-press ou tenta selecionar/arrastar textos e imagens
- **Então** não aparece menu de contexto, não há seleção de texto nem arraste de imagem
- **E** os campos de input continuam funcionando normalmente (a restrição não afeta a digitação)

**Cenário 8: Sem pull-to-refresh / overscroll**
- [ ] **Dado** o app aberto
- **Quando** o participante arrasta a tela para baixo no topo (ou além dos limites)
- **Então** não ocorre pull-to-refresh nem efeito de overscroll (`overscroll-behavior: none`)

**Cenário 9: Build e deploy Cloudflare seguem funcionando**
- [ ] **Dado** o pipeline atual de build/deploy
- **Quando** o app é construído (`npm run build`) e publicado no Cloudflare
- **Então** o build conclui sem erros, incluindo a geração do service worker e do manifest
- **E** o app em produção continua carregando (incluindo a integração de module federation / `remoteEntry.js`), sem quebra introduzida pela camada PWA

**Cenário 10: Documentação de setup do kiosk no repositório**
- [ ] **Dado** o repositório
- **Quando** um operador precisa preparar um tablet
- **Então** existe um documento em `/docs` com o passo a passo para instalar a PWA e travar em kiosk no **Android** (tela fixada / launcher kiosk) e no **iPad** (Acesso Guiado)
- **E** o documento inclui recomendações de operação (desativar notificações, auto-lock, atualização automática; ajustar brilho)

**Cenário 11: Orientação travada em retrato**
- [ ] **Dado** o app instalado e aberto no tablet
- **Quando** o tablet é girado para paisagem
- **Então** o app permanece em retrato (via manifest `orientation: portrait`; Screen Orientation API onde suportado), sem reflow para paisagem

## Design

Branding de partida: `public/images/logo_bb.png` (BB Seguros, arte branca) e
`public/images/logo_jogo_memoria.png`. Paleta do app: fundo `#0333BD`, accent `#FCFC30`, branco.

> Esta entrega não cria telas novas — apenas o **conjunto de ícones do PWA** e a configuração de
> cores/tema do manifest, mais ajustes finos de tela cheia. As telas (board HUB-64, form HUB-65,
> splash HUB-70/72, result HUB-73) já são retrato/tela cheia e permanecem intactas.

### 1. Ícones do PWA

**Conjunto necessário (gerar todos a partir de um master quadrado):**

| Arquivo | Tamanho | `purpose` | Uso |
|---------|---------|-----------|-----|
| `icon-192.png` | 192×192 | `any` | Ícone padrão (home screen, listas) |
| `icon-512.png` | 512×512 | `any` | Ícone grande, base da splash gerada pelo SO |
| `icon-512-maskable.png` | 512×512 | `maskable` | Adaptive icon (Android recorta em círculo/squircle) |
| `apple-touch-icon.png` | 180×180 | — (meta tag) | iOS/iPadOS home screen (sem maskable; iOS aplica o próprio raio) |
| `favicon.ico` / `favicon.svg` | 32/48 + SVG | — | Aba do browser (instalação/preview) |

**Master de origem:** gerar a partir de um SVG/PNG quadrado de alta resolução (≥ 1024×1024)
montado com o símbolo da marca BB (extraído de `logo_bb.png`) **centralizado** sobre fundo sólido
`#0333BD`. Preferir o **símbolo/monograma BB** (não o lockup horizontal "BB Seguros" inteiro), pois
lockups largos ficam minúsculos quando reduzidos a 192px e quebram dentro da safe-area do maskable.

**Layout do ícone:**
- Fundo: sólido `#0333BD` (sem gradiente) — bordas sangram até o limite (full-bleed), exigência do maskable.
- Marca: símbolo BB em branco `#FFFFFF`, centralizado, com contraste amplo sobre o azul.
- Variante `any` (192/512): a marca pode ocupar uma área maior (~70–76% do canvas), pois não há recorte.
- Variante **maskable** (512): a marca deve caber na **safe-area = 80% central** (círculo de diâmetro
  ≈ 409px / raio ~205px a partir do centro). Regra prática: **padding de ~20% em cada lado** →
  a marca vive num quadrado central de ~60% (≈ 307×307px dentro dos 512), garantindo que nenhum
  recorte (círculo, squircle, rounded-square) corte o símbolo. O fundo `#0333BD` preenche os 100%.
- `apple-touch-icon` (180): mesma arte da variante `any`, **sem** cantos arredondados próprios
  (iOS aplica a máscara) e **sem** transparência (fundo `#0333BD` opaco) — evita o "fundo preto" do iOS.

**Resumo do padding seguro:** `any` → marca ~72% (margem ~14%); `maskable` → marca ≤ 60% central
(margem ~20%), respeitando a zona segura de 80% dos maskable icons.

### 2. Cores do tema / manifest

- `background_color`: `#0333BD` — cor da splash nativa enquanto o app carrega.
- `theme_color`: `#0333BD` — barra de status/UI do SO em standalone; também na meta tag
  `<meta name="theme-color" content="#0333BD">` do `index.html`.
- Consistência: a mesma cor do fundo de todas as telas (board/form/splash/result), então **não há
  "flash" de cor divergente** entre a splash do SO e a primeira tela do app (a splash HUB-70/72
  também é azul `#0333BD`) — transição visualmente contínua.

**Splash screen gerada pelo SO (resultado esperado):**
- Android (Chrome): tela `#0333BD` com o `icon-512` centralizado e o `name`/`short_name` abaixo,
  em branco (gerada automaticamente a partir de `background_color` + ícone). Resultado: azul cheio +
  símbolo BB branco — coerente com a marca.
- iOS/iPadOS: usa o `apple-touch-icon` + `background_color`; como não há flash branco (ícone opaco
  azul), a entrada é suave. (Splash screens estáticas customizadas do iOS são opcionais e ficam a
  cargo da Spec Técnica; o mínimo é o fundo `#0333BD`.)

### 3. UX tela cheia / retrato

- **Confirmação:** todas as telas já são desenhadas para **retrato e tela cheia** —
  board (HUB-64), formulário (HUB-65), splash (HUB-70/72), result (HUB-73). Esta entrega
  **não** redesenha nenhuma tela; apenas remove o chrome do browser (modo standalone/fullscreen).
- **Ganho de área:** sem a barra de endereço, o conteúdo ganha a altura antes ocupada pelo chrome.
  Como os layouts usam `h-full`/`flex` proporcionais (não alturas fixas dependentes do viewport do
  browser), eles se expandem corretamente — sem ajuste de layout necessário.
- **Safe areas / notch (tablets):**
  - Adicionar `viewport-fit=cover` na meta viewport para o conteúdo ocupar 100% (incluindo áreas
    de notch/cantos arredondados em tablets que os tenham).
  - Onde houver elementos **colados às bordas** (ex.: moldura branca da tela no form HUB-65, rodapé
    do teclado virtual HUB-59), aplicar `env(safe-area-inset-*)` via padding para que nada fique sob
    um notch/inset. Tablets comuns de totem (retrato, sem notch) não exigem ajuste, mas o
    `env(safe-area-inset-*)` é um **seguro barato** e deve ser previsto onde há conteúdo na borda.
  - Recomendado padronizar via utilitário (ex.: `p-[env(safe-area-inset-bottom)]` no container do
    teclado) — decisão de implementação fica para a Spec Técnica/Dev Front.
- **Sem scroll/zoom acidental (visual):** com os layouts proporcionais e `overflow` controlado, o
  conteúdo não deve gerar barras de rolagem; o hardening (sem zoom/overscroll, Cenários 6–8) é
  técnico (Spec Técnica), mas o efeito visual esperado é uma tela "fixa" e estável, sem rubber-band.

### 4. Acessibilidade / toque (modo kiosk)

- **Sem hover:** o totem é touch-only — nenhum estado depende exclusivamente de `:hover`. Todos os
  feedbacks já usam `:active`/`active:scale-95` (teclado HUB-59) e estados marcados (checkbox HUB-67).
  Reforço: garantir que qualquer affordance nova de PWA (ex.: nenhuma nesta entrega) não dependa de hover.
- **Alvos de toque:** já validados ≥44×44px nas issues anteriores (campos, teclado, checkbox, botões).
  Esta entrega não adiciona controles tocáveis novos na UI do participante — nada a revalidar.
- **Foco visível:** mantido pelos componentes existentes; o modo kiosk não remove outline de foco
  (acessibilidade preservada mesmo sem teclado físico, para operadores).
- **Contraste:** ícone (branco sobre `#0333BD` ≈ 8,6:1) e splash mantêm o contraste da marca já
  verificado nas telas. Sem texto novo a auditar.
- **Operação contínua:** a tela permanece ligada (Wake Lock, Cenário 5) — do ponto de vista de UX,
  evita que o participante encontre a tela apagada; sem impacto visual além de manter a tela ativa.

### Assets a produzir (entregáveis de design)

- `icon-192.png`, `icon-512.png` (`any`), `icon-512-maskable.png` (safe-area 80%),
  `apple-touch-icon.png` (180, opaco), favicon — todos derivados do master quadrado azul com o
  símbolo BB branco. Local sugerido: `public/icons/` (caminho final definido na Spec Técnica/manifest).
- Nenhuma tela nova; nenhum redesenho das telas existentes.

> Os percentuais de safe-area (80% maskable / ~60% da marca) seguem a especificação de maskable
> icons; ajustar finamente na geração validando com uma prévia de máscara (círculo + squircle) antes
> do commit dos assets.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29, **após spike técnico** no worktree isolado
> `tech-lead/HUB-75-spike-pwa` (descartável). **Resultado do spike: a integração FECHA.** Camada
> PWA/kiosk na borda da apresentação (`vite.config.ts`, `index.html`, novo hook de kiosk, manifest/ícones).
> Domínio do jogo, teclado e persistência **não mudam**.

### Resultado do spike (evidência)

`vite-plugin-pwa@1.3.0` (Workbox `generateSW`) **integra sem conflito** com `@cloudflare/vite-plugin` +
`@originjs/vite-plugin-federation`. Build no worktree (`tsc -b` ✅ + `vite build .`):
- `dist/manifest.webmanifest` ✅, `dist/sw.js` + `dist/workbox-*.js` ✅, `dist/registerSW.js` ✅;
- `index.html` recebeu **auto-injeção** de `<link rel="manifest">` + `registerSW.js`;
- **Precache de 31 entradas (~2,9 MiB)** cobrindo app-shell, **13 `.png` e 3 `.woff2` (fontes BB)**;
- **Coexiste** com `dist/assets/remoteEntry.js` (federation) e `dist/wrangler.json` (cloudflare) — build
  conclui em ~1s, 100 módulos, sem erro;
- `remoteEntry.js` entra no precache **com revision** (cache-bust automático) e o
  `navigateFallbackDenylist: [/^\/remoteEntry\.js$/]` o exclui do fallback SPA.

> **Isolamento:** o spike instalou a dep no `node_modules` próprio do worktree (o symlink foi substituído
> por install real); `package.json` e `node_modules` do **master permaneceram intactos** (verificado).

### Arquitetura envolvida

| Arquivo | Mudança | Camada |
|---------|---------|--------|
| `vite.config.ts` | Adicionar `VitePWA({...})` (manifest + workbox). **+1 devDependency:** `vite-plugin-pwa`. | Build |
| `index.html` | Auto-injetado pelo plugin; **adicionar manualmente** metatags iOS (`apple-mobile-web-app-capable`, `-status-bar-style`, `apple-touch-icon`) e `theme-color`, `viewport` com `user-scalable=no, viewport-fit=cover`. | Presentation |
| `public/manifest`/ícones | Ícones 192/512 + **maskable** (do branding BB — Designer); `theme/background #0333BD`. | Assets |
| `src/standalone/hooks/useKioskMode.ts` (**novo**) | `useWakeLock` (re-adquire em `visibilitychange`) + Fullscreen no 1º toque + `screen.orientation.lock('portrait')` (best-effort). Sem lógica de negócio. | Presentation |
| `src/standalone/App.tsx` (ou `main.tsx`) | Montar `useKioskMode()` no topo. | Presentation |
| `src/index.css` | `overscroll-behavior:none`, `touch-action: manipulation`, `user-select:none`, `-webkit-user-select:none` no shell; `img { -webkit-user-drag:none }`. | Presentation |
| `docs/kiosk-setup.md` (**novo**) | Passo a passo Android (tela fixada/launcher) + iPad (Acesso Guiado) + operação. | Doc |

**Intocados (regressão zero):** `lead-capture/keyboard/*`, `game/*`, `hooks/useLeadPersistence.ts`,
`lib/leadsDb.ts`/`leadsSync.ts`/`supabaseClient.ts`. **Nada de SW interfere no idb/Supabase** — o Workbox
intercepta `fetch` de assets/navegação; o idb não usa `fetch`, e as chamadas ao Supabase **não devem ser
precacheadas** (ver runtime caching).

### PWA / manifest

- `name: "Jogo da Memória — BB Seguros"`, `short_name`, `start_url:"/"`, `scope:"/"`,
  `display:"fullscreen"` (**fallback `standalone`** via `display_override:["fullscreen","standalone"]`),
  `orientation:"portrait"`, `theme_color`/`background_color:"#0333BD"`, `lang:"pt-BR"` (o default do plugin é
  `en` — **definir explicitamente**).
- **Ícones:** `192x192`, `512x512` e um `512` **maskable** (`purpose:"maskable"`) com safe-area — gerados do
  branding pelo Designer (os `card_back.png` do spike são placeholders).
- `index.html`: `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `apple-mobile-web-app-status-bar-style`, `theme-color`, e `viewport` com `maximum-scale=1, user-scalable=no`.

### Service worker / offline (Workbox via `vite-plugin-pwa`)

- `registerType: 'autoUpdate'` (totem sem operador para clicar "atualizar"); estratégia **`generateSW`**.
- **Precache (app-shell):** `workbox.globPatterns: ['**/*.{js,css,html,woff2,png,webmanifest}']` — validado no
  spike (cobre JS/CSS, fontes BB `.woff2`, imagens `.png`). `remoteEntry.js` é precacheado com revision.
- **`navigateFallback: '/index.html'`** (SPA) **+ `navigateFallbackDenylist: [/^\/remoteEntry\.js$/, /\/api\//]`**
  para não servir o HTML no lugar do remoteEntry nem de chamadas de API.
- **Runtime caching:**
  - Fontes/imagens já entram no **precache** (poucos arquivos, conteúdo estável) → simples e offline-first.
  - **Supabase (sync de leads):** `urlPattern` do host Supabase → **`NetworkOnly`** (ou denylist) — **nunca**
    cachear POST/escrita de leads; preserva o `leadsSync` (que decide online/offline por conta própria).
- **Não quebra o idb:** `leadsDb`/`leadsSync` operam fora do SW; o SW não intercepta IndexedDB. Cenário 4
  (offline persiste + sincroniza ao reconectar) é preservado por construção — validar em teste de regressão.

### Kiosk hardening (web)

- **`useWakeLock`** (dentro de `useKioskMode`): `navigator.wakeLock.request('screen')`; **re-adquirir** em
  `document.visibilitychange` quando `visibilityState==='visible'` (o lock cai ao sair/voltar). `try/catch`
  **específico** para ausência de suporte/abort → fallback documentado (auto-lock do tablet no setup), **sem
  engolir erro silenciosamente** (logar o motivo). Liberar no unmount.
- **Fullscreen API no 1º toque:** `element.requestFullscreen()` precisa de gesto do usuário → disparar no
  primeiro `pointerdown`/toque da splash (não no mount). Best-effort (iOS Safari não suporta Fullscreen em
  PWA standalone — coberto pelo `display:fullscreen`/`standalone` do manifest + Acesso Guiado).
- **Orientação retrato:** `screen.orientation.lock('portrait')` (best-effort, só em fullscreen/Android) +
  `manifest.orientation` como garantia principal.
- **CSS:** `overscroll-behavior:none` (sem pull-to-refresh — Cenário 8), `user-select:none` +
  `-webkit-touch-callout:none` (sem menu de contexto/seleção — Cenário 7), `img{-webkit-user-drag:none}`,
  `touch-action: manipulation` + `viewport user-scalable=no` (sem zoom — Cenário 6). **Inputs preservam
  digitação** (o `user-select:none` no shell não impede o caret/edição da HUB-69).
- `contextmenu` → `preventDefault` global (defensivo, complementa o CSS).

### Build / deploy

- `npm run build` (= `tsc -b && vite build`): **sem mudança de comando**; passa a gerar `sw.js` +
  `manifest.webmanifest` no `dist/` (validado no spike). `+1 devDependency` (`vite-plugin-pwa`) no
  `package.json` do **master** (única mudança de dependência da issue).
- `wrangler deploy`: o `@cloudflare/vite-plugin` segue gerando `wrangler.json`/assets; SW e manifest são
  servidos como estáticos. **Cuidado de deploy:** o `sw.js` deve ser servido com `Cache-Control: no-cache`
  (padrão do plugin) para o `autoUpdate` funcionar — validar no Cloudflare.
- Cenário 9 (federation intacto) **comprovado no spike**: `remoteEntry.js` coexiste no `dist/`.

### Contratos de API / Modelo de dados

N/A — sem novos endpoints; sem mudança de schema. `SaveLeadParams`/idb/Supabase **inalterados**. O manifest
é um novo artefato estático (não é "API").

### Plano de testes (vitest + manual)

**vitest (cobertura honesta):**
1. **`useKioskMode`/`useWakeLock`** com mocks de `navigator.wakeLock`: solicita lock ao montar; re-adquire ao
   disparar `visibilitychange→visible`; libera no unmount; **fallback sem suporte** (navigator sem `wakeLock`)
   não lança. (jsdom: mockar `wakeLock`, `visibilityState`, `requestFullscreen`.)
2. **Hardening:** `contextmenu` preventDefault chamado; Fullscreen/orientation são best-effort → asserir que a
   chamada é tentada com mock, sem depender do efeito real.
3. **Regressão:** suíte atual (teclado, caret, consentimento, layout, persistência) **verde**.

> **Validação manual em tablet real** (parte da DoD; jsdom não cobre): Lighthouse "installable", abertura
> fullscreen/retrato sem chrome, **offline real** (recarregar sem rede), wake lock efetivo, ausência de
> zoom/overscroll no touch.

### Decisão / estimativa

- **Viabilidade: APROVADA** — o risco principal (PWA × federation × cloudflare) foi **validado no spike**
  (build verde, SW+manifest gerados, remoteEntry coexiste).
- **Estimativa: 8 pontos** realista, mas **recomendo quebrar em 3 sub-issues** (review incremental, menos risco):
  - **HUB-75a — PWA instalável (3):** `vite-plugin-pwa` no build, manifest + ícones (Designer) + metatags no
    `index.html`; Lighthouse installable. (Cenários 1/2/9/11)
  - **HUB-75b — SW offline + runtime caching (3):** precache app-shell, runtime caching fontes/imagens,
    Supabase `NetworkOnly`, `navigateFallback`+denylist; regressão idb/sync. (Cenários 3/4)
  - **HUB-75c — Kiosk hardening + doc (2):** `useKioskMode` (wake lock/fullscreen/orientation) + CSS
    anti-zoom/seleção/overscroll + `docs/kiosk-setup.md`. (Cenários 5/6/7/8/10)
- **Riscos técnicos:** (1) iOS Safari não suporta Fullscreen/Wake Lock plenos → mitigado por
  `display:standalone` + Acesso Guiado (doc); (2) SW cachear remoteEntry/Supabase indevidamente → mitigado por
  denylist + `NetworkOnly`; (3) ícones maskable dependem do Designer (bloqueante do Cenário 1).

## Fora de Escopo

- Lógica de jogo e telas (já entregues em issues anteriores) — apenas embrulhar em PWA/kiosk
- MDM corporativo / provisionamento de hardware (apenas recomendações no doc de setup)
- Alteração do modelo de dados ou do mecanismo de sync de leads (apenas preservar)
- Suporte a orientação paisagem
- Push notifications

## Definition of Done

- [ ] PWA instalável: `manifest.webmanifest` válido (nome, ícones 192/512 + maskable, `start_url`, `scope`, `background_color`/`theme_color` `#0333BD`, `display: fullscreen` com fallback `standalone`, `orientation: portrait`), linkado no `index.html` com as metatags Apple/`theme-color`
- [ ] App abre em tela cheia e retrato, sem chrome do browser, quando instalado
- [ ] Service worker (Workbox/`vite-plugin-pwa`) com precache do app-shell + runtime caching (fontes BB, imagens, JS/CSS); app abre offline
- [ ] Persistência/sync de leads (idb + Supabase) preservada — leads offline persistem e sincronizam ao reconectar, sem regressão
- [ ] Tela permanece ligada (Screen Wake Lock re-adquirido em `visibilitychange`) com fallback documentado
- [ ] Hardening: sem zoom, sem seleção/menu de contexto/arraste acidentais, sem pull-to-refresh/overscroll; inputs continuam funcionais
- [ ] Orientação travada em retrato
- [ ] `npm run build` e deploy Cloudflare funcionando, sem quebrar module federation; gate completo verde (`eslint` + `tsc` + `vitest`)
- [ ] Doc de setup do kiosk (Android + iPad) em `/docs`
- [ ] Lighthouse PWA "installable" verde
- [ ] Sem código morto
- [ ] Validação em tablet real aprovada pelo stakeholder
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-75)
