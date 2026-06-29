# Spec: HUB-67 — Consentimento LGPD no formulário (checkbox + modal de termos, obrigatório)

## Contexto

Hoje o fluxo do totem é `splash → consent (ConsentScreen) → lead-form → game → result`.
A `ConsentScreen` é uma tela separada que: renderiza o texto de consentimento
(`config.lgpd.consentText` custom ou um texto templado a partir de
`dataController`/`purposeText`/`retentionMonths`); oferece o link "Ler Política de
Privacidade" (modal/iframe via `privacyPolicyPath`, ou link externo `privacyPolicyUrl`);
e tem dois botões — "Participar e aceitar" (define `consentedAt` e vai ao form) e
"Jogar sem participar" (joga sem captura de dados).

**Decisão do stakeholder (29/06):** remover a `ConsentScreen` e levar o consentimento para
dentro do `LeadForm` (já com layout do mockup, HUB-65), como um **checkbox de aceite + link
que abre os termos em modal sobreposto**. O consentimento passa a ser **obrigatório** para
participar — o caminho "jogar sem participar" deixa de existir. Como efeito colateral
positivo, o form passa a aparecer logo após o splash (a `ConsentScreen` deixava de exibi-lo).

Esta entrega altera o **fluxo de consentimento e a UI do form**. O comportamento de entrada
do form (teclado virtual, validações, máscara, layout HUB-65) e a persistência de lead devem
ser **preservados sem regressão**.

## User Story

**Como** visitante de um evento da BB Seguros que quer participar do jogo e da captura de lead,
**quero** dar meu consentimento LGPD diretamente no formulário, marcando um aceite e podendo ler os termos completos num modal,
**para que** eu participe de forma rápida e transparente, ciente de que meus dados serão tratados conforme a lei, num único passo.

## Critérios de Aceite

**Cenário 1: Fluxo direto splash → formulário (sem tela de consentimento)**
- [ ] **Dado** que o visitante está na splash
- **Quando** ele inicia o fluxo
- **Então** o formulário de lead é exibido em seguida, sem nenhuma tela intermediária de consentimento
- **E** a `ConsentScreen` não existe mais no fluxo

**Cenário 2: Checkbox de aceite presente no formulário**
- [ ] **Dado** o formulário de lead renderizado
- **Quando** o visitante observa a área abaixo dos campos (antes do botão ENVIAR)
- **Então** há um checkbox de aceite com um texto curto de consentimento
- **E** o texto contém um link/botão "termos" (ou equivalente) para abrir os termos completos
- **E** o checkbox inicia **desmarcado**

**Cenário 3: Link abre o modal de termos sobreposto**
- [ ] **Dado** o formulário renderizado
- **Quando** o visitante toca no link "termos"
- **Então** um modal sobrepõe a tela (overlay) exibindo o texto completo dos termos (texto de consentimento + acesso à Política de Privacidade)
- **E** o conteúdo do form permanece por baixo do overlay, sem navegação para outra tela

**Cenário 4: Modal é fechável**
- [ ] **Dado** o modal de termos aberto
- **Quando** o visitante toca no botão de fechar (ou na área externa/backdrop do modal)
- **Então** o modal fecha e retorna ao formulário com o estado preservado (campos e checkbox inalterados)

**Cenário 5: Modal acessível e com scroll para texto longo**
- [ ] **Dado** o modal de termos aberto
- **Quando** o texto dos termos excede a altura disponível
- **Então** o conteúdo do modal é rolável (scroll interno), sem cortar texto
- **E** o modal tem `role="dialog"` com rótulo acessível e recebe foco ao abrir; o foco não escapa para o conteúdo por baixo enquanto aberto

**Cenário 6: Gating — botão ENVIAR desabilitado sem aceite**
- [ ] **Dado** o formulário com o checkbox de consentimento desmarcado
- **Quando** o visitante observa o botão ENVIAR
- **Então** o botão ENVIAR está desabilitado (visualmente e funcionalmente, não submete)

**Cenário 7: Gating — mensagem ao tentar enviar sem aceite**
- [ ] **Dado** o formulário com campos válidos preenchidos mas o checkbox desmarcado
- **Quando** o visitante tenta enviar (toque no botão / acionamento do submit)
- **Então** a submissão é bloqueada
- **E** é exibida uma mensagem clara indicando que é necessário aceitar os termos para participar
- **E** `onSubmit` não é chamado

**Cenário 8: Envio liberado com aceite marcado**
- [ ] **Dado** o formulário com todos os campos obrigatórios válidos e o checkbox marcado
- **Quando** o visitante aciona ENVIAR
- **Então** a submissão é efetuada e `onSubmit` é chamado com os dados do formulário

**Cenário 9: Não existe mais "jogar sem participar"**
- [ ] **Dado** qualquer estado do formulário
- **Quando** o visitante procura uma forma de jogar sem fornecer dados/consentimento
- **Então** não há nenhuma opção "jogar sem participar" — participar exige campos válidos + consentimento

**Cenário 10: Persistência — consentedAt e consentVersion no submit**
- [ ] **Dado** o formulário enviado com o checkbox marcado
- **Quando** o lead é persistido
- **Então** `consentedAt` é definido no momento do submit
- **E** `consentVersion` recebe o valor de `config.lgpd.consentVersion` (ou o default migrado, quando ausente)

**Cenário 11: Fonte do texto de consentimento preservada**
- [ ] **Dado** `config.lgpd.consentText` definido (custom)
- **Quando** o modal de termos é aberto
- **Então** o texto custom é exibido
- **E quando** `consentText` está ausente, o texto é montado a partir de `dataController`/`purposeText`/`retentionMonths` (mesma regra de template da antiga ConsentScreen)

**Cenário 12: Política de Privacidade acessível pelo modal**
- [ ] **Dado** o modal de termos aberto e `config.lgpd.privacyPolicyPath` (ou `privacyPolicyUrl`) configurado
- **Quando** o visitante aciona o acesso à Política de Privacidade
- **Então** a Política de Privacidade é exibida (via o mecanismo existente — `PrivacyPolicyScreen`/iframe ou link externo), conforme a configuração

**Cenário 13: Fallback seguro quando `config.lgpd` ausente**
- [ ] **Dado** que `config.lgpd` não está definido na configuração do evento
- **Quando** o formulário é renderizado
- **Então** o checkbox de consentimento e o modal continuam funcionando com textos default seguros (sem quebrar a tela)
- **E** `consentVersion` assume o default migrado; nenhum erro é lançado

**Cenário 14: Regressão zero — teclado virtual (HUB-57/59)**
- [ ] **Dado** `config.leadForm.virtualKeyboard.enabled` true
- **Quando** o visitante interage com os campos
- **Então** o teclado virtual abre, digita, long-press/acentos, símbolos e dialpad funcionam como antes
- **E** a inserção do checkbox/modal não interfere no comportamento do teclado

**Cenário 15: Regressão zero — validações de campos**
- [ ] **Dado** o formulário
- **Quando** o visitante envia com campos obrigatórios vazios, e-mail inválido ou telefone incompleto
- **Então** as validações de obrigatórios, e-mail e máscara `(99) 99999-9999` operam exatamente como antes, independentemente do estado do checkbox

**Cenário 16: Regressão zero — layout do form (HUB-65)**
- [ ] **Dado** o formulário renderizado
- **Quando** o visitante observa a tela
- **Então** o layout HUB-65 (fundo `#0333BD`, moldura branca, logo BB, labels fonte BB, inputs pill amarelos, botão ENVIAR) permanece intacto; checkbox e link seguem o mesmo padrão visual (azul/accent `#FCFC30`, fonte BB)

## Decisões do PO

1. **Texto do checkbox e fonte do texto do modal.** Decisão:
   - **Checkbox (texto curto):** "Li e aceito os **termos de consentimento** e a Política de Privacidade." — onde "termos de consentimento" (ou a palavra "termos") é o link que abre o modal. O texto final exato pode ser ajustado pelo Designer, desde que: (a) seja curto/legível no totem; (b) deixe claro que marcar = consentir; (c) contenha o link para os termos.
   - **Conteúdo do modal:** **reaproveitar** `config.lgpd.consentText` (custom) quando presente; caso ausente, o texto templado a partir de `dataController`/`purposeText`/`retentionMonths` — mesma regra da ConsentScreen atual — **mais** o acesso à Política de Privacidade (`privacyPolicyPath`/`privacyPolicyUrl`). Sem reescrever conteúdo jurídico (fora de escopo).
2. **UX do gating.** Decisão (defensiva, dupla camada): o botão ENVIAR fica **desabilitado** enquanto o checkbox não estiver marcado **E**, se a submissão for tentada sem aceite (ex.: via Enter/edge case), exibir **mensagem de erro** clara ("É necessário aceitar os termos para participar") e bloquear `onSubmit`. As validações de campos e o gate de consentimento são independentes — ambos precisam estar satisfeitos para enviar. O realce visual do botão desabilitado e a posição da mensagem ficam a cargo do Designer.
3. **Fallback quando `config.lgpd` ausente.** Decisão: a feature **não quebra**. Checkbox e modal renderizam com textos default seguros (controlador = `event.name`, propósito e retenção default, conforme constantes migradas da ConsentScreen); `consentVersion` assume o default migrado (`DEFAULT_CONSENT_VERSION`). O consentimento permanece obrigatório mesmo no fallback — nenhum erro é lançado e nenhum dado é capturado sem aceite.
4. **Confirmação: "jogar sem participar" deixa de existir.** Decisão **confirmada**: o caminho de jogar sem fornecer dados/consentimento é **removido** do produto. Participar do jogo exige preencher os campos válidos e marcar o consentimento. Lead capture passa a ser sempre habilitado (consentimento é a condição). Eventual impacto de produto (visitantes que não querem ceder dados não jogam) é uma decisão consciente do stakeholder, registrada aqui.

## Design

Referência: layout HUB-65 (`public/images/mockup formulário.png`) + padrão de modal sobreposto.
Tema herdado (HUB-65/HUB-59): fundo `#0333BD`, accent `#FCFC30`, branco, fonte BB (`font-bb-titulos` / `font-bb-textos`). Sem roxo legado.

> Esta entrega adiciona, ao `LeadForm` (HUB-65), um **bloco de consentimento** (checkbox + link) entre
> os campos e o botão ENVIAR, e um **modal de termos** sobreposto. Reaproveita o conteúdo da antiga
> `ConsentScreen` (texto custom/templado + Política de Privacidade via `PrivacyPolicyScreen`/iframe).
> Não há conteúdo jurídico novo. Layout, validações e teclado virtual permanecem intactos.

### Tokens visuais (consistentes com HUB-65/HUB-59)

| Token | Valor | Uso |
|-------|-------|-----|
| fundo | `#0333BD` | Tela do form (inalterado) |
| accent | `#FCFC30` | Checkbox marcado, link "termos", botão ENVIAR habilitado |
| branco | `#FFFFFF` | Texto do consentimento, borda do checkbox, card do modal |
| azul-texto | `#0333BD` | Texto sobre accent (check do checkbox, "ENVIAR", título do modal) |
| erro | `#FFC7C7` | Mensagens de erro (mesmo vermelho claro alto-contraste dos erros de campo) |
| overlay | `rgba(3, 51, 189, 0.72)` ou `bg-black/60` | Backdrop escurecido do modal |

### 1. Checkbox de aceite (rodapé do form, entre campos e ENVIAR)

Posição: bloco logo **abaixo do último campo (TELEFONE)** e **acima do botão ENVIAR**, dentro do `<form>`, respeitando o `gap-6` do form e o `px-[8%]` lateral.

**Layout do bloco:** linha horizontal — caixa à esquerda + texto à direita.
- `flex items-start gap-3` (alinhamento ao topo para texto que quebra em 2 linhas).
- Alvo de toque: a **caixa inteira + texto** é clicável (`<label>` envolvendo o input), ampliando a área. A caixa visual tem ~28–32px, mas o **alvo de toque mínimo é 44×44px** (totem) — garantir com padding na `<label>` ou `min-h-[44px]` no clique.

**Aparência da caixa:**
| Estado | Visual |
|--------|--------|
| Desmarcado (inicial) | quadrado `w-7 h-7 rounded-md`, `border-2 border-white`, fundo transparente; sem check |
| Marcado | fundo accent `#FCFC30`, `border-2 border-[#FCFC30]`, ícone de check azul `#0333BD` centralizado |
| Foco (teclado) | anel visível `ring-2 ring-[#FCFC30] ring-offset-2 ring-offset-[#0333BD]` (não remover outline sem substituto) |
| Erro (tentou enviar sem marcar) | `border-2 border-[#FFC7C7]` (realça a caixa junto com a mensagem) |

- Usar `<input type="checkbox">` real (acessível, foco nativo) com a aparência customizada (peer/`appearance-none` ou ícone sobreposto). Não recriar com `<div>` — preserva semântica e teclado.

**Texto ao lado (curto, fonte BB Textos, branco):**
- Conteúdo (decisão PO 1): "Li e aceito os **termos de consentimento** e a Política de Privacidade."
- `font-bb-textos text-white text-base leading-snug`.
- A expressão **"termos de consentimento"** é o **link** que abre o modal: `<button type="button">` inline, `underline`, cor accent `#FCFC30` (contraste ≈ 10,5:1 sobre azul — ótimo), `font-medium`. Acessível por toque/teclado, alvo ≥ 44px (padding vertical no inline ou `inline-flex min-h-[44px] items-center`).
- O link **não** alterna o checkbox (clicar no link abre o modal; marcar/desmarcar é só na caixa/texto-base). Garantir que o toque no link não propague para o `<label>` que marca o checkbox (`stopPropagation` no handler do link).

### 2. Modal de termos sobreposto

Estrutura: backdrop full-screen + card central. Sobrepõe o form **sem navegar** (Cenário 3) — o form permanece montado por baixo.

**Backdrop:**
- `fixed inset-0 z-50 flex items-center justify-center p-4`.
- Fundo escurecido: `bg-black/60` (ou `rgba(3,51,189,.72)`), com leve `backdrop-blur-sm` (opcional).
- Clique no backdrop fecha o modal (Cenário 4).

**Card (retrato):**
- Fundo **branco** `#FFFFFF` (legibilidade do texto longo; o azul fica no backdrop), `rounded-[1.5rem]`, `shadow-2xl`.
- Tamanho retrato: `w-full max-w-md` (largura), altura `max-h-[80vh]` com o **corpo rolável** internamente.
- Padding: `p-6` (cabeçalho/rodapé), corpo com `px-6`.
- Estrutura interna em 3 zonas:
  1. **Cabeçalho** (fixo): título `font-bb-titulos font-bold text-[#0333BD] text-xl` — ex.: "Termos de consentimento" — + botão **X** no canto superior direito (`aria-label="Fechar"`, alvo `w-11 h-11`, ícone azul).
  2. **Corpo rolável** (`flex-1 overflow-y-auto`): o texto de consentimento (custom `config.lgpd.consentText` ou templado a partir de `dataController`/`purposeText`/`retentionMonths` — mesma regra da ConsentScreen, Cenário 11), em `font-bb-textos text-gray-800 text-base leading-relaxed`, com `whitespace-pre-line` para o texto custom. Abaixo, o **acesso à Política de Privacidade** (ver §2.1).
  3. **Rodapé** (fixo): botão **"Fechar"** — pill accent `#FCFC30` texto azul `#0333BD` `font-bb-titulos font-extrabold`, `min-h-[56px] rounded-full w-full` (mesmo estilo do ENVIAR, para coerência). Redundante com o X, mas melhora ergonomia no totem.
- Indicação de scroll: sombra/fade sutil no topo/base do corpo quando há overflow (opcional, ajuda a sinalizar que há mais texto).

**2.1 Política de Privacidade dentro do modal:**
- Reaproveitar o mecanismo existente (HUB-62), **sem reescrever**:
  - Se `privacyPolicyPath` definido → link/botão "Ler Política de Privacidade" que abre o `PrivacyPolicyScreen` (iframe sandbox) — recomendado abrir como **camada acima do próprio modal** (full-screen `fixed inset-0 z-[60]`, acima do `z-50` do modal), com seu "← Voltar" retornando ao modal de termos. Assim o estado do form e do checkbox é preservado.
  - Se apenas `privacyPolicyUrl` → link externo `target="_blank" rel="noopener noreferrer"`.
- O link da política dentro do corpo: `underline text-[#0333BD] font-medium`, alvo ≥ 44px.

**Acessibilidade do modal (Cenário 5):**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apontando para o id do título.
- **Foco capturado** ao abrir: foco vai para o card (ou para o X); `Tab` cicla apenas dentro do modal (focus trap); foco não escapa para o form por baixo.
- **Fechar por:** botão X, botão "Fechar", clique no backdrop **e** tecla **Esc** (no totem o Esc é raro, mas mantém padrão acessível).
- Ao fechar, devolver o foco ao link "termos de consentimento" que abriu o modal.
- Travar o scroll do body enquanto aberto (evitar scroll-through para o form).
- Contraste: título/texto azul/cinza-escuro sobre branco (≥ 7:1); botão accent/azul (≈ 10,5:1).

### 3. Gating do botão ENVIAR (dupla camada — decisão PO 2)

**Botão desabilitado (checkbox desmarcado):**
- Estado **habilitado** (referência HUB-65): pill accent `#FCFC30`, texto azul `#0333BD`, contorno branco.
- Estado **desabilitado**: reduzir affordance sem sumir — `bg-[#FCFC30]/40` (amarelo esmaecido) + `text-[#0333BD]/50` + `cursor-not-allowed`, `opacity-60`. Mantém o formato pill; comunica "indisponível" por opacidade **e** cursor (não só cor).
- `disabled` real no `<button>` (não submete) + `aria-disabled="true"`. O `disabled` nativo já bloqueia o submit por clique.

**Mensagem ao tentar enviar sem aceite (Cenário 7 — edge case Enter/submit programático):**
- Como o botão pode estar `disabled`, o gate de mensagem cobre o caso de submit via Enter no campo. Ao detectar submit sem consentimento: **bloquear** `onSubmit` e exibir mensagem.
- **Estilo da mensagem:** idêntico aos erros de campo do form — `text-[#FFC7C7] text-base font-bb-textos`, posicionada **logo abaixo do bloco do checkbox** (e acima do ENVIAR), com a caixa do checkbox em estado de erro (borda `#FFC7C7`).
- Texto: "É necessário aceitar os termos para participar."
- `aria-live="polite"` (ou `assertive`) na mensagem para leitor de tela anunciar; associar via `aria-describedby` ao checkbox.
- A mensagem some assim que o checkbox é marcado (mesmo padrão dos erros de campo que limpam ao corrigir).

### 4. Tema e consistência

- Paleta única em todas as superfícies: azul `#0333BD`, accent `#FCFC30`, branco, vermelho-erro `#FFC7C7`. **Sem roxo legado** (alinhado a HUB-59/HUB-65).
- Tipografia: `font-bb-titulos` (títulos/botões/`bold`/`extrabold`), `font-bb-textos` (corpo/labels longos/mensagens).
- Botões "Fechar" do modal e "ENVIAR" compartilham o estilo pill accent → coesão visual.
- Checkbox marcado, link "termos" e botão usam o mesmo accent → linguagem visual consistente.
- O modal é a **única** superfície branca de fundo (para leitura confortável de texto longo); o restante mantém o azul da marca.

### Estados (resumo)

- [x] Checkbox: desmarcado / marcado / foco / erro.
- [x] Link "termos": normal / foco / pressionado (`active:opacity-80`).
- [x] Modal: fechado / aberto / corpo com scroll / política aberta por cima.
- [x] ENVIAR: habilitado / desabilitado.
- [x] Mensagem de gating: oculta / visível (com `aria-live`).
- [n/a] Loading/vazio: não se aplicam (sem fetch nesta UI).

### Componentes do Design System utilizados

- **Ajustado:** `LeadForm` (insere bloco de consentimento + integra o modal).
- **Reaproveitado:** `PrivacyPolicyScreen` (iframe sandbox HUB-62) — sem alteração.
- **Novos elementos:** checkbox de aceite estilizado e **modal de termos** (`role="dialog"`, focus trap, scroll). Recomendado encapsular o modal como componente reutilizável (ex.: `TermsModal`) — decisão de estrutura final fica com o Tech Lead.
- **Removido:** `ConsentScreen` (conteúdo migrado para o modal; constante `DEFAULT_CONSENT_VERSION` migra para módulo de constantes — DoD).

### Responsividade / proporção (totem retrato)

- Bloco do checkbox: largura total do form (`w-full`, dentro do `px-[8%]`), texto quebra em até 2 linhas sem empurrar o ENVIAR para fora — manter `gap-6` do form.
- Modal: `max-w-md` + `max-h-[80vh]` com corpo rolável garante caber em retrato sem cortar; em telas baixas o scroll interno assume.
- Compatibilidade com teclado virtual (HUB-59): o modal de termos é tipicamente acionado **antes** de focar campos; ao abrir o modal, recomenda-se não exibir o VK por baixo (o modal cobre a tela). Não alterar a lógica do VK — apenas garantir `z-index` do modal acima do teclado. Sem regressão no comportamento de entrada (Cenário 14).

### Resumo das classes Tailwind sugeridas

- **Bloco checkbox:** `<label className="flex items-start gap-3 min-h-[44px] cursor-pointer">`.
- **Caixa:** `<input type="checkbox" className="peer sr-only">` + box `w-7 h-7 rounded-md border-2 border-white peer-checked:bg-[#FCFC30] peer-checked:border-[#FCFC30] peer-focus-visible:ring-2 peer-focus-visible:ring-[#FCFC30] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0333BD]` + check azul visível só quando marcado.
- **Texto:** `font-bb-textos text-white text-base leading-snug`; link `underline text-[#FCFC30] font-medium`.
- **Mensagem gating:** `text-[#FFC7C7] text-base font-bb-textos` + `aria-live="polite"`.
- **ENVIAR desabilitado:** `disabled:opacity-60 disabled:bg-[#FCFC30]/40 disabled:text-[#0333BD]/50 disabled:cursor-not-allowed`.
- **Backdrop:** `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60`.
- **Card:** `w-full max-w-md max-h-[80vh] flex flex-col bg-white rounded-[1.5rem] shadow-2xl`.
- **Corpo:** `flex-1 overflow-y-auto px-6 font-bb-textos text-gray-800 leading-relaxed`.
- **Botão Fechar:** `mt-4 w-full min-h-[56px] rounded-full bg-[#FCFC30] text-[#0333BD] font-bb-titulos font-extrabold`.
- **X:** `w-11 h-11 flex items-center justify-center text-[#0333BD]` + `aria-label="Fechar"`.

> Tamanhos (caixa 28px, alvos 44px, modal `max-w-md`/`max-h-[80vh]`, timeout n/a) são pontos de
> partida; ajustar no pixel-perfect (Designer + Dev Front) respeitando os mínimos de toque e o
> contraste. Sem reescrita de conteúdo jurídico.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. Mudança de **fluxo + UI na camada de apresentação**
> (`standalone/`). O núcleo do teclado (`lead-capture/keyboard/`), o domínio do jogo e a persistência
> (`useLeadPersistence`/`leadsDb`/`leadsSync`) **não mudam de comportamento** — apenas o *wiring* de
> `consentedAt`/`consentVersion` no `main` é simplificado. Regra de dependência preservada.

### Arquitetura envolvida

| Arquivo | Mudança | Tipo |
|---------|---------|------|
| `src/standalone/lib/lgpd.ts` (**novo**) | Módulo **puro** de constantes + texto LGPD: `DEFAULT_CONSENT_VERSION`, `DEFAULT_PURPOSE_TEXT`, `DEFAULT_RETENTION_MONTHS` e a função `buildConsentText(config)`. Sem React/DOM. | Constantes/lógica pura |
| `src/standalone/ConsentScreen.tsx` | **Deletar** (componente + a constante migram). | Remoção |
| `src/standalone/__tests__/ConsentScreen.test.tsx` | **Deletar**; os testes de texto templado/custom/versão **migram** para `lib/__tests__/lgpd.test.ts` (preservar cobertura, não perdê-la). | Remoção+migração |
| `src/standalone/main.tsx` | Remove screen `'consent'`, `ConsentScreen`, `handleConsentAccept/Decline` e o estado `leadCaptureEnabled`; `handleStart → 'lead-form'`; `handleLeadSubmit` carimba `consentedAt`; importa `DEFAULT_CONSENT_VERSION` de `lib/lgpd`. | Orquestração |
| `src/standalone/LeadForm.tsx` | Adiciona bloco de consentimento (checkbox + link), estado `accepted`/`consentError`, gating do submit, integra o `TermsModal`. **Não** altera campos/validação/máscara/VK/layout HUB-65. | Apresentação |
| `src/standalone/TermsModal.tsx` (**novo**) | Modal apresentacional: `role="dialog"`, `aria-modal`, focus-trap, Esc/overlay/X/Fechar, scroll-lock; renderiza `buildConsentText` + acesso à Política (reuso de `PrivacyPolicyScreen` em camada acima). | Apresentação |
| `src/standalone/PrivacyPolicyScreen.tsx` | **Reuso sem alteração funcional** (HUB-62). Único ajuste opcional: `aria-label` do "Voltar" deixa de citar "tela de consentimento" (ver conflito 3). | Reuso |
| `__tests__/` | Novos: `lib/__tests__/lgpd.test.ts`, testes de consentimento no `LeadForm.test.tsx`. Atualizar testes de submit do `LeadForm` (gating). | Testes |

**Intocados (regressão zero):** `lead-capture/keyboard/*`, `game/*`, `hooks/useLeadPersistence.ts`,
`lib/leadsDb.ts`, `lib/leadsSync.ts`. O contrato `SaveLeadParams` (já tem `consentedAt`/`consentVersion`)
**não muda** — a persistência continua idêntica.

### Contratos de API (se houver)

N/A (sem rede nova). **Contrato interno do `LeadForm`:** mantém `onSubmit(formData: Record<string,string>)`
— **não** muda a assinatura. **Decisão: o `consentedAt` é carimbado no `main`** (`handleLeadSubmit`), não
no `LeadForm`. Justificativa: o gating do `LeadForm` garante que o submit só ocorre **com** consentimento,
então o instante do submit já é o instante do consentimento; manter a autoria do timestamp no `main` (que
já carimba `playedAt` na persistência) preserva o contrato estável e evita vazar concern de tempo para o
form. (Alternativa `onSubmit(formData, { consentedAt })` foi considerada e **preterida** por alargar o
contrato sem ganho real.)

### Modelo de dados (se houver)

Sem mudança de schema/persistência. `LeadIndexedRecord`/`SaveLeadParams` já contêm `consentedAt: string` e
`consentVersion: string`. A única diferença é que **sempre** se persiste (consentimento obrigatório),
eliminando o ramo condicional `if (leadCaptureEnabled)`.

### Decisões técnicas (encizadas)

1. **Módulo LGPD puro e DRY (`lib/lgpd.ts`).** Centraliza o que hoje vive na `ConsentScreen`:
   ```ts
   export const DEFAULT_CONSENT_VERSION = 'default'
   export const DEFAULT_PURPOSE_TEXT = 'para entrar em contato sobre as novidades do evento'
   export const DEFAULT_RETENTION_MONTHS = 12

   /** Texto dos termos: custom (config.lgpd.consentText) tem prioridade; senão, templado.
    *  Fallback seguro sem config.lgpd (controlador = event.name). Retorna string pura
    *  (parágrafos separados por \n\n) renderizada com `whitespace-pre-line`. */
   export function buildConsentText(config: GameConfig): string { /* custom ?? template(...) */ }
   ```
   Função **pura** (sem React), testável isolada → para lá migram os testes de template/fallback/versão da
   antiga `ConsentScreen`. O `TermsModal` e qualquer superfície futura consomem a mesma função (DRY sem
   over-engineering: uma função, não uma "engine").
2. **`main.tsx` simplificado (consentimento obrigatório).**
   - `AppScreen` perde `'consent'`; removidos `ConsentScreen`, `handleConsentAccept/Decline` e o estado
     `leadCaptureEnabled` (morto agora — captura é sempre habilitada).
   - `handleStart` → `setScreen('lead-form')`.
   - `handleLeadSubmit(formData)` → `setLeadData(formData)`; **`setConsentedAt(new Date().toISOString())`**;
     `setScreen('game')`. (O `consentedAt` em state chega populado ao `handleGameComplete`, mesmo padrão de
     antes.)
   - `handleGameComplete`: remove o `if (leadCaptureEnabled)` → **sempre** `saveLead({... consentedAt,
     consentVersion})`, com `consentVersion = config.lgpd?.consentVersion ?? DEFAULT_CONSENT_VERSION`
     (import de `lib/lgpd`). `handleNext` remove o reset de `leadCaptureEnabled`.
3. **`LeadForm` — bloco de consentimento + gating.**
   - Estados novos: `accepted: boolean` (inicial `false`) e `consentError: string` (inicial `''`).
   - Checkbox real (`<input type="checkbox">`) com aparência custom (peer), dentro do `<form>`, entre o
     último campo e o ENVIAR. Link "termos" é `<button type="button">` que **abre o modal** e **não**
     alterna o checkbox (handler do link com `stopPropagation` ou fora do `<label>`).
   - **Gating em dupla camada (independente da validação de campos):** ENVIAR com `disabled={!accepted}`
     (bloqueia clique). No `handleSubmit` (cobre o submit por Enter): avaliar **ambos** os gates de forma
     independente — `const fieldsOk = validate(); const consentOk = accepted;` se `!consentOk` setar
     `consentError`; se `!fieldsOk || !consentOk` **retornar** (não chama `onSubmit`); senão `onSubmit`.
     Assim os erros de campo (Cenário 15) e a mensagem de consentimento (Cenário 7) coexistem e cada um
     aparece quando aplicável. `consentError` limpa ao marcar o checkbox (mesmo padrão do clear de erros).
   - **Afetação do botão desabilitado:** como o fundo do ENVIAR é `style` inline (`backgroundColor: accent`),
     o utilitário `disabled:bg-*` **não** prevalece sobre inline. Para o estado desabilitado ser fiel ao
     Design, computar o fundo condicionalmente no inline (`accepted ? accent : <tom esmaecido>`) **ou**
     mover o accent para classe — escolher um; não confiar só no `disabled:bg-[...]/40` com inline presente.
4. **`TermsModal` (novo, apresentacional).** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`;
   **focus-trap** (foco inicial no card/X; `Tab`/`Shift+Tab` ciclam dentro; foco não escapa); fecha por
   X, "Fechar", clique no backdrop e **Esc**; ao fechar devolve foco ao link "termos"; **trava o scroll do
   body** enquanto aberto (cleanup no unmount). Corpo `overflow-y-auto` (Cenário 5). Renderiza
   `buildConsentText(config)` (`whitespace-pre-line`) + acesso à Política de Privacidade:
   - `privacyPolicyPath` → `PrivacyPolicyScreen` como **camada acima do modal** (`fixed inset-0 z-[60]`,
     acima do `z-50` do backdrop), com o "Voltar" retornando ao modal (estado do form/checkbox preservado).
   - senão `privacyPolicyUrl` → link externo `target="_blank" rel="noopener noreferrer"`.
   - **z-index acima do teclado virtual** (o VK usa `z` baixo; o modal `z-50`/política `z-[60]`).
5. **Reuso do `PrivacyPolicyScreen` sem reescrever** (HUB-62) — apenas montado pelo `TermsModal`. O iframe
   sandbox e o tratamento same-origin continuam idênticos.

### Plano de testes (vitest — sem sobre-engenharia)

**`lib/__tests__/lgpd.test.ts` (puro — migra a cobertura da ConsentScreen):**
1. `buildConsentText`: usa `consentText` custom quando presente; senão templa com `dataController`/
   `purposeText`/`retentionMonths`; **fallback** sem `config.lgpd` (controlador = `event.name`, defaults);
   pluralização de "mês/meses". `DEFAULT_CONSENT_VERSION === 'default'`.

**`LeadForm.test.tsx` (novos + atualização):**
2. Checkbox inicia desmarcado; marcar/desmarcar alterna estado.
3. Link "termos" abre o `TermsModal` (`role="dialog"`); fechar por X / backdrop / Esc volta ao form com
   campos e checkbox **preservados** (Cenário 4); clicar no link **não** marca o checkbox.
4. Modal: `role="dialog"` com rótulo acessível, corpo rolável; exibe o texto de `buildConsentText`; acesso
   à Política quando `privacyPolicyPath`/`Url` (Cenários 11/12).
5. **Gating:** ENVIAR `disabled` sem aceite (Cenário 6); submit por Enter sem aceite → `consentError`
   visível + `onSubmit` não chamado (Cenário 7); com aceite + campos válidos → `onSubmit` chamado
   (Cenário 8); mensagem some ao marcar.
6. **Atualizar os testes de submit existentes (HUB-65):** os 3 testes que clicam ENVIAR para exercitar
   validação/submit precisam **marcar o checkbox antes** (o botão agora inicia desabilitado) — mudança
   **legítima** de comportamento por spec, **não** mascarar com `skip`. Validação de campos vazios/e-mail
   inválido deve continuar funcionando (via Enter ou com consentimento marcado), provando o Cenário 15.

**Remoções:** `ConsentScreen.test.tsx` deletado junto com o componente.

**Fluxo `main` / persistência:** `App` hoje **não é exportado** (definido inline + `createRoot` no módulo).
Testar o fluxo `splash→lead-form` e o carimbo `consentedAt`/`consentVersion` exigiria **exportar `App`**.
Recomendação: extrair `export function App()` (refator mínimo, sem mudar comportamento) e adicionar **1
teste de fluxo** (splash → clicar iniciar → `LeadForm` presente, **sem** passar por consentimento;
`ConsentScreen` não existe). Não criar harness pesado; um smoke test cobre os Cenários 1/9. Se o refator
de export for indesejado, no mínimo um `grep`/teste estático garantindo a ausência de `ConsentScreen` —
mas o smoke test é preferível.

> **Riscos de testar modal/foco no jsdom (mitigações):** (a) **focus-trap** e devolução de foco dependem de
> `:focus`/`tabIndex` — o jsdom suporta foco programático, mas não calcula tab order real; testar o trap de
> forma **comportamental** (foco inicial no elemento esperado; Esc fecha; foco volta ao gatilho) e deixar a
> verificação fina de ciclo de `Tab` para a validação manual/QA. (b) **Esc**: `fireEvent.keyDown(document,
> {key:'Escape'})` — garantir que o handler está em `document`/no card, não num filho. (c) **scroll-lock**:
> assertar a classe/`style.overflow` no `body`, não o scroll real. (d) `PrivacyPolicyScreen` usa `<iframe>`
> — não navegar de fato no teste; basta assertar presença/atributos.

### Considerações de performance/segurança

- **Performance:** desprezível — uma tela a menos no fluxo; modal montado sob demanda; sem rede nova,
  sem re-render global (estados `accepted`/modal locais ao `LeadForm`). Remoção de código (ConsentScreen)
  reduz bundle.
- **Segurança/LGPD:** **fortalece** a conformidade — consentimento agora é **obrigatório** e `consentedAt`/
  `consentVersion` são sempre persistidos (não há mais ramo que captura/não-captura). Política via iframe
  **sandbox** same-origin (sem `dangerouslySetInnerHTML`, inalterado). Nenhum dado é coletado sem aceite.
  Link externo da política com `rel="noopener noreferrer"` (já é o padrão).
- **Acessibilidade (parte da DoD):** modal `role="dialog"`/`aria-modal`/foco/Esc/scroll-lock; checkbox
  nativo (foco/teclado); mensagens com `aria-live` e `aria-describedby`; contraste do tema (≥7:1 texto,
  ~10,5:1 accent) — todos especificados no Design.

### Estimativa técnica

- **Story points: 5** (complexo, ~2–3 dias): modal acessível (focus-trap/scroll-lock) é o item de maior
  esforço; o restante (checkbox, gating, migração de constantes, simplificação do `main`) é direto.
- **Riscos técnicos:** (1) focus-trap/Esc no jsdom (mitigado: testes comportamentais); (2) regressão dos
  testes de submit do `LeadForm` por causa do botão desabilitado (endereçado no plano); (3) z-index do
  modal vs. teclado virtual (garantir `z-50`/`z-[60]` acima do VK); (4) export de `App` para o smoke test.

### Conflitos Design × Critérios sinalizados

1. **Botão desabilitado com fundo inline (HUB-65).** O ENVIAR usa `style={{ backgroundColor: accent }}`;
   o utilitário `disabled:bg-[#FCFC30]/40` do Design **não** prevalece sobre inline. **Ação:** computar o
   fundo condicionalmente no inline (esmaecido quando `!accepted`) — sem isso, o estado desabilitado não
   muda a cor (só `opacity`/`cursor`). Não bloqueia o início; decisão de implementação.
2. **Reset do checkbox ao reabrir o form.** Hoje, ao voltar à splash e reiniciar (`handleNext`), um novo
   `LeadForm` é montado → `accepted` reinicia `false` naturalmente (consentimento por sessão de captura,
   correto para LGPD). Apenas confirmar que nenhum estado de consentimento persiste entre visitantes —
   está coberto pela remontagem; **não** elevar `accepted` para o `main`.
3. **`aria-label` do `PrivacyPolicyScreen`** diz "Voltar para a tela de consentimento" (tela que deixa de
   existir). Como a tela é reaproveitada e agora retorna ao **modal**, sugiro generalizar para "Voltar"
   (ajuste de 1 linha, melhora a precisão do leitor de tela). Fora do escopo estrito, mas recomendado.
4. **Sem conflito real entre Cenário 7 e 15:** resolvidos pela ordenação de gates independentes (decisão
   técnica 3) — campos e consentimento são validados separadamente e ambas as mensagens podem aparecer.

## Fora de Escopo

- Mudança no conteúdo jurídico dos termos de consentimento ou da Política de Privacidade
- Backend/persistência remota de leads (apenas o wiring de `consentedAt`/`consentVersion` no submit)
- Reescrita do mecanismo da Política de Privacidade (HUB-62) — apenas reaproveitar
- Alteração das regras de validação ou do layout do form (HUB-65) — apenas preservar
- Internacionalização dos textos de consentimento

## Definition of Done

- [ ] `ConsentScreen` (componente + teste) removida; fluxo direto `splash → lead-form → game → result`
- [ ] `DEFAULT_CONSENT_VERSION` migrada para um módulo de constantes apropriado (não mais exportada pela ConsentScreen)
- [ ] Checkbox de aceite no form com texto curto + link para os termos (padrão visual HUB-65)
- [ ] Modal de termos sobreposto, fechável, acessível (`role="dialog"`, foco, scroll), reaproveitando `config.lgpd.consentText`/templado + Política de Privacidade
- [ ] Gating obrigatório: ENVIAR desabilitado sem aceite + mensagem ao tentar enviar; sem caminho "jogar sem participar"
- [ ] Persistência: `consentedAt` definido no submit, `consentVersion` de `config.lgpd.consentVersion` (com default no fallback)
- [ ] Fallback seguro quando `config.lgpd` ausente
- [ ] Regressão zero: teclado virtual (HUB-57/59), validações, máscara, layout HUB-65, persistência de lead
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks no PR)
- [ ] Sem código morto (remover ConsentScreen e referências órfãs)
- [ ] Validação visual (screenshot) aprovada pelo stakeholder
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-67)
