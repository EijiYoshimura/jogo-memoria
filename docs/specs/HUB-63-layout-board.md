# Spec: HUB-63 — Layout do board fiel ao mockup BB Seguros

## Contexto

O layout atual do board do jogo da memória (`src/game/index.tsx`, `Board.tsx`, `Card.tsx`)
está em estado provisório: contém moldura de debug (`border-4 border-blue-500`), fundo
herdado do config (`#1E1B4B`), cards sem moldura branca e código morto comentado.

O cliente (BB Seguros) forneceu um mockup de referência (`public/images/mockup_board.png`)
que define a identidade visual final do board. Esta entrega ajusta o layout para reproduzir
fielmente esse mockup. Trata-se de uma tarefa de **UI/layout puro** — nenhuma regra de jogo
(flip, match, timer) é alterada.

## User Story

**Como** jogador do jogo da memória da BB Seguros,
**quero** ver o board com a identidade visual oficial (fundo azul, logo no topo e cards com moldura branca),
**para que** a experiência seja fiel à marca BB Seguros e visualmente coerente com o material de referência.

## Critérios de Aceite

**Cenário 1: Cor de fundo do board**
- [ ] **Dado** que o jogador abriu a tela do jogo da memória
- **Quando** o board é renderizado
- **Então** a cor de fundo da área do jogo é exatamente `#0333BD` (royal blue)
- **E** não é mais exibida a cor anterior `#1E1B4B`

**Cenário 2: Header com o logo no topo**
- [ ] **Dado** que o jogador abriu a tela do jogo da memória
- **Quando** o board é renderizado
- **Então** a imagem `public/images/logo_jogo_memoria.png` é exibida no topo do board, acima do grid
- **E** o logo aparece centralizado horizontalmente
- **E** o logo é exibido por completo, sem corte ou distorção de proporção (aspect ratio preservado)

**Cenário 3: Grid 3 colunas × 4 linhas**
- [ ] **Dado** que o board foi renderizado
- **Quando** o jogador observa a área de cards
- **Então** os 12 cards (6 pares) estão dispostos em uma grade de exatamente 3 colunas por 4 linhas
- **E** o espaçamento entre os cards é uniforme em todas as linhas e colunas

**Cenário 4: Moldura branca arredondada nos cards**
- [ ] **Dado** que o board foi renderizado
- **Quando** o jogador observa qualquer card
- **Então** o card mantém aspecto quadrado (proporção 1:1)
- **E** possui uma moldura branca arredondada envolvendo a imagem
- **E** os cantos da moldura são arredondados (border-radius aplicado)

**Cenário 5: Ausência da border de debug**
- [ ] **Dado** que o board foi renderizado
- **Quando** se inspeciona o container do jogo
- **Então** não existe nenhuma moldura de debug (`border-4 border-blue-500`) visível ou no código (`index.tsx`)

**Cenário 6: Botão COMEÇAR ausente (fora de escopo)**
- [ ] **Dado** que o board foi renderizado conforme esta entrega
- **Quando** o jogador observa a tela
- **Então** nenhuma alteração relacionada ao botão "COMEÇAR" foi introduzida por esta entrega (não é objeto deste trabalho)

## Design

Referência visual de partida: `public/images/mockup_board.png`
Logo (asset final): `public/images/logo_jogo_memoria.png` (arte branca sobre fundo transparente — "JOGO DA MEMÓRIA" + divisória vertical + "BB SEGUROS")

> Especificação derivada por amostragem direta do PNG do mockup (1191×2041 px). As medidas
> absolutas do mockup são convertidas em **proporções relativas à largura do board**, para que
> o layout escale fielmente em qualquer largura de container mantendo as relações visuais.

### Fluxo do Usuário

Tela única, estática quanto ao layout (não há navegação nesta entrega):
1. Jogador abre a tela do jogo → board renderiza com fundo azul royal.
2. Logo "JOGO DA MEMÓRIA | BB SEGUROS" no topo, centralizado.
3. Abaixo, grade 3×4 com os 12 cards (moldura branca). Interação de flip já existe e não muda aqui.

### Tokens visuais

| Token | Valor | Uso |
|-------|-------|-----|
| `--board-bg` | `#0333BD` | Fundo do container do jogo (azul royal) |
| `--card-frame` | `#FFFFFF` | Moldura branca envolvendo a imagem do card |

> A cor anterior `#1E1B4B` (herdada de `config.event.backgroundColor`) **não** deve mais pintar
> o board. O fundo `#0333BD` é fixo para esta tela — usar valor explícito (`bg-[#0333BD]`), não o config.

### 1. Cor de fundo do container

- Container raiz do jogo (`MemoryGame`, `src/game/index.tsx`): fundo sólido `#0333BD`.
- Tailwind sugerido: `bg-[#0333BD]` (substitui o `style={{ backgroundColor: config.event.backgroundColor }}`).
- Remover a moldura de debug `border-4 border-blue-500` e o `rounded-lg` associado do container raiz.

### 2. Header / Logo

Proporções medidas no mockup (board = 100% da largura):

| Propriedade | Mockup (px) | Proporção | Recomendação |
|-------------|-------------|-----------|--------------|
| Largura do logo | ~895 px | ~75% da largura do board | `w-3/4` |
| Margem horizontal (centralização) | simétrica | centralizado | `mx-auto` |
| Folga acima do logo (topo do board → logo) | ~120 px | ~10% da largura | `pt-[8%]` ou `mt` equivalente |
| Folga abaixo do logo (logo → 1ª linha de cards) | ~95 px | ~8% da largura | usar o mesmo `gap` do board (ver §3) |

- Alinhamento: **centralizado horizontalmente** (`flex justify-center` no wrapper + `mx-auto`).
- **`object-contain`** (não `object-cover`): o critério de aceite exige logo **sem corte nem distorção**.
  O `object-cover` atual pode recortar — trocar para `object-contain`.
- A imagem do logo tem fundo transparente; ela assenta diretamente sobre o azul `#0333BD`.
- Abordagem Tailwind do `<img>`: `className="w-3/4 mx-auto object-contain"` e manter `draggable={false}`.
- `alt` deve descrever o conteúdo real: `alt="Jogo da Memória — BB Seguros"` (corrigir o `alt="Verso da carta"` atual, que está incorreto para o logo).

### 3. Grid (3 colunas × 4 linhas)

Proporções medidas no mockup:

| Propriedade | Mockup (px) | Proporção (rel. à largura do board) | Recomendação |
|-------------|-------------|-------------------------------------|--------------|
| Padding externo lateral do board | ~95 px | ~8% | `px-[8%]` (ou `p-5`/`p-6` no container) |
| Gap entre cards (horizontal e vertical) | ~75–80 px | ~6,5% da largura / ≈25% da largura de um card | `gap-5` (1,25rem) como ponto de partida |
| Largura de um card | ~280 px | ~23,5% (≈ 1/3 do espaço útil) | derivada de `grid-cols-3` + gap |

- Estrutura: `grid grid-cols-3 gap-5 w-full`.
- O gap é **uniforme** em linhas e colunas (mockup confirma espaçamento igual nos dois eixos) → usar um único `gap`.
- O padding externo lateral pode viver no container do board (não no grid) — manter consistência com a folga lateral do logo.
- **Não** usar `h-full` no grid forçando o esticamento vertical das linhas (o código atual usa `h-full`,
  o que deforma os cards). As linhas devem ter altura derivada do `aspect-square` de cada card (ver §4).

### 4. Card — imagem com moldura embutida

> **Importante:** a moldura branca arredondada (borda branca + cantos arredondados + leve sombra)
> **já está embutida na própria imagem** de cada card (`public/images/card_0X.png` — confirmado
> abrindo `card_01.png`). Portanto **NÃO** se deve recriar moldura branca via CSS (`bg-white`/padding).
> O card apenas exibe a imagem como ela é; a moldura do mockup vem do asset, não do CSS.

Proporções medidas (card = ~280 px no mockup, já incluindo a moldura embutida na imagem):

| Propriedade | Mockup | Proporção (rel. ao card) | Recomendação Tailwind |
|-------------|--------|--------------------------|------------------------|
| Aspecto | quadrado | 1:1 | `aspect-square` na raiz do card |
| Moldura branca | embutida na imagem | — | **nenhuma classe CSS** (vem do PNG) |
| Border-radius (CSS) | imagem já tem cantos próprios | — | opcional/cosmético: `rounded-xl` leve |
| Preenchimento da imagem | preenche o card | — | `w-full h-full object-contain` |

Anatomia do card:
1. **Raiz do card**: `aspect-square` garante 1:1 independentemente da largura da coluna e mantém o alinhamento do grid 3×4.
2. **Imagem (frente e verso)**: ocupa o card com `w-full h-full`. Como a imagem já contém a moldura branca + cantos arredondados, **não há fundo branco nem padding CSS**. Preferir `object-contain` para não recortar a borda branca/cantos embutidos (se a imagem for exatamente 1:1, `object-cover` é equivalente — o essencial é não cortar a moldura do asset).
3. **Border-radius CSS**: opcional. Um `rounded-xl` leve pode ser mantido apenas para conter o overlay de `matched` em cantos suaves; **não** cria moldura nem fundo branco.

Ajustes pontuais no `Card.tsx` para fidelidade:
- A raiz do card deve ser quadrada: adicionar `aspect-square` (hoje o card depende da altura do grid).
- As faces (`absolute inset-0`) **não** recebem `bg-white` nem padding — exibem a imagem diretamente. Manter `overflow-hidden` + `rounded-xl` apenas para o recorte do overlay.
- As imagens precisam de `h-full` (hoje têm só `w-full object-cover`, sem garantir o quadrado): usar `w-full h-full object-contain`.
- O overlay de `matched` (`✓`) cobre a imagem (`absolute inset-0`) e acompanha o `rounded-xl` da face — não depende de nenhuma moldura branca CSS.
- Substituir `bg-opacity-40` (deprecado no Tailwind v4) por `bg-green-400/40`.

### Estados

- [x] **Estado padrão (verso)**: card exibe o verso (`cardBack`); a moldura branca já vem embutida na imagem.
- [x] **Estado virado (frente)**: flip 3D (já implementado) revela a imagem do par (com sua moldura embutida).
- [x] **Estado matched**: overlay verde translúcido (`bg-green-400/40`) com `✓`, contido pelo `rounded-xl` da face.
- [n/a] **Loading / erro / vazio**: não se aplicam a esta entrega (layout estático; sem fetch nesta tela).

### Componentes do Design System utilizados

- **Reutilizados**: `Board` (grid), `Card` (imagem + flip) — ajuste de classes, sem novos componentes.
- **Novos componentes**: nenhum. A entrega é refinamento visual dos componentes existentes.

### Acessibilidade (WCAG 2.1 AA)

- **Contraste**: o logo é arte branca (`#FFFFFF`) sobre `#0333BD` → razão ≈ 8,6:1, acima do mínimo AA (4,5:1 para texto). A moldura branca embutida nas imagens dos cards sobre o fundo azul também tem contraste amplo.
- **`alt` correto**: o `<img>` do logo deve ter `alt="Jogo da Memória — BB Seguros"`. As imagens dos cards já possuem `alt` ("Frente da carta" / "Verso da carta") — manter.
- **Navegação por teclado**: fora do escopo desta entrega de layout (não introduzir regressão). Recomendação para issue futura: tornar o card focável (`role="button"`, `tabIndex={0}`, ativação por Enter/Espaço).
- **Imagens decorativas vs. informativas**: o logo é informativo (identidade) → `alt` descritivo, não vazio.

### Responsividade / proporção

Contexto de montagem (`src/game/index.tsx`): o board é renderizado dentro de `flex flex-col h-full w-full`,
e o `Board` ocupa `flex-1 min-h-0`. O board é exibido em container retrato (estilo mobile) dentro do Hub.

- **Cards sempre quadrados**: garantido por `aspect-square` em cada card (não por altura do grid). Isso é o ponto-chave — remover o `h-full` do grid evita a deformação atual.
- **Escala fluida**: todas as medidas estão em proporções relativas (`w-3/4`, `grid-cols-3`, `gap-5`, `px-[8%]`), então o layout acompanha a largura do container sem quebrar as relações do mockup.
- **Mobile (320px+)**: layout idêntico (3 colunas), cards encolhem proporcionalmente mantendo 1:1; gap e padding em proporção.
- **Tablet / Desktop**: o board mantém a mesma grade 3×4 dentro do container do Hub; não há reflow de colunas (o mockup define 3 colunas fixas). Se o container crescer muito, limitar a largura máxima do board (ex.: `max-w-md mx-auto`) preserva a proporção do mockup.

### Resumo das classes Tailwind sugeridas

- **Container do jogo** (`index.tsx`): `flex flex-col h-full w-full bg-[#0333BD] px-[8%] pt-[8%] gap-5` (sem `border-4 border-blue-500`).
- **Logo** (`<img>`): `w-3/4 mx-auto object-contain` + `alt="Jogo da Memória — BB Seguros"`.
- **Grid** (`Board.tsx`): `grid grid-cols-3 gap-5 w-full` (remover `h-full`).
- **Card raiz** (`Card.tsx`): `relative aspect-square cursor-pointer select-none`.
- **Faces do card**: `absolute inset-0 overflow-hidden rounded-xl` (sem `bg-white`, sem padding).
- **Imagens do card**: `w-full h-full object-contain`.
- **Overlay matched**: `absolute inset-0 bg-green-400/40 rounded-xl flex items-center justify-center`.

> Os valores de `gap`, raios e `aspect-square` são pontos de partida fiéis às proporções medidas; durante a
> revisão pixel-perfect (Designer + Dev Front), ajustar dentro das faixas indicadas se necessário.
> A moldura branca dos cards vem do próprio asset PNG — nunca recriar via CSS.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-28. Entrega de **layout puro na camada de apresentação** —
> nenhuma alteração em `domain/` (entities, value-objects) ou `domain/use-cases/`. As dependências
> continuam apontando para dentro: a apresentação consome `GameSession`/`Card` e os use-cases
> (`startGame`, `flipCard`, `resetFlippedCards`) sem alterá-los.

### Arquitetura envolvida

- **Camada impactada:** apenas **Presentation** (`src/game/index.tsx`, `src/game/components/`).
  Domain e Application permanecem intactos — confirma aderência à Clean Architecture (regra de
  dependência preservada; nenhum import novo de fora para dentro).

| Arquivo | Responsabilidade nesta entrega |
|---------|--------------------------------|
| `src/game/index.tsx` | Container `MemoryGame`. Ajustar fundo, header/logo (`object-contain` + `alt` correto), remover `border-4 border-blue-500 rounded-lg` de debug e **remover código morto** (handlers `handleTick`/`handleTimeout`, `setTimeout` no-op da linha 46, import comentado do `Timer`, divs/comentários vazios do header de pares). |
| `src/game/components/Board.tsx` | Grid. Fixar `grid-cols-3 gap-5 w-full` (remover `h-full`), **remover código morto** (`getGridColumns` comentado, prop `totalPairs` comentada, `const columns`/`gridTemplateColumns` dinâmicos e o `<div>` de teste comentado). Colunas fixas em 3 conforme mockup. |
| `src/game/components/Card.tsx` | Face do card. Adicionar `aspect-square` na raiz; imagens `w-full h-full object-contain`; trocar `bg-opacity-40` (deprecado no Tailwind v4) por `bg-green-400/40`. **Não** adicionar moldura branca via CSS (já embutida no PNG). |
| `public/config.json` | `event.backgroundColor`: `#1E1B4B` → `#0333BD` (ver decisão sobre fundo abaixo). |

### Contratos de API (se houver)

N/A — não há chamadas de rede nem novos endpoints. A tela consome apenas assets estáticos
(`/images/*.png`) e o `config.json` já carregado. As assinaturas de props (`BoardProps`,
`CardProps`, `MemoryGameProps`) **não mudam** — apenas se removem campos comentados que já
estavam fora do contrato efetivo.

### Modelo de dados (se houver)

N/A — nenhuma mudança em entidades (`Card`, `GameSession`) nem migração. A forma dos dados
permanece idêntica.

### Decisões técnicas

1. **Origem do fundo `#0333BD` — manter via config (DECISÃO DO TECH LEAD, diverge do texto de Design).**
   O `index.tsx` já lê `config.event.backgroundColor` e toda a aplicação é **dirigida por configuração
   por evento** (nome, cores, cards). Hardcodar `bg-[#0333BD]` quebra essa configurabilidade e introduz
   um valor de marca fixo na camada de apresentação — um evento diferente não conseguiria trocar o fundo
   sem alterar código. **Recomendação:** atualizar `public/config.json` (`event.backgroundColor` → `#0333BD`)
   e **manter** `style={{ backgroundColor: config.event.backgroundColor }}` no container (removendo apenas a
   border de debug). Isso satisfaz integralmente o Critério 1 (fundo é exatamente `#0333BD` e deixa de ser
   `#1E1B4B`) **e** preserva a configurabilidade já desenhada no sistema.
   - ⚠️ **Conflito sinalizado:** os Tokens visuais do Design (linhas 81-82 e §1/Resumo) instruem o oposto
     (`bg-[#0333BD]` fixo, "não o config"). Prevalece a decisão arquitetural acima. **Ação:** Designer/PO
     devem alinhar o texto de Design a esta decisão antes do merge (não bloqueia o dev, que deve seguir
     a via config). Os Critérios de Aceite (Cenário 1) são agnósticos quanto à origem do valor — ambos os
     caminhos os satisfazem, então não há conflito com os critérios, apenas com a recomendação de Design.

2. **Remoção de código morto comentado (Clean Code — regra inviolável "zero código morto").**
   `Board.tsx` (`getGridColumns`, `totalPairs`, colunas dinâmicas, `<div>` de teste) e `index.tsx`
   (Timer import, `handleTick`, `handleTimeout`, `setTimeout(() => {null},1000)`, comentários do header
   de pares) devem ser **deletados**, não recomentados. Esses trechos são justamente a origem das falhas
   de baseline (ver Plano de testes) — removê-los zera o gate como consequência natural da issue.

3. **`aspect-square` no card (em vez de `h-full` no grid).** O quadrado 1:1 passa a ser garantido por
   `aspect-square` na raiz do `Card`, não pelo esticamento vertical do grid. Remove a deformação atual e
   torna o card auto-suficiente quanto à proporção, independentemente da altura do container.

4. **Tailwind v4 — utilitários de opacidade.** `bg-opacity-*` está deprecado; usar a sintaxe de slash
   (`bg-green-400/40`). Verificar que nenhum outro `*-opacity-*` permanece nos componentes tocados.

5. **`object-contain` para logo e cards.** Garante que nem o logo (Critério 2: sem corte/distorção) nem a
   moldura branca embutida nos PNGs dos cards sejam recortados. Trocar os `object-cover` atuais.

### Considerações de performance/segurança

- **Performance:** impacto desprezível. Sem novas requisições, sem re-render adicional, sem N+1
  (não há dados/queries). Apenas troca de classes CSS estáticas. Os assets (`logo_jogo_memoria.png`,
  `card_0X.png`) já são servidos estaticamente. `object-contain` não tem custo relevante.
- **Segurança:** N/A — sem entrada de usuário, sem fetch, sem dados sensíveis. Os valores vêm de
  `config.json` (já confiável e versionado). Nenhum secret hardcoded introduzido.
- **Escalabilidade:** N/A para esta tela (layout estático). A grade 3×4 é fixa por requisito de mockup.

### Plano de testes (vitest — sem sobre-engenharia)

Mudança de layout/CSS: priorizar testes de **contrato de render** e **ausência de regressão**, não
pixel-perfect (validação visual fica com Designer/QA contra o mockup). Cobrir:

1. **Board renderiza 12 cards em 3 colunas** — assert de `grid-cols-3` (ou contagem de cards = 12) no
   container do grid; garantir que `h-full` foi removido.
2. **Card é quadrado** — presença de `aspect-square` na raiz do card.
3. **Sem moldura branca via CSS** — assert de que as faces não têm `bg-white` (a moldura vem do asset).
4. **Overlay matched usa a sintaxe nova** — render de card `matched` expõe `bg-green-400/40` (e não
   `bg-opacity-40`).
5. **Logo correto** — `<img>` do logo com `alt="Jogo da Memória — BB Seguros"` e classe `object-contain`.
6. **Ausência da border de debug** — o container não contém `border-blue-500`.
7. **Regressão de lógica** — os 84 testes existentes (flip/match/use-cases) continuam verdes; nenhum
   teste de domínio é alterado.

> Não criar testes de snapshot de DOM inteiro nem de estilos computados de browser (frágeis e fora do
> escopo de uma mudança de layout). O gate completo (eslint + tsc + vitest) deve fechar **verde**.

### Baseline do gate (capturado em 2026-06-28, antes do dev)

| Check | Resultado | Observação |
|-------|-----------|------------|
| `eslint` | ❌ **3 erros + 2 warnings** | Todos em `src/game/index.tsx`: `no-unused-expressions` (L46, `setTimeout(() => {null})`), `handleTick` e `handleTimeout` não usados. Warnings de `react-refresh` em `standalone/` são pré-existentes e fora do escopo. |
| `tsc -b` | ❌ **2 erros** | `index.tsx` TS6133: `handleTick` e `handleTimeout` declarados e nunca lidos. |
| `vitest run` | ✅ **84/84 passando** | Suite de domínio/uso intacta. |

> **Baseline vermelho herdado, porém autocontido nesta issue:** as 5 falhas (eslint+tsc) são exatamente
> o código morto que esta issue **deve remover** (handlers do Timer comentado + `setTimeout` no-op).
> Portanto **não são bloqueio**, e sim trabalho já previsto: ao remover o código morto, o gate fecha verde.
> O **DoD exige gate completo verde no PR** — o dev deve provar eslint + tsc + vitest todos passando após a
> limpeza. Não é aceitável mascarar com `eslint-disable`/`// @ts-ignore`.

## Fora de Escopo

- Botão "COMEÇAR" (qualquer ajuste ou inclusão) — conforme instrução do stakeholder
- Lógica de jogo: flip, match, timer e pontuação
- Imagens dos cards (já configuradas em `public/config.json`)
- Conteúdo do logo (a imagem `logo_jogo_memoria.png` já contém "JOGO DA MEMÓRIA" + divisória + "BB SEGUROS")

## Definition of Done

- [ ] Layout fiel ao mockup: fundo `#0333BD`, logo no topo, grid 3×4, moldura branca arredondada nos cards
- [ ] Border de debug (`border-4 border-blue-500`) removida de `index.tsx`
- [ ] Sem código morto / comentado em `Board.tsx` e `index.tsx`
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks anexada no PR)
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-63)
