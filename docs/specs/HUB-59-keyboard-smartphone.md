# Spec: HUB-59 — Teclado virtual estilo smartphone (Samsung, retrato)

## Contexto

O totem de captura de lead usa um teclado virtual on-screen (base HUB-57) para preencher o
formulário (HUB-65) sem teclado físico. Hoje o núcleo de layouts (`keyboardLayouts.ts`)
trata acentos como teclas diretas no layout `alpha-ptbr` e tem um layout `numeric` com teclas
esticadas à largura.

**Decisão do stakeholder (29/06):** o teclado deve replicar a experiência de um teclado de
**smartphone na vertical (retrato), estilo Samsung** — substituindo a abordagem ABNT2/dead-key
antes cogitada. As mudanças funcionais são: (1) fileira numérica simples fixa no topo;
(2) composição de acentos por **long-press** (popup de variantes), não por tecla morta;
(3) toggle para modo de símbolos/caracteres especiais; (4) teclado numérico do telefone
**centralizado** (estilo dialpad), não esticado.

Esta é uma evolução de UX do teclado. A integração com o formulário e o comportamento de
entrada existentes (HUB-57/HUB-65) devem ser **preservados sem regressão**.

## User Story

**Como** visitante de um evento que preenche o formulário do totem usando o teclado on-screen,
**quero** um teclado com a mesma ergonomia de um smartphone (números fixos no topo, acentos por segurar a tecla, símbolos e um teclado numérico compacto),
**para que** eu digite meus dados — incluindo nomes com acento e telefone — de forma rápida, familiar e sem erros.

## Critérios de Aceite

**Cenário 1: Layout alfabético estilo Samsung com fileira numérica fixa**
- [ ] **Dado** que o teclado virtual está habilitado e um campo de texto está ativo
- **Quando** o teclado é renderizado no modo alfabético
- **Então** a primeira fileira (topo) exibe os números `1 2 3 4 5 6 7 8 9 0` sempre visíveis
- **E** abaixo seguem as três fileiras QWERTY: `q w e r t y u i o p` / `a s d f g h j k l` / `z x c v b n m`
- **E** estão presentes as teclas shift, backspace, barra de espaço e o toggle `?123`

**Cenário 2: A fileira numérica fixa digita dígitos diretamente**
- [ ] **Dado** o teclado no modo alfabético com um campo de texto ativo
- **Quando** o visitante toca em um número da fileira fixa do topo
- **Então** o dígito correspondente é inserido no campo, sem precisar trocar de modo

**Cenário 3: Long-press abre popup de variantes acentuadas**
- [ ] **Dado** o teclado no modo alfabético e um campo de texto ativo
- **Quando** o visitante pressiona e segura uma tecla que possui variantes (ex.: `a`) por aproximadamente 400–500ms
- **Então** aparece um popup acima da tecla exibindo as variantes acentuadas daquela letra
- **E** a tecla pressionada e o popup têm indicação visual clara de estado ativo

**Cenário 4: Seleção de variante no popup insere o caractere**
- [ ] **Dado** o popup de variantes aberto sobre uma tecla
- **Quando** o visitante solta o dedo sobre uma variante (ou toca nela) — ex.: `ã`
- **Então** o caractere selecionado (`ã`) é inserido no campo
- **E** o popup é fechado

**Cenário 5: Conjunto de variantes por tecla (pt-BR)**
- [ ] **Dado** o modo alfabético
- **Quando** o visitante faz long-press em cada tecla com variantes
- **Então** o popup oferece exatamente o conjunto pt-BR definido abaixo:
  - `a` → `á ã â à ä`
  - `e` → `é ê è ë`
  - `i` → `í î ì ï`
  - `o` → `ó õ ô ò ö`
  - `u` → `ú û ù ü`
  - `c` → `ç`
  - `n` → `ñ`

**Cenário 6: Long-press em tecla sem variantes apenas insere a letra**
- [ ] **Dado** o modo alfabético
- **Quando** o visitante faz long-press em uma tecla sem variantes (ex.: `t`)
- **Então** nenhum popup é exibido
- **E** a própria letra (`t`) é inserida normalmente ao acionar a tecla

**Cenário 7: Maiúsculas acentuadas via shift**
- [ ] **Dado** o teclado com shift ativo
- **Quando** o visitante faz long-press em uma tecla com variantes (ex.: `a`) e seleciona uma variante
- **Então** o caractere inserido é a versão maiúscula acentuada correspondente (ex.: `Ã`, `É`, `Ê`, `Ç`)

**Cenário 8: Toggle para modo de símbolos/caracteres especiais**
- [ ] **Dado** o teclado no modo alfabético
- **Quando** o visitante toca na tecla `?123`
- **Então** o layout alterna para o modo de símbolos, exibindo caracteres especiais (ex.: `@ # & _ - / : ; ( ) $ ! ? . ,` e afins)
- **E** a tecla de troca passa a exibir `ABC`
- **Quando** o visitante toca em `ABC`
- **Então** o layout retorna ao modo alfabético (fileira numérica fixa + QWERTY)

**Cenário 9: Teclado numérico do telefone centralizado (dialpad)**
- [ ] **Dado** que o campo ativo é do tipo telefone (`type=tel`)
- **Quando** o teclado numérico é renderizado
- **Então** as teclas formam um dialpad centralizado horizontalmente, ocupando apenas o espaço necessário (largura natural das teclas), **não** esticado à largura total da tela

**Cenário 10: Ergonomia de totem retrato**
- [ ] **Dado** o teclado renderizado no totem em orientação retrato
- **Quando** o visitante observa as teclas
- **Então** todas as teclas — incluindo as do popup de long-press e as da fileira numérica — têm alvo de toque de no mínimo 44×44px

**Cenário 11: Regressão zero — toggle default-off (HUB-57)**
- [ ] **Dado** `config.leadForm.virtualKeyboard.enabled` ausente ou `false`
- **Quando** o formulário é renderizado
- **Então** o teclado virtual não aparece e o comportamento é idêntico ao anterior (entrada por teclado físico)

**Cenário 12: Regressão zero — campo de e-mail (HUB-57)**
- [ ] **Dado** o campo de e-mail ativo com o teclado virtual habilitado
- **Quando** o visitante digita
- **Então** o layout adequado a e-mail continua disponível e a validação de e-mail permanece inalterada

**Cenário 13: Regressão zero — campo numérico e máscara de telefone (HUB-57)**
- [ ] **Dado** o campo de telefone ativo com o teclado virtual habilitado
- **Quando** o visitante digita os dígitos pelo dialpad
- **Então** o valor é formatado como `(99) 99999-9999`, limitado a 11 dígitos, exatamente como antes

**Cenário 14: Regressão zero — fluxo de submissão (HUB-57/HUB-65)**
- [ ] **Dado** todos os campos preenchidos corretamente via teclado virtual
- **Quando** o visitante aciona ENVIAR
- **Então** as validações (obrigatórios, e-mail, máscara) operam como antes e `onSubmit` é chamado com os valores corretos
- **E** o layout do formulário (HUB-65) permanece intacto

## Decisões do PO

1. **Modelo de interação do long-press (totem touch).** Decisão funcional: **pressionar e segurar** uma tecla com variantes → após ~400–500ms abre o popup de variantes acima da tecla → o visitante **arrasta e solta** sobre a variante desejada **ou** toca nela para selecionar; soltar fora do popup cancela sem inserir. O timeout de hold (~400–500ms) é um ponto de partida — o **Designer refina** o valor exato e a UX visual (animação, realce, posição do popup). Em telas de totem deve haver realce claro da tecla pressionada e da variante sob o dedo.
2. **Conjunto de variantes por tecla (pt-BR)** — conforme Cenário 5: `a→á ã â à ä`, `e→é ê è ë`, `i→í î ì ï`, `o→ó õ ô ò ö`, `u→ú û ù ü`, `c→ç`, `n→ñ`. A ordem prioriza as formas mais comuns no português brasileiro (acento agudo e til primeiro). Em shift, as variantes são as maiúsculas correspondentes.
3. **Long-press em tecla sem variantes.** Decisão: não exibe popup e **apenas insere a própria letra** (comportamento idêntico a um toque normal) — sem efeito colateral, sem erro. Vale também para teclas funcionais (shift, backspace, espaço, `?123`), que ignoram long-press.

## Design

Referência de estilo: teclado de smartphone Samsung (Galaxy, pt-BR, retrato).
Contexto de uso: totem **retrato**; o teclado fica no rodapé do formulário (HUB-65 — fundo azul `#0333BD`, accent `#FCFC30`), como irmão do form (não sobrepõe; ocupa a metade inferior).

> Esta entrega é refinamento de UX/visual do componente apresentacional `VirtualKeyboard.tsx`.
> A lógica de entrada (núcleo puro `keyboardLayouts.ts` / `applyKey`) é preservada; o long-press e o
> modo símbolos exigem novos dados de layout (variantes, símbolos) — descritos aqui para o Tech Lead.

### Tokens visuais (tema alinhado ao app — sem o roxo legado)

| Token | Valor | Uso |
|-------|-------|-----|
| `kbd-surface` | `#022a9e` (azul mais escuro que o fundo `#0333BD`) | Fundo do container do teclado — separa visualmente do form |
| `kbd-key` | `#FFFFFF` | Tecla de caractere (letra/número/símbolo) |
| `kbd-key-text` | `#0A2472` (azul escuro) | Texto das teclas de caractere sobre branco |
| `kbd-control` | `#FFFFFF`/12% (`bg-white/12`) | Teclas funcionais (shift, backspace, `?123`, espaço) |
| `kbd-control-text` | `#FFFFFF` | Texto/ícone das teclas funcionais |
| `kbd-active` | `#FCFC30` (accent) | Tecla pressionada e shift ativo (substitui o roxo `active:bg-purple-200`) |
| `kbd-popup` | `#FFFFFF` | Fundo do balão de variantes (long-press) |
| `kbd-popup-active` | `#FCFC30` | Variante realçada sob o dedo no popup |

> **Remover o roxo legado** (`active:bg-purple-200`). Pressão e estado ativo passam a usar o accent
> amarelo `#FCFC30` com texto azul escuro — coerente com botão/inputs da HUB-65 e com bom contraste.

### 1. Layout alfabético estilo Samsung (modo ABC)

Disposição vertical, de cima para baixo (5 fileiras):

```
1 2 3 4 5 6 7 8 9 0            ← fileira numérica fixa (sempre visível)
q w e r t y u i o p
a s d f g h j k l
⇧  z x c v b n m  ⌫            ← shift à esquerda, backspace à direita
?123   ,   [ espaço ]   .      ← rodapé funcional
```

**Proporções/larguras relativas (unidade = 1 tecla de letra):**

| Fileira | Conteúdo | Larguras relativas |
|---------|----------|--------------------|
| Numérica | `1…0` (10 teclas) | 10 × `1u` — iguais; alinham com a fileira `qwertyuiop` |
| QWERTY 1 | `q…p` (10) | 10 × `1u` |
| QWERTY 2 | `a…l` (9) | 9 × `1u`, **centralizada** (margem lateral ~0,5u de cada lado, como no Samsung) |
| QWERTY 3 | ⇧ + `z…m` (7) + ⌫ | ⇧ = `1.5u`, letras `1u`, ⌫ = `1.5u` |
| Rodapé | `?123` + `,` + espaço + `.` | `?123` = `2u`, `,` = `1u`, espaço = `flex`/`4–5u`, `.` = `1u` |

- **Container:** `flex flex-col gap-1.5 p-2` sobre `kbd-surface`; largura total (`w-full`), `shrink-0`.
- **Gap entre teclas:** ~6 px (`gap-1.5`) horizontal e vertical — fiel ao Samsung (teclas próximas, não coladas).
- **Padding do container:** ~8–12 px (`p-2`/`p-3`).
- A fileira numérica do topo **digita dígitos direto** (são `char` com `value` `'1'…'0'`), sem trocar de modo (Cenário 2).
- A `,` no rodapé é opcional, mas recomendada (paridade Samsung e útil em nomes compostos? não — manter só se não comprometer a largura do espaço; em totem priorizar barra de espaço larga). **Decisão de design:** incluir `?123` (esq.) + espaço largo + `.` (dir.); `,` é opcional e pode ser omitida se o espaço ficar < `4u`.

**Tamanho de toque (totem retrato):** cada tecla `min-h-[56px]` (recomendado ~60–64px em totem) e `min-w-[44px]`; popup e numérica idem — todos ≥ 44×44px (Cenário 10). As `min-h-[72px]` atuais podem ser mantidas se couber na metade inferior sem cortar fileiras; em telas baixas, reduzir para `min-h-[56px]`.

### 2. Modo símbolos (`?123`)

Espelha o Samsung pt-BR, **2 páginas** alcançáveis (página 2 via tecla `1/2`), ou 1 página densa. Recomendação: **1 página** cobrindo o essencial do formulário (e-mail/telefone/nome), para simplicidade (YAGNI — sem 2ª página nesta entrega):

```
1 2 3 4 5 6 7 8 9 0
@ # $ _ & - + ( ) /
ABC  *  "  '  :  ;  !  ?  ⌫
ABC      ,    [ espaço ]    .
```

- A fileira numérica permanece no topo também no modo símbolos (consistência Samsung).
- 2ª fileira: símbolos mais usados (`@ # $ _ & - + ( ) /`) — inclui `@`, `_`, `-`, `.`, `/` úteis para e-mail.
- A tecla de troca exibe **`ABC`** (volta ao alfabético) — Cenário 8.
- Conjunto mínimo exigido pelo Cenário 8 coberto: `@ # & _ - / : ; ( ) $ ! ? . ,`.
- **Sem emojis** (fora de escopo). Sem 2ª página obrigatória.

### 3. Numérico do telefone — dialpad centralizado

Hoje o `NUMERIC` usa teclas com `flexGrow` esticando à largura. **Corrigir:** teclas de **largura natural/fixa, centralizadas**.

```
        1 2 3
        4 5 6
        7 8 9
        ⌫ 0 ⌦        (⌦ = limpar)
```

- **Disposição:** grid 3×4 centralizado horizontalmente — `flex flex-col items-center` + cada fileira `flex gap-2 justify-center`, **sem `flex-grow`** nas teclas.
- **Tamanho das teclas:** quadradas, fixas — `w-[84px] h-[64px]` (ou `min-w-[72px]`), nunca `w-full`. Alvo ≥ 44px garantido.
- **Largura do bloco:** apenas o necessário (3 teclas + 2 gaps), o restante é espaço azul (`kbd-surface`) à esquerda/direita.
- **Implementação:** as teclas do layout `numeric` **não** devem receber `flexGrow`/`flexBasis:0`; o `KeyButton` precisa de um modo "largura natural" para dialpad (sinalizado pelo layout, ex.: `layout.id === 'numeric'` → `justify-center` no container e largura fixa nas teclas). Detalhe técnico fica para o Tech Lead.
- Mantém a máscara `(99) 99999-9999` (Cenário 13) — só muda a apresentação.

### 4. Popup de long-press (acentos)

Balão branco acima da tecla pressionada, exibindo as variantes **em linha horizontal**.

**Aparência:**
- Balão `kbd-popup` (`#FFFFFF`), `rounded-2xl`, sombra (`shadow-xl`), pequena seta/àncora apontando para a tecla de origem (opcional; mínimo: balão alinhado acima da tecla).
- Cada variante é uma "mini-tecla" `min-w-[48px] min-h-[52px]` (≥ 44px — Cenário 10), texto azul escuro `kbd-key-text`, `text-2xl`.
- Variantes dispostas **em linha**, na ordem pt-BR definida (Cenário 5): ex. `a` → `á ã â à ä`.
- **Realce da variante sob o dedo:** fundo `kbd-popup-active` (`#FCFC30`) + leve `scale-110` na mini-tecla atualmente "mirada"; as demais ficam brancas.
- **Tecla de origem:** permanece com estado pressionado (fundo accent) enquanto o popup está aberto.

**Posição quando a tecla está na borda (não cortar):**
- O balão centraliza sobre a tecla por padrão; se ultrapassaria a borda **esquerda** ou **direita** do container, **deslocar (clamp)** para dentro, mantendo todas as variantes visíveis — alinhar o balão pela borda do container com um padding mínimo (~8px). Nunca permitir overflow cortado.
- Para teclas da fileira de cima (ex.: `q`,`p`) o balão abre **acima**; há espaço pois o teclado está no rodapé da tela. Se não houver folga acima (raro), abrir para baixo é alternativa — porém, com o teclado no rodapé e o popup curto, **acima** é sempre viável.

**Timeout de hold e cancelamento (refino do PO):**
- **Hold de abertura: 350 ms** (refinamento dos 400–500ms do PO — em totem touch, 350ms equilibra evitar disparo acidental e não parecer lento; valor exposto como constante para ajuste fino).
- Ao pressionar, iniciar timer; ao atingir 350ms **sem soltar**, abrir o popup com leve fade/scale-in (~120ms).
- **Antes** de 350ms: soltar = inserção normal da letra base (toque comum).
- **Com popup aberto:** arrastar move o realce entre variantes; **soltar sobre uma variante** insere o caractere e fecha; **soltar fora do balão** (ou na tecla de origem sem mover) **cancela sem inserir** (Cenário 4 / decisão PO). Tocar diretamente numa variante também seleciona.
- Sob shift, as variantes e a inserção são as maiúsculas correspondentes (`Á Ã …`, `Ç`) — Cenário 7.
- Teclas funcionais e teclas sem variantes ignoram o long-press (apenas inserem/acionam) — Cenário 6 / decisão PO 3.
- **Feedback:** abertura do popup com micro-animação (fade+scale 120ms); seleção com `active:scale-95` na variante; sem som.

### 5. Estados e feedback

| Estado | Tratamento visual |
|--------|-------------------|
| Tecla pressionada (char) | `active:scale-95` + fundo `kbd-active` (`#FCFC30`), texto azul escuro |
| Tecla funcional pressionada | `active:scale-95` + `active:bg-white/30` |
| **Shift ativo** | tecla ⇧ com fundo accent `#FCFC30` (estado "ligado"), ícone ⇧ preenchido; letras exibidas em maiúsculas |
| Variante mirada (popup) | fundo `#FCFC30` + `scale-110` |
| Tecla de origem (popup aberto) | mantém fundo accent enquanto o balão está visível |

- Todos os alvos ≥ 44×44px (recomendado 56–64px no totem).
- `touch-manipulation` mantido (evita zoom/delay de toque).

### 6. Acessibilidade (WCAG 2.1 AA)

- **Contraste das teclas:** texto azul escuro `#0A2472` sobre branco `#FFFFFF` → ≈ 13:1 (AAA). Texto branco sobre `kbd-control` (`bg-white/12` sobre `kbd-surface` azul) → o glifo branco fica sobre azul escuro, ≈ 9:1 — passa AA. Accent `#FCFC30` com texto azul escuro (tecla pressionada) → ≈ 14:1.
- **Estado ativo não só por cor:** shift ativo usa cor **e** ícone preenchido; variante mirada usa cor **e** escala — não depender apenas de cor (1.4.1).
- **`aria-label` das teclas funcionais:** já existem (`backspace`→"Apagar", `space`→"Espaço", `shift`→"Maiúscula", `clear`→"Limpar campo"). Acrescentar: `?123`→"Símbolos", `ABC`→"Letras". Teclas de caractere dispensam label (o glifo é o nome acessível).
- **Popup acessível:** o balão de variantes deve ter `role="group"` (ou listbox) com `aria-label="Variantes de <letra>"`; cada variante é `button` com `aria-label` do caractere (ex.: "a com til"). Recomendação para o Dev Front; preserva o núcleo puro.
- **Foco/toque:** teclado é operado por toque no totem; manter `type="button"` (já está) para semântica correta.

### Componentes do Design System utilizados

- **Ajustado:** `VirtualKeyboard` (tema, sizing, dialpad centralizado, popup de long-press).
- **Novos elementos visuais:** balão de variantes (long-press) e modo símbolos (`?123`/`ABC`).
- **Novos dados de layout** (núcleo): tabela de variantes por tecla (Cenário 5) e layout `symbols`. Estrutura final fica com o Tech Lead.
- **Tema:** unifica a paleta do teclado com o app (azul/accent amarelo), aposentando o roxo legado.

### Responsividade / proporção (totem retrato)

- Teclado ocupa `w-full` no rodapé; teclas dimensionadas por fração da largura (fileiras de 10 → `1/10` cada, descontado gap) — escala com a largura do totem mantendo proporções Samsung.
- Altura total do teclado ≈ 5 fileiras × (~60px + gap) + padding — cabe na metade inferior sem cortar; em telas mais baixas reduzir `min-h` das teclas para `56px` antes de comprometer fileiras.
- O dialpad numérico usa larguras fixas centralizadas, então **não** estica em telas largas.

### Resumo das classes Tailwind sugeridas

- **Container:** `w-full shrink-0 flex flex-col gap-1.5 p-2 bg-[#022a9e]`.
- **Fileira:** `flex gap-1.5` (numérica/QWERTY1: `justify-between`; QWERTY2/3: `justify-center`).
- **Tecla char:** `flex items-center justify-center rounded-xl min-h-[56px] min-w-[44px] text-2xl bg-white text-[#0A2472] active:scale-95 active:bg-[#FCFC30] touch-manipulation`.
- **Tecla funcional:** `... bg-white/12 text-white active:bg-white/30`.
- **Shift ativo:** adicionar `bg-[#FCFC30] text-[#0A2472]`.
- **Dialpad (numeric):** container `flex flex-col items-center gap-2`; fileira `flex gap-2 justify-center`; tecla `w-[84px] h-[64px]` (sem `flex-grow`).
- **Popup:** `absolute -top-2 -translate-y-full bg-white rounded-2xl shadow-xl p-1.5 flex gap-1`; variante `min-w-[48px] min-h-[52px] rounded-xl text-[#0A2472] text-2xl` (mirada: `bg-[#FCFC30] scale-110`).

> Valores de `min-h`, gaps e o timeout de 350ms são pontos de partida; ajustar no pixel-perfect
> (Designer + Dev Front) respeitando os mínimos de toque (≥44px) e a altura disponível no totem.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. Evolução de UX do teclado virtual. **Princípio diretor:**
> o **núcleo puro** (`keyboardLayouts.ts` = dados; `keyboardInput.ts` = `applyKey`) permanece **sem
> DOM, sem timers, sem React**; todo *timing* (long-press) e estado transitório (popup, modo símbolos)
> vivem na **camada apresentacional** (`VirtualKeyboard.tsx` + hooks dedicados). `LeadForm.tsx` (HUB-65)
> e `useVirtualKeyboard.ts` **não mudam** → zero regressão na integração. Regra de dependência mantida:
> `game ⊅ lead-capture ⊅ standalone`.

### Arquitetura envolvida

| Arquivo | Mudança | Camada |
|---------|---------|--------|
| `src/lead-capture/keyboard/keyboardLayouts.ts` | **Dados**: estende `KeyboardKey` com `variants?: string[]`; estende `KeyboardLayout` com `align?: 'fill' \| 'center'`; nova `KeyAction` `'toggle-symbols'`; adiciona fileira numérica fixa `1234567890` ao `alpha-ptbr` e **remove** a fileira de acentos diretos; novo layout `symbols`; `numeric` recebe `align: 'center'`. | Núcleo puro |
| `src/lead-capture/keyboard/keyboardInput.ts` | `applyKey` ganha o `case 'toggle-symbols'` como **no-op preservador de valor** (total/exaustivo; mesma natureza do `shift`). Nada além disso. | Núcleo puro |
| `src/lead-capture/keyboard/VirtualKeyboard.tsx` | Apresentação: tema (accent, remove roxo), sizing, **dialpad centralizado** (`align`), **popup de long-press**, **modo símbolos** (estado local), `aria` novos. Passa a ter estado de UI (popup/modo) — segue sem `values`/máscara/`GameConfig`. | Apresentação |
| `src/lead-capture/keyboard/useLongPress.ts` (**novo**) | Hook de *timing* via pointer events (hold 350 ms, abrir/cancelar popup, seleção). Sem lógica de negócio. | Apresentação |
| `src/lead-capture/keyboard/useKeyboardMode.ts` (**novo, opcional**) | Encapsula `mode: 'alpha' \| 'symbols'` + resolução do layout efetivo. Alternativa: `useState` local no componente. | Apresentação |
| `src/lead-capture/keyboard/index.ts` | Exporta os novos tipos/hooks se forem parte da superfície pública (provável: manter `useLongPress`/`useKeyboardMode` internos). | Barrel |
| `__tests__/` | Novos testes de núcleo + integração; atualizar o teste de "acentos diretos" (removido). | Testes |

**Intocados (garantia de regressão zero):** `src/standalone/LeadForm.tsx`, `useVirtualKeyboard.ts`,
`domain/`, `use-cases/`. O modo símbolos e o long-press são **internos ao componente** — o contrato
`onKey(KeyboardKey)` para o `LeadForm` não muda, então a máscara/validação/`onSubmit` continuam idênticos.

### Contratos de API (se houver)

N/A — sem rede. O **contrato interno** `VirtualKeyboardProps { layout, isShifted, onKey, visible }`
**não muda** (assinatura estável para o `LeadForm`). A composição de acentos e o toggle de símbolos são
resolvidos **dentro** do componente; o `LeadForm` continua recebendo apenas `onKey(charKey)` para inserção.

### Modelo de dados (se houver)

Extensões **aditivas e retrocompatíveis** no núcleo puro (sem persistência, sem migração):

```ts
export type KeyAction = 'char' | 'backspace' | 'clear' | 'space' | 'shift' | 'toggle-symbols'

export interface KeyboardKey {
  label: string
  value?: string
  action?: KeyAction
  widthUnits?: number
  /** Variantes de long-press (minúsculas, ordem pt-BR). Ex.: 'a' → ['á','ã','â','à','ä']. Só dados. */
  variants?: string[]
}

export interface KeyboardLayout {
  id: string
  rows: KeyboardKey[][]
  shiftRows?: KeyboardKey[][]
  shortcutsRow?: KeyboardKey[]
  /** Distribuição das teclas na fileira. 'fill' (default) = flex-grow; 'center' = largura natural + justify-center (dialpad). */
  align?: 'fill' | 'center'
}
```

- **`alpha-ptbr`** passa a ser (sem acentos diretos):
  ```
  rows[0] = 1234567890                ← fileira numérica fixa (chars com value '1'..'0')
  rows[1] = q w e r t y u i o p        (a,e,i,o,u com variants; ver Cenário 5)
  rows[2] = a s d f g h j k l ç        (c→variants ['ç']? ver nota; n→['ñ'])
  rows[3] = ⇧ z x c v b n m ⌫
  rows[4] = [?123] [espaço] [.]        (?123: action 'toggle-symbols', label '?123')
  ```
  > **Variantes:** `a→á ã â à ä`, `e→é ê è ë`, `i→í î ì ï`, `o→ó õ ô ò ö`, `u→ú û ù ü`, `c→ç`, `n→ñ`
  > (Cenário 5). As variantes são **minúsculas** no dado; a apresentação aplica `toUpperCase()` quando
  > `isShifted` (validado: `'ã'.toUpperCase()==='Ã'`, `'ç'→'Ç'`, etc. para todo o conjunto). Fonte única
  > de verdade = array minúsculo; **não** duplicar as maiúsculas no dado (YAGNI). A tecla `ç` pode
  > permanecer como tecla própria **ou** virar variante de `c` — decisão de UX do Designer; tecnicamente
  > ambas funcionam (a variante `c→['ç']` cobre o Cenário 5).
- **`symbols`** (novo, `align: 'fill'`): fileira numérica fixa no topo + 2 fileiras de símbolos + rodapé
  com tecla `ABC` (`action: 'toggle-symbols'`, label `'ABC'`). Cobrir o conjunto do Cenário 8
  (`@ # & _ - / : ; ( ) $ ! ? . ,`). Sem 2ª página (YAGNI, §2 do Design).
- **`numeric`** (dialpad): mesmas teclas de hoje (`123/456/789/⌫ 0 Limpar`) + `align: 'center'`. O
  **conteúdo não muda** (o teste "numeric tem só dígitos/backspace/limpar" continua verde); muda só a
  renderização (largura fixa, centralizado).

### Decisões técnicas (encizadas)

1. **Núcleo puro inalterado quanto a comportamento de inserção.** A seleção de variante no popup **emite
   uma char key normal** via `onKey({ label: v, value: v })` — `applyKey` a processa como qualquer
   caractere (inclusive o caminho `isShifted → value.toUpperCase()`, Cenário 7). **Nenhum** timer/DOM
   entra em `keyboardInput.ts`/`keyboardLayouts.ts`.
2. **`toggle-symbols` é presentational; `applyKey` o trata como no-op total.** O `VirtualKeyboard`
   **intercepta** teclas `action: 'toggle-symbols'` e alterna o modo **localmente** — **não** chama `onKey`
   para elas (o `LeadForm`/`applyKey` nunca recebem um toggle em runtime). Para manter o `switch` de
   `applyKey` **exaustivo e type-safe** (sem `default` que mascararia bugs), adiciona-se
   `case 'toggle-symbols': return { nextRaw: currentValue, nextShift: isShifted }` — coberto por teste
   unitário (não é código morto: é a definição total da função pura sobre a união, análoga ao `shift`).
3. **Long-press = `useLongPress` (apresentação) via pointer events.** Abordagem:
   - `onPointerDown` na tecla: inicia `setTimeout(HOLD_MS)` (`const HOLD_MS = 350`, exposto p/ tuning).
   - Atingiu 350 ms sem soltar → abre o popup (estado local: `{ key, variants, anchor }`).
   - **Seleção sem geometria:** cada variante é um `<button>` que trata o **próprio** `onPointerEnter`
     (mira) e `onPointerUp`/`onClick` (seleciona) — evita `getBoundingClientRect`/hit-test manual (que o
     jsdom não suporta) → mais limpo **e** testável.
   - `onPointerUp` antes do threshold → toque normal (emite a tecla base). `onPointerLeave`/`pointercancel`
     ou soltar fora do popup → cancela sem inserir (Cenário 4). **Limpar o timer no unmount** e a cada
     ciclo (evitar vazamento). Suprimir o `click` sintético pós-`pointerup` para não emitir 2×.
   - Teclas funcionais e teclas **sem** `variants` ignoram o long-press (apenas acionam) — Cenários 6/PO 3.
4. **Modo símbolos = estado local (`useState`/`useKeyboardMode`) no componente.** Layout efetivo:
   `effective = (mode === 'symbols' && layout.id === 'alpha-ptbr') ? LAYOUT_REGISTRY['symbols'] : layout`.
   O `VirtualKeyboard` resolve isso **internamente** (importa `LAYOUT_REGISTRY`, dado puro do mesmo módulo)
   — assim **não** toca o `LeadForm`. **`resolveLayout` por campo permanece soberano:** `tel → numeric`
   não é afetado pelo modo (o `?123` só existe no `alpha-ptbr`; em `numeric`/`email` o toggle nem aparece).
   **Resetar `mode → 'alpha'`** quando `layout.id` muda (troca de campo) via `useEffect([layout.id])`, para
   o modo não vazar entre campos.
5. **Dialpad centralizado sem magic.** A flag de dado `align: 'center'` (não checagem de `id` espalhada)
   dirige a renderização: a fileira usa `justify-center` e o `KeyButton` recebe `naturalWidth` (derivado de
   `align==='center'`) → **omite** `flexGrow`/`flexBasis` e aplica tamanho fixo (`w-[84px] h-[64px]`, classe
   de apresentação). `align: 'fill'` (default) preserva o comportamento atual de `alpha`/`email`/`symbols`.
6. **Acessibilidade.** Popup: `role="group"` + `aria-label="Variantes de <letra>"`; cada variante é
   `<button type="button">` com `aria-label` do caractere. Novas teclas funcionais nos
   `CONTROL_ARIA_LABELS`: `'toggle-symbols'` → rótulo dependente do label (`?123`→"Símbolos", `ABC`→"Letras")
   — como o mesmo `action` tem 2 rótulos, derivar o `aria-label` do `key.label`, não só do `action`.
   Manter os `aria-label` existentes (Apagar/Espaço/Maiúscula/Limpar) e `role="group" "Teclado virtual"`.
   Estado ativo nunca só por cor (shift = cor + ícone; variante mirada = cor + escala) — 1.4.1.

### Plano de testes (vitest — sem sobre-engenharia)

**Núcleo puro (rápido, determinístico):**
1. `applyKey` com char acentuado (`value: 'ã'`) → insere `'ã'`; com `isShifted` → `'Ã'`; idem `ç→Ç`, `é→É`.
   (Cobre Cenário 7 pela via real: variante emite char key.)
2. `applyKey` com `action: 'toggle-symbols'` → `nextRaw === currentValue` e `nextShift` preservado (no-op).
3. `keyboardLayouts`: `alpha-ptbr` tem a **fileira numérica** `1..0` na primeira row e **não** tem mais a
   fileira de acentos diretos; teclas `a/e/i/o/u/c/n` expõem `variants` exatamente conforme Cenário 5;
   layout `symbols` existe e cobre o conjunto do Cenário 8; `numeric` tem `align: 'center'` e o conteúdo
   inalterado. **Atualizar/remover** o teste atual "expõe acentos diretos (á, ã, é)" (vira "expõe variants").
4. `resolveLayout`: `tel → numeric` segue inalterado (Cenário 9/13).

**Integração (`VirtualKeyboard` no jsdom — usar `vi.useFakeTimers()` + pointer events):**
5. Long-press: `pointerDown` → `vi.advanceTimersByTime(350)` → popup visível (`role="group"`,
   `aria-label="Variantes de a"`); `pointerUp` antes de 350 ms → sem popup, emite `onKey('a')` (Cenário 6).
6. Seleção: com popup aberto, `pointerEnter` numa variante + `pointerUp` → `onKey` com a variante; popup
   fecha (Cenário 4). Sob shift, a variante exibida/emitida é maiúscula (Cenário 7).
7. Toggle símbolos: clicar `?123` troca para o layout `symbols` (aparece `@`, tecla `ABC`); clicar `ABC`
   volta ao alfabético; `onKey` **não** é chamado para o toggle (Cenário 8). Trocar de campo reseta p/ ABC.
8. Numérico centralizado: render com `layout numeric` → fileiras com `justify-center` e teclas **sem**
   `flexGrow` (assert de ausência de `style.flexGrow`/presença de largura fixa) (Cenário 9).
9. Fileira numérica fixa: no `alpha-ptbr`, a 1ª fileira tem `1..0` e tocar `'7'` emite `onKey('7')` (Cenário 2).

**Regressão (HUB-57/HUB-65) — devem seguir verdes sem alteração:**
10. `keyboardInput.test.ts` e `keyboardLayouts.test.ts` (exceto o de acentos diretos, atualizado) +
    `LeadForm.test.tsx` (98 testes atuais): VK abre/digita/shift, e-mail, máscara de telefone, submit.

> **Riscos de testar pointer/timing no jsdom (mitigações):** (a) jsdom tem suporte parcial a
> `PointerEvent` — usar `fireEvent.pointerDown/Up/Enter` do Testing Library e, se necessário, um polyfill
> mínimo; **não** depender de `getBoundingClientRect`/layout (por isso a seleção é por handler de cada
> variante, não por geometria). (b) Timing: **sempre** `vi.useFakeTimers()` + `advanceTimersByTime`;
> nunca `setTimeout` real em teste. (c) Garantir `vi.clearAllTimers()`/cleanup entre testes para não vazar
> o hold. (d) A validação **visual** (animações, posição/clamp do popup, ≥44px reais) fica com Designer/QA
> contra o mockup — não tentar pixel/anim no vitest.

### Considerações de performance/segurança

- **Performance:** desprezível. Um `setTimeout` por toque, limpo no `pointerup`/unmount. Popup é um nó
  pequeno renderizado sob demanda. Sem rede, sem re-render global (estado de popup/modo é local ao teclado).
- **Segurança/privacidade:** N/A — entrada local no totem, sem rede, sem secret. Nenhuma mudança na coleta
  ou validação do lead (núcleo de `applyKey`/máscara intactos).
- **Vazamento de timer (único risco real):** o `useLongPress` **deve** limpar o timeout em `pointerup`,
  `pointercancel`, troca de tecla e unmount — verificável em teste.

### Estimativa técnica

- **Story points: 8** (muito complexo, ~1 semana): interação de long-press com pointer events + popup,
  modo símbolos, dialpad, novos dados de layout e suíte de testes de integração com fake timers. Coeso —
  não recomendo quebrar, mas é o topo do que cabe numa issue.
- **Riscos técnicos:** (1) pointer/timing no jsdom (mitigado acima); (2) double-fire `pointerup`+`click`
  (suprimir o click); (3) clamp do popup nas bordas (validação visual, não testável em unit); (4) largura
  do totem retrato — ver conflito 2 abaixo.

### Conflitos Design × Critérios sinalizados

1. **Hold 350 ms (Design) × ~400–500 ms (Cenário 3/PO).** Sem conflito real: a Decisão de PO 1 **delegou**
   ao Designer refinar o valor; prevalece 350 ms, **exposto como constante** (`HOLD_MS`) para ajuste fino.
   O Cenário 3 ("aproximadamente 400–500ms") deve ser lido como faixa-alvo de UX, não valor fixo — sugiro
   o PO/QA validarem o critério com "~300–500ms" para não falhar o aceite por causa do refino.
2. **Alvo de toque ≥44px (Cenário 10) × largura do totem retrato.** A fileira de 10 teclas com
   `min-w-[44px]` + gaps exige largura útil ≳ 490px; abaixo disso, ou as teclas violam 44px de **largura**
   ou há overflow horizontal. **Ação:** Designer/Dev confirmam a largura real do container do totem; se
   < ~490px, priorizar **altura** de toque ≥44px (cumpre 2.5.5/alvo) e deixar a largura fluida em `1/10`
   (sem `min-w` rígido) — documentar a largura mínima suportada. Não bloqueia o início.
3. **`ç` como tecla própria × variante de `c`.** O layout atual tem `ç` como tecla; o Cenário 5 lista
   `c→ç` como variante. Ambos satisfazem os critérios; decisão de UX do Designer (recomendo manter `ç`
   como tecla **e** como variante de `c` é redundante — escolher um). Sinalizado para alinhamento, não bloqueia.

## Fora de Escopo

- Predição de texto / autocorreção / sugestões
- Emojis e seletor de emojis
- Múltiplos idiomas (apenas pt-BR nesta entrega)
- Long-press dos números da fileira fixa para símbolos relacionados (opcional — não obrigatório nesta entrega; pode virar issue futura)
- Alteração da lógica de validação ou do fluxo de submissão (apenas preservar)

## Definition of Done

- [ ] Layout alfabético estilo Samsung: fileira numérica fixa no topo + QWERTY 3 fileiras + shift/backspace/espaço + toggle `?123`
- [ ] Long-press → popup de variantes → seleção insere o caractere; conjunto pt-BR conforme Cenário 5
- [ ] Maiúsculas acentuadas via shift
- [ ] Modo de símbolos acessível via `?123` ↔ `ABC`
- [ ] Teclado numérico do telefone centralizado (dialpad), não esticado
- [ ] Alvo de toque ≥44×44px em todas as teclas, incluindo popup e fileira numérica
- [ ] Regressão zero sobre os 12 critérios da HUB-57 e sobre o layout da HUB-65 (cenários 11 a 14 verdes)
- [ ] Testes do núcleo puro + integração cobrindo: fileira numérica fixa, long-press/composição, toggle de símbolos, numérico centralizado e maiúsculas acentuadas
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks no PR)
- [ ] Sem código morto / sem código comentado
- [ ] Validação visual (screenshot) aprovada pelo stakeholder
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-59)
