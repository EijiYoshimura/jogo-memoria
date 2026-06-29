# Spec: HUB-65 — Layout do formulário de captura de lead fiel ao mockup BB Seguros

## Contexto

O formulário de captura de lead (`src/standalone/LeadForm.tsx`) está com o visual provisório:
título em texto (`config.leadForm.title`) na cor primária, labels brancas sem a fonte da
marca, inputs com cantos `rounded-xl` e borda roxa/transparente, e botão "Jogar" na cor
primária. O cliente (BB Seguros) forneceu o mockup `public/images/mockup formulário.png`
que define a identidade visual final, no mesmo padrão do board (HUB-63): fundo azul
`#0333BD` + moldura branca arredondada na tela.

Esta entrega ajusta **apenas o layout** do formulário para reproduzir fielmente o mockup,
incluindo a aplicação da fonte oficial Banco do Brasil. **Não há mudança na lógica de
submissão, validação ou no teclado virtual** — esses comportamentos devem permanecer
exatamente como estão (regressão zero).

## User Story

**Como** visitante de um evento da BB Seguros que vai jogar o jogo da memória,
**quero** preencher meus dados em um formulário com a identidade visual oficial da BB Seguros (logo, cores e fonte da marca),
**para que** a experiência de captura transmita confiança e seja coerente com a marca, sem perder a facilidade de uso (teclado virtual e validações).

## Critérios de Aceite

**Cenário 1: Fundo da tela `#0333BD`**
- [ ] **Dado** que o visitante abriu a tela do formulário
- **Quando** a tela é renderizada
- **Então** a cor de fundo da tela é exatamente `#0333BD` (royal blue)

**Cenário 2: Moldura branca arredondada na tela**
- [ ] **Dado** que o formulário foi renderizado
- **Quando** o visitante observa a tela
- **Então** existe uma moldura branca arredondada envolvendo a área do formulário, no mesmo padrão visual do board (HUB-63)

**Cenário 3: Logo BB Seguros no topo (substitui o título em texto)**
- [ ] **Dado** que o formulário foi renderizado
- **Quando** o visitante observa o topo da tela
- **Então** a imagem `public/images/logo_bb.png` (BB Seguros, branca) é exibida centralizada no topo
- **E** o título em texto (`config.leadForm.title`) **não** é exibido na tela
- **E** o logo é exibido sem distorção de proporção (aspect ratio preservado)

**Cenário 4: Labels em maiúsculas, brancas, itálico, fonte Banco do Brasil**
- [ ] **Dado** que o formulário foi renderizado
- **Quando** o visitante observa os rótulos dos campos
- **Então** os labels NOME, EMAIL e TELEFONE aparecem em letras maiúsculas, na cor branca, em itálico e na fonte oficial Banco do Brasil
- **E** a fonte Banco do Brasil está carregada via `@font-face` e efetivamente aplicada (não há fallback de fonte do sistema nos labels)

**Cenário 5: Inputs pill branco com borda amarela**
- [ ] **Dado** que o formulário foi renderizado
- **Quando** o visitante observa os campos de entrada
- **Então** cada input tem formato de pílula (`rounded-full`), fundo branco `#FFFFFF` e borda na cor amarela `#FCFC30`

**Cenário 6: Botão ENVIAR amarelo com texto azul**
- [ ] **Dado** que o formulário foi renderizado
- **Quando** o visitante observa o botão de ação
- **Então** o botão tem o texto "ENVIAR" (maiúsculas), formato de pílula amarela `#FCFC30` e texto azul `#0333BD`, em fonte Banco do Brasil bold

**Cenário 7: Regressão zero — teclado virtual intacto**
- [ ] **Dado** que `config.leadForm.virtualKeyboard.enabled` está `true`
- **Quando** o visitante toca em um campo
- **Então** o teclado virtual abre, digita no campo ativo, alterna shift e respeita o layout do campo, exatamente como antes desta entrega
- **E** o input continua `readOnly` com `inputMode="none"` quando o teclado virtual está habilitado

**Cenário 8: Regressão zero — validação de campos obrigatórios**
- [ ] **Dado** o formulário com campos obrigatórios vazios
- **Quando** o visitante aciona ENVIAR
- **Então** a submissão é bloqueada e cada campo obrigatório vazio exibe a mensagem `<label> é obrigatório`
- **E** `onSubmit` não é chamado

**Cenário 9: Regressão zero — validação de e-mail**
- [ ] **Dado** o campo de e-mail preenchido com um valor inválido (sem formato `texto@texto.dominio`)
- **Quando** o visitante aciona ENVIAR
- **Então** a submissão é bloqueada e o campo exibe "E-mail inválido"

**Cenário 10: Regressão zero — máscara de telefone**
- [ ] **Dado** o campo de telefone (`type=tel` com máscara)
- **Quando** o visitante digita os números (via teclado físico ou virtual)
- **Então** o valor é formatado como `(99) 99999-9999`, limitado a 11 dígitos

**Cenário 11: Submissão válida preservada**
- [ ] **Dado** todos os campos obrigatórios preenchidos corretamente
- **Quando** o visitante aciona ENVIAR
- **Então** `onSubmit` é chamado com os valores do formulário, exatamente como antes desta entrega

## Decisões do PO

1. **Título → usar o logo.** O mockup não possui título em texto. Decisão: exibir `public/images/logo_bb.png` no topo e **ocultar** o texto `config.leadForm.title` na renderização. O campo `config.leadForm.title` permanece no schema do config (não removê-lo) para não quebrar contrato/configurabilidade, mas não é renderizado nesta tela.
2. **Texto do botão → "ENVIAR".** Conforme o mockup. Substitui o texto atual "Jogar".
3. **Accent amarelo `#FCFC30` → recomendação funcional: novo token de config (`event.accentColor`), default `#FCFC30`.** Justificativa de PO: o produto é multi-evento (o config já parametriza `backgroundColor`, `primaryColor`, logo e textos por evento). Hardcodar o amarelo cria uma exceção que quebra o padrão de personalização por evento e gera dívida quando um próximo evento precisar de outra cor de accent. Funcionalmente, recomendo expor `event.accentColor` com default `#FCFC30`. **A decisão técnica final (nome do token, onde declarar, tipagem) fica com o Tech Lead** — se houver custo técnico relevante, o hardcode é aceitável como fallback, desde que registrado como tech-debt.

## Design

Referência visual de partida: `public/images/mockup formulário.png` (PNG 1191×2041 px)
Logo (asset): `public/images/logo_bb.png` (símbolo BB + "BB Seguros", arte branca, fundo transparente)

> Medidas amostradas diretamente do PNG (1191×2041) e convertidas em **proporções relativas à
> largura da tela**, para escalar fielmente em qualquer container mantendo as relações do mockup.

### Fluxo do Usuário

Tela única, vertical (de cima para baixo):
1. Moldura branca arredondada envolvendo toda a tela (mesmo padrão do board HUB-63/64).
2. Logo BB Seguros (grande, centralizado) no topo — substitui o título em texto.
3. Label **NOME** (maiúsculo, itálico, branco) → input pill.
4. Label **EMAIL** → input pill.
5. Label **TELEFONE** → input pill.
6. Botão **ENVIAR** (pill amarelo, texto azul), centralizado, abaixo dos campos.

### Tokens visuais

| Token | Valor | Uso |
|-------|-------|-----|
| `--screen-bg` | `#0333BD` | Fundo da tela (azul royal) |
| `--accent` | `#FCFC30` | Borda dos inputs, preenchimento do botão ENVIAR |
| `--frame` / texto-claro | `#FFFFFF` | Moldura da tela, labels, fundo dos inputs |
| texto-do-botão | `#0333BD` | Texto "ENVIAR" sobre o amarelo |

> O accent `#FCFC30` segue a recomendação de PO de virar `event.accentColor` (default `#FCFC30`);
> a decisão técnica final (token vs. hardcode) é do Tech Lead. No design, referenciar como "accent".

### 1. Mapeamento de fontes (Banco do Brasil)

Arquivos em `public/fonts/Banco_do_Brasil/`. Duas famílias: **Títulos** (display) e **Textos** (corpo).

| Uso na tela | Estilo no mockup | Arquivo `.ttf` | Utilitário Tailwind sugerido |
|-------------|------------------|----------------|------------------------------|
| Labels (NOME/EMAIL/TELEFONE) | maiúsculo, **bold itálico** | `BancoDoBrasilTitulos-BoldIt.ttf` | `font-bb-titulos italic font-bold uppercase` |
| Botão ENVIAR | maiúsculo, **extra-bold**, sem itálico | `BancoDoBrasilTitulos-XBold.ttf` | `font-bb-titulos font-extrabold uppercase` |
| Texto digitado nos inputs / mensagens | regular | `BancoDoBrasilTextos-Regular.ttf` (+ `-Medium` p/ ênfase) | `font-bb-textos` |

> "BB Seguros" do topo **vem do asset `logo_bb.png`**, não da fonte — não recriar em texto.

**Como expor (Tailwind v4 — `@font-face` + `@theme`):**

```css
/* @font-face — uma face por peso/estilo realmente usado */
@font-face {
  font-family: "BB Titulos";
  src: url("/fonts/Banco_do_Brasil/BancoDoBrasilTitulos-Bold.ttf") format("truetype");
  font-weight: 700; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "BB Titulos";
  src: url("/fonts/Banco_do_Brasil/BancoDoBrasilTitulos-BoldIt.ttf") format("truetype");
  font-weight: 700; font-style: italic; font-display: swap;   /* labels */
}
@font-face {
  font-family: "BB Titulos";
  src: url("/fonts/Banco_do_Brasil/BancoDoBrasilTitulos-XBold.ttf") format("truetype");
  font-weight: 800; font-style: normal; font-display: swap;    /* botão ENVIAR */
}
@font-face {
  font-family: "BB Textos";
  src: url("/fonts/Banco_do_Brasil/BancoDoBrasilTextos-Regular.ttf") format("truetype");
  font-weight: 400; font-style: normal; font-display: swap;    /* inputs/mensagens */
}

/* @theme — gera os utilitários font-bb-* */
@theme {
  --font-bb-titulos: "BB Titulos", ui-sans-serif, sans-serif;
  --font-bb-textos: "BB Textos", ui-sans-serif, sans-serif;
}
```

Assim `font-bb-titulos` + `italic` + `font-bold` resolve para `BoldIt`; `font-bb-titulos` +
`font-extrabold` resolve para `XBold` (mapeado em weight 800). Carregar **somente** os pesos/estilos
usados (Bold, BoldIt, XBold de Títulos; Regular de Textos) para não pesar o bundle (YAGNI).
Os arquivos `*.ttf:Zone.Identifier` **não** entram no commit (já previsto no DoD / `.gitignore`).

### 2. Medidas do mockup → proporções / Tailwind

Proporções relativas à **largura da tela** (W = 1191 px); alturas relativas à **altura** (H = 2041 px) quando indicado.

| Elemento | Mockup (px) | Proporção | Recomendação Tailwind |
|----------|-------------|-----------|------------------------|
| Moldura branca (espessura) | ~17 px | ~1,4% W | `border-4 border-white` (alinhar ao valor do board HUB-63/64) |
| Moldura branca (raio) | ~42 px | ~3,5% W | `rounded-[2rem]` (mesmo do board) |
| Logo — largura | ~505 px | ~42% W | `w-[42%]` (≈ `w-2/5`), `mx-auto`, `object-contain` |
| Logo — folga ao topo | ~185 px | ~9% H | `pt-[9%]` no container (ou `mt`) |
| Label — tamanho de fonte | ~55 px de altura | ~3% W | `text-2xl` (ajustar no pixel-perfect) |
| Label → input (gap) | ~40 px | ~3,4% W | `gap-2` no grupo do campo |
| Input — largura | ~980 px | ~82% W | `w-full` dentro de container com `px-[8%]` |
| Input — altura | ~115 px | ~5,6% H | `min-h-[56px]` (ver §5 — não exagerar) |
| Input — raio | pílula | metade da altura | `rounded-full` |
| Input — borda amarela | ~6 px | ~0,5% W | `border-4 border-[#FCFC30]` |
| Entre campos (grupo→grupo) | ~135 px | ~6,6% H | `gap-6` no `<form>` |
| Botão — largura | ~440 px | ~37% W | `w-[38%]` (≈ entre `w-1/3` e `w-2/5`), `mx-auto` |
| Botão — altura | ~100 px | ~4,9% H | `py-3`/`min-h-[56px]`, `rounded-full` |
| Botão — folga acima | ~175 px | ~8,5% H | `mt-8` |
| Botão — contorno branco | ~4 px | ~0,3% W | `border-4 border-white` (anel branco sobre o pill amarelo) |

Detalhe de simetria observado no mockup: **input** = pill branco com borda **amarela**; **botão** =
pill amarelo com contorno **branco** (inverso). Preservar essa inversão.

### 3. Cores

- Fundo da tela: `#0333BD` (substitui `config.event.backgroundColor` para esta tela — não usar o `#1E1B4B` herdado).
- Accent (borda dos inputs, fill do botão): `#FCFC30`.
- Branco `#FFFFFF`: moldura, labels, fundo dos inputs, contorno do botão.
- Texto do botão "ENVIAR": azul `#0333BD`.
- Texto digitado nos inputs: cinza escuro (`text-gray-900`) sobre o pill branco — mantém legibilidade (ver §6).

### 4. Moldura branca da tela

- Mesma da board (HUB-63/64): borda branca arredondada envolvendo a área do formulário.
- Tailwind: `border-4 border-white rounded-[2rem]` no container raiz (`flex flex-col h-full w-full bg-[#0333BD]`).
- Importante: a moldura fica no container externo; o conteúdo (logo + form) respeita um padding interno (`p-*`) para não encostar na borda — usar `px-[8%]` para os campos, coerente com a margem lateral do mockup.

### 5. Compatibilidade com o teclado virtual (HUB-57) — crítico

A estrutura atual tem dois modos no wrapper interno e **deve ser preservada**:
- **Com VK** (`vkEnabled`): `flex-1 justify-start` — o form ancora no topo; o `VirtualKeyboard` ocupa a metade inferior como irmão.
- **Sem VK**: `justify-center h-full` — o form centraliza verticalmente.

Cuidados para o novo layout não quebrar o VK:
- **Não exagerar alturas.** As alturas "cheias" do mockup (logo ~42% W, pills ~115 px, botão ~100 px) assumem a tela inteira. Com o VK aberto, o form vive na **metade superior** — manter os pills em `min-h-[56px]` (não os 115 px do mockup literal) e o logo com `max-h` em modo VK para os campos não serem cortados.
- **Manter `overflow-y-auto`** no wrapper do form (já existe) para que, no pior caso (telas baixas + VK), o conteúdo role em vez de empurrar/cortar campos.
- **Não introduzir `h-full`/alturas fixas** que briguem com `flex-1 min-h-0`; o wrapper do form deve poder encolher quando o VK aparece.
- **Botão sempre alcançável:** com VK aberto, ENVIAR pode ficar abaixo da dobra — garantir que seja atingível via scroll; não usar `position: fixed`.
- **Não tocar** na renderização do `<VirtualKeyboard>` nem na lógica de `activeFieldId`/`readOnly`/`inputMode` — é só layout visual dos campos.
- Sugestão: usar gaps/tamanhos um pouco menores quando `vkEnabled` (ex.: logo `w-[30%]` vs `w-[42%]`, `gap-4` vs `gap-6`) para caber sem corte. Decisão de tuning fica para a revisão pixel-perfect.

### 6. Estados e Acessibilidade (WCAG 2.1 AA)

**Estados dos inputs:**
- **Vazio (placeholder):** o mockup mostra inputs **sem texto de placeholder** — o label externo já identifica o campo. Decisão: **sem placeholder**. Se um placeholder for necessário, usar `text-gray-500` (contraste ≥ 4,5:1 sobre branco).
- **Foco:** foco **visível** obrigatório (AA 2.4.7). Sobre o pill branco, escurecer/realçar a borda — ex.: `focus:border-[#0333BD]` (azul) ou `focus:ring-2 focus:ring-[#0333BD]`. Não remover outline sem substituto. (Trocar o `focus:border-purple-400` atual.)
- **Erro:** borda do pill passa de amarela para vermelha (`border-red-500`) + mensagem `<label> é obrigatório` / "E-mail inválido" abaixo do campo. A mensagem de erro **não** deve ficar em `text-red-400` sobre o azul (contraste ~4,5:1 limítrofe) — usar um vermelho claro de alto contraste (ex.: `text-[#FFC7C7]`) ou texto branco com ícone, garantindo ≥ 4,5:1 sobre `#0333BD`. Associar via `aria-describedby`/`aria-invalid` (recomendação para o Dev Front; preserva a lógica de validação atual).

**Contraste (todas as combinações da tela):**
- Branco `#FFFFFF` sobre azul `#0333BD` → ≈ **8,6:1** (labels, moldura) — passa AA/AAA.
- Amarelo `#FCFC30` sobre azul `#0333BD` → ≈ **10,5:1** (borda do input, fill do botão) — passa folgado; como elemento de UI (não-texto) exige só 3:1.
- Azul `#0333BD` sobre amarelo `#FCFC30` (texto "ENVIAR") → ≈ **10,5:1** — excelente.
- Texto digitado `text-gray-900` sobre branco → passa AA.

**Outros:**
- Labels já usam `<label htmlFor>` ligados ao input — manter (leitor de tela anuncia o campo).
- Logo é informativo → `alt="BB Seguros"` (não vazio); exibido com `object-contain`, sem distorção.
- Navegação por teclado físico: ordem natural NOME → EMAIL → TELEFONE → ENVIAR já correta pela ordem do DOM — não reordenar.

### Componentes do Design System utilizados

- **Reutilizados/ajustados:** `LeadForm` (layout dos campos e botão), `VirtualKeyboard` (intacto).
- **Novos componentes:** nenhum. Entrega é re-skin visual + carregamento de fonte; sem novo componente.
- **Novos tokens/utilitários:** famílias `font-bb-titulos` e `font-bb-textos` (via `@font-face`+`@theme`) e o accent `#FCFC30` (token a definir pelo Tech Lead).

### Responsividade / proporção

- Medidas em proporções (`w-[42%]`, `px-[8%]`, `w-[38%]`, `rounded-full`, `border-4`) acompanham a largura do container retrato sem quebrar as relações do mockup.
- **Mobile (320px+):** layout idêntico em coluna única; logo e pills encolhem proporcionalmente; em telas muito baixas com VK, o `overflow-y-auto` garante acesso a todos os campos.
- **Tablet/Desktop:** manter a largura máxima do form (`max-w-lg mx-auto`, já presente) para o pill não esticar além do proporcional ao mockup.

### Resumo das classes Tailwind sugeridas

- **Container raiz** (`LeadForm`): `flex flex-col h-full w-full bg-[#0333BD] border-4 border-white rounded-[2rem]`.
- **Wrapper do form** (manter os 2 modos): `flex flex-col items-center w-full px-[8%] overflow-y-auto ${vkEnabled ? 'flex-1 justify-start' : 'justify-center h-full'}` + `max-w-lg`.
- **Logo** (`<img>`): `w-[42%] mx-auto object-contain mt-[9%] mb-8` + `alt="BB Seguros"` (remover o `<h1>` do título).
- **Grupo de campo:** `flex flex-col gap-2`.
- **Form:** `flex flex-col gap-6`.
- **Label:** `font-bb-titulos italic font-bold uppercase text-white text-2xl`.
- **Input:** `w-full rounded-full bg-white text-gray-900 border-4 border-[#FCFC30] px-5 min-h-[56px] outline-none focus:border-[#0333BD]` (erro: `border-red-500`).
- **Botão:** `mt-8 mx-auto w-[38%] rounded-full bg-[#FCFC30] border-4 border-white text-[#0333BD] font-bb-titulos font-extrabold uppercase min-h-[56px]` + texto `ENVIAR`.

> Tamanhos de fonte, gaps e alturas são pontos de partida fiéis às proporções medidas; ajustar no
> pixel-perfect (Designer + Dev Front), respeitando os cuidados de VK da §5.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. Entrega de **re-skin visual + carga de fonte na camada
> de apresentação**. Nada de domínio, use-cases, validação ou teclado virtual muda de comportamento —
> apenas classes/estilos, um asset de fonte, um token de config opcional e a atualização dos testes de
> rótulo afetados pela troca do texto do botão. As dependências continuam apontando para dentro.

### Arquitetura envolvida

- **Camada impactada: apenas Presentation.** Domain (`src/game/domain/*`), use-cases e o módulo do
  teclado virtual (`src/lead-capture/keyboard/*`) permanecem **intactos** — regra de dependência da
  Clean Architecture preservada (nenhum import novo de fora para dentro).

| Arquivo | Responsabilidade nesta entrega |
|---------|--------------------------------|
| `src/index.css` | Declarar `@font-face` (só as faces usadas) + bloco `@theme` com `--font-bb-titulos`/`--font-bb-textos`. Único ponto de carga de fonte. |
| `src/game/types.ts` | Adicionar `event.accentColor?: string` (opcional, retrocompatível). |
| `public/config.json` | Adicionar `"accentColor": "#FCFC30"` em `event`. |
| `src/standalone/LeadForm.tsx` | Re-skin: container com moldura branca + fundo azul (via config), trocar `<h1>{title}` pelo `<img>` do logo (`alt="BB Seguros"`), labels com fonte BB, inputs pill com borda accent, botão `ENVIAR` accent. **Sem** tocar em `handleChange`/`validate`/`handleSubmit`/`handleVirtualKey` nem na renderização do `<VirtualKeyboard>`. |
| `public/fonts/Banco_do_Brasil/*.ttf` | Versionar **somente as 3 faces usadas** (ver abaixo). |
| `src/standalone/__tests__/LeadForm.test.tsx` | **Atualização obrigatória** dos seletores de botão `'Jogar'`→`'ENVIAR'` (3 ocorrências) — ver Plano de testes. |

**Decisão — `event.primaryColor` (roxo `#7C3AED`) é mantido.** O `LeadForm` deixa de usá-lo (logo
substitui o título; botão passa a accent), mas `primaryColor` **continua em uso** em `SplashScreen`,
`ConsentScreen`, `PrivacyPolicyScreen` e `ResultScreen`. Portanto **não** é código morto e **não** deve
ser removido de `types.ts`/`config.json`. Apenas as 2 referências dentro do `LeadForm` (`<h1>` e `<button>`)
saem. Confirmado por `grep` no code review do baseline.

### Carga da fonte (Tailwind v4 — `@font-face` + `@theme`)

- **Onde:** em `src/index.css`, **após** `@import "tailwindcss";` (linha 1). Os `@font-face` podem vir
  logo após o import; o bloco `@theme` registra os tokens que viram utilitários `font-bb-*`.
- **`font-display: swap`** em todas as faces — evita FOIT (texto invisível) numa tela de captura; o
  fallback `ui-sans-serif` aparece e é trocado ao carregar. Aceitável para labels/botão.
- **Paths same-origin:** `url("/fonts/Banco_do_Brasil/<arquivo>.ttf") format("truetype")`. Fontes
  **self-hosted** (sem CDN externo) — bom para privacidade/LGPD (zero request a terceiros) e offline (totem).
- **YAGNI — apenas 3 faces** (a §1 do Design lista 4; a face `Titulos-Bold` *normal* 700 **não** é usada
  por nenhum elemento e deve ser omitida):

  | Família (`font-family`) | weight / style | Arquivo `.ttf` | Consumido por |
  |--------------------------|----------------|----------------|----------------|
  | `"BB Titulos"` | 700 / italic | `BancoDoBrasilTitulos-BoldIt.ttf` | labels (`font-bb-titulos italic font-bold`) |
  | `"BB Titulos"` | 800 / normal | `BancoDoBrasilTitulos-XBold.ttf` | botão ENVIAR (`font-bb-titulos font-extrabold`) |
  | `"BB Textos"` | 400 / normal | `BancoDoBrasilTextos-Regular.ttf` | texto dos inputs / mensagens (`font-bb-textos`) |

  ```css
  @import "tailwindcss";

  @font-face { font-family:"BB Titulos"; src:url("/fonts/Banco_do_Brasil/BancoDoBrasilTitulos-BoldIt.ttf") format("truetype"); font-weight:700; font-style:italic;  font-display:swap; }
  @font-face { font-family:"BB Titulos"; src:url("/fonts/Banco_do_Brasil/BancoDoBrasilTitulos-XBold.ttf") format("truetype"); font-weight:800; font-style:normal; font-display:swap; }
  @font-face { font-family:"BB Textos";  src:url("/fonts/Banco_do_Brasil/BancoDoBrasilTextos-Regular.ttf") format("truetype"); font-weight:400; font-style:normal; font-display:swap; }

  @theme {
    --font-bb-titulos: "BB Titulos", ui-sans-serif, sans-serif;
    --font-bb-textos:  "BB Textos", ui-sans-serif, sans-serif;
  }
  ```

- **Higiene de assets (bloqueante no review):**
  - Versionar **somente as 3 `.ttf` acima**. **Não** commitar as outras ~37 faces nem o subdiretório
    `public/fonts/Banco_do_Brasil/Nova fonte/` (dump de fontes extras) — YAGNI/zero peso morto no repo.
    Usar `git add` explícito dos 3 arquivos; **não** `git add public/fonts/` em massa.
  - Os `*.ttf:Zone.Identifier` (lixo do WSL, presentes no FS) **não** entram no commit — já cobertos
    pela regra `*:Zone.Identifier` no `.gitignore` (linha 35). Confirmar `git status` limpo desses sidecars.

### Config — novo token `event.accentColor`

- **`types.ts`:** adicionar em `GameConfig.event` o campo opcional, documentado:
  ```ts
  /** Cor de destaque do evento (HUB-65). Opcional/retrocompatível.
   *  Ausente ⇒ usa o default da apresentação (#FCFC30). Usado em borda dos inputs e fill do botão ENVIAR. */
  accentColor?: string
  ```
  Opcional para **não quebrar** configs existentes (mesmo padrão de `timerEnabled?`/`virtualKeyboard?`).
- **`config.json`:** `"accentColor": "#FCFC30"` dentro de `event`.
- **Consumo no componente:** ler `config.event.accentColor` com fallback para uma constante nomeada
  (sem magic string):
  ```ts
  const DEFAULT_ACCENT_COLOR = '#FCFC30'
  const accent = config.event.accentColor ?? DEFAULT_ACCENT_COLOR
  ```
  Aplicar o accent via `style` inline (coerente com o padrão já usado para `backgroundColor`/`primaryColor`
  no projeto), ex.: input `style={{ borderColor: accent }}`, botão `style={{ backgroundColor: accent }}`.
  Evita classe arbitrária com valor hardcoded e mantém a configurabilidade por evento que o PO pediu.
  As demais cores fixas da marca nesta tela (fundo azul vem de `config.event.backgroundColor`; branco e o
  azul do texto do botão) podem ficar em utilitários Tailwind — só o **accent** precisa de token de config.

### Contratos de API (se houver)

N/A — sem rede, sem endpoints. Assinaturas de props (`LeadFormProps { config, onSubmit }`) **não mudam**.
A forma de `config.leadForm.fields` e o contrato de `onSubmit(values)` permanecem idênticos.

### Modelo de dados (se houver)

N/A para persistência. Única mudança de tipo: `GameConfig.event.accentColor?: string` (aditiva, opcional,
sem migração). `config.leadForm.title` **permanece** no schema (decisão do PO) — apenas deixa de ser renderizado.

### Compatibilidade com o teclado virtual (HUB-57) — invariantes a preservar

Reforço dos cuidados do Designer (§5), em forma de invariantes verificáveis no review:

1. **Manter os 2 modos do wrapper:** `vkEnabled ? 'flex-1 justify-start' : 'justify-center h-full'`. Não
   trocar por `h-full`/altura fixa que impeça o form de encolher quando o VK abre (`flex-1 min-h-0`).
2. **Manter `overflow-y-auto`** no wrapper do form (scroll no pior caso: tela baixa + VK).
3. **Alturas do mockup são "tela cheia":** usar `min-h-[56px]` nos pills (não os ~115 px literais) e o
   logo com `max-h`/largura menor em modo VK, para os campos não serem cortados.
4. **Não tocar** em `activeFieldId`, `readOnly={vkEnabled}`, `aria-readonly`, `inputMode` (`'none'` com VK),
   nos handlers `onClick/onFocus` que chamam `setActiveField`, nem na renderização condicional do
   `<VirtualKeyboard ... />`. Botão **sem** `position: fixed` (deve ser alcançável por scroll).
5. O `role="group" name="Teclado virtual"` (asserção dos testes) deve continuar existindo — não mexer no VK.

### Plano de testes (vitest — sem sobre-engenharia)

Cobertura nova (em `LeadForm.test.tsx` ou um `leadform-layout.test.tsx` irmão):

1. **Logo presente / título oculto:** `<img alt="BB Seguros">` no documento **e** o texto de
   `config.leadForm.title` **não** renderizado (`queryByText(title)` ⇒ null).
2. **Labels com fonte BB:** os labels expõem a classe `font-bb-titulos` (e `italic`/`uppercase`).
3. **Input pill com borda accent:** input tem `rounded-full` e `style.borderColor` resolvendo ao accent
   (`rgb(252, 252, 48)` para `#FCFC30`), no estado sem erro.
4. **Botão ENVIAR:** existe `getByRole('button', { name: 'ENVIAR' })` com fill accent
   (`style.backgroundColor` = accent) e fonte `font-bb-titulos`.
5. **Regressão obrigatória (cenários 7–11):** reaproveitar os testes existentes de `LeadForm.test.tsx`
   (VK abre/digita/shift via `role="group" "Teclado virtual"`, obrigatórios, e-mail inválido, máscara,
   submit válido) e os de `src/lead-capture/keyboard/__tests__/*` — **todos continuam verdes**.

> **Atualização necessária e legítima (não é regressão mascarada):** os 3 seletores
> `getByRole('button', { name: 'Jogar' })` em `LeadForm.test.tsx` (linhas ~123, 146, 157) **devem** passar
> a `'ENVIAR'`, pois o Cenário 6 troca o rótulo do botão. Trocar o **nome acessível** é parte da spec, não
> burla do gate. Proibido qualquer `eslint-disable`/`@ts-ignore`/`skip` para "passar". Não criar snapshot de
> DOM inteiro nem assert de estilo computado de browser (frágil). Gate completo (eslint+tsc+vitest) **verde**.

### Considerações de performance/segurança

- **Performance:** +3 arquivos `.ttf` self-hosted, `font-display: swap` (sem bloqueio de render). Sem novas
  requisições de dados, sem re-render extra, sem N+1. **Nota/otimização opcional (não bloqueia):** TTF é mais
  pesado que WOFF2; converter as 3 faces para `.woff2` reduziria o payload — registrar como **tech-debt**
  de performance se o peso incomodar no totem, fora do escopo desta issue.
- **Segurança/LGPD:** fontes same-origin (zero terceiros), sem entrada de rede, sem secret. `accentColor`
  vem do `config.json` versionado e confiável. Nenhuma mudança na coleta/validação de dados do lead.
- **Escalabilidade:** N/A (tela estática); o accent por evento melhora a configurabilidade multi-evento.

### Estimativa técnica

- **Story points: 3** (moderado, ~1 dia): fiação de fonte + re-skin + token + atualização de testes.
- **Riscos técnicos:**
  1. **Regressão do VK** (maior risco) — mitigar com as invariantes acima e os testes de regressão verdes.
  2. **Fonte não aplica** (path/format/peso-estilo errado) — validar visualmente e com o teste de classe.
  3. **Quebra dos testes de botão** — endereçada explicitamente no Plano de testes (`'Jogar'`→`'ENVIAR'`).
  4. **`git add` em massa** trazer fontes/Zone.Identifier indevidos — mitigar com `add` explícito dos 3 `.ttf`.

### Conflitos Design × Critérios sinalizados

1. **Espessura/raio da moldura — inconsistência com o board já mergeado (HUB-64).** O Design (§2/§4/Resumo)
   pede `border-4 border-white rounded-[2rem]` "alinhado ao board", mas o board **final em master** (HUB-64)
   usa `border-8 border-white rounded-[2.25rem]`. Para coerência visual real entre as duas telas, **recomendo
   `border-8 ... rounded-[2.25rem]`** no form. **Ação:** Designer confirma o valor antes do dev fechar o
   pixel-perfect; não bloqueia o início (qualquer um dos dois satisfaz o Cenário 2, que é agnóstico ao valor).
2. **Accent: token vs. valor nos critérios.** Os Cenários 5/6 citam `#FCFC30` literal; o PO pede token
   `event.accentColor`. **Sem conflito real:** com default `#FCFC30`, ambos os caminhos satisfazem os
   critérios (que são agnósticos quanto à origem do valor). Prevalece o token (decisão acima).
3. **`text-red-400` em erro/asterisco.** O Design (§6) corretamente pede vermelho de alto contraste sobre o
   azul; o código atual usa `text-red-400` no asterisco e na mensagem. Ajustar para o vermelho claro indicado
   (ex.: `text-[#FFC7C7]`) é melhoria de acessibilidade dentro do escopo — aplicar.

## Fora de Escopo

- Lógica de submissão e persistência do lead (`onSubmit`)
- Implementação do teclado virtual (HUB-57) — apenas **não quebrar**
- Regras de validação (obrigatórios, e-mail, máscara de telefone) — apenas **preservar**, não alterar
- Estrutura/origem dos campos (`config.leadForm.fields`) — permanece inalterada
- Remoção do campo `config.leadForm.title` do schema (apenas deixa de ser renderizado)

## Definition of Done

- [ ] Formulário fiel ao mockup: fundo `#0333BD`, moldura branca arredondada, logo BB no topo, labels em maiúsculas/itálico/fonte BB, inputs pill brancos com borda amarela `#FCFC30`, botão "ENVIAR" amarelo com texto azul
- [ ] Fonte Banco do Brasil carregada via `@font-face` e efetivamente aplicada
- [ ] Arquivos `:Zone.Identifier` não versionados (conforme `.gitignore`)
- [ ] Teclado virtual (HUB-57) e validações intactos — regressão zero (cenários 7 a 11 verdes)
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks anexada no PR)
- [ ] Sem código morto / sem código comentado
- [ ] Validação visual (screenshot) aprovada pelo stakeholder
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-65)
