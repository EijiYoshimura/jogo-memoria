# Spec de Design: HUB-57 — Teclado virtual on-screen para formulário de lead (totem retrato, touch)

- **Issue:** [HUB-57](https://linear.app/hub-de-ativacoes/issue/HUB-57)
- **Fase:** Design (UX/UI)
- **Autor:** Product Designer
- **Data:** 2026-06-25
- **Base funcional:** `/home/eiji/work/jogo-memoria/docs/discovery/HUB-57-teclado-virtual.md` (11 critérios Given/When/Then — esta spec NÃO os contradiz)
- **Componente alvo:** `/home/eiji/work/jogo-memoria/src/standalone/LeadForm.tsx`
- **Config/branding:** `/home/eiji/work/jogo-memoria/public/config.json` (`event.primaryColor`, `event.backgroundColor`)

> Escopo: MVP para evento iminente (≤ 2 semanas). Sem gold-plating. Decisões firmes do cliente já incorporadas: acentos pt-BR no `name` SIM; form vai crescer (mapeamento tipo→layout extensível); atalhos de domínio de e-mail SIM (`@gmail.com`, `@hotmail.com`, `@outlook.com`); totem retrato, touch, sem teclado físico.

---

## 1. Premissas de hardware e viewport (totem retrato)

| Item | Valor de referência de design |
|---|---|
| Orientação | Retrato (portrait), fixa |
| Viewport de referência | **1080 × 1920** (proporção 9:16) |
| Faixa de suporte | largura 720–1200px, altura 1280–1920px |
| Densidade de toque | dedo adulto, sem stylus, possível luva fina |
| Distância de uso | em pé, braço estendido (~40–60cm) |
| Teclado do SO | **bloqueado** (não deve aparecer nunca — Cenário 1) |

Toda medida abaixo é especificada em px lógicos sobre a viewport 1080×1920 e escala proporcionalmente (ver §8 Responsividade).

---

## 2. Fluxo do Usuário

```
1. Participante chega ao LeadForm (sem campo ativo, teclado oculto).
2. Toca em um campo (ex.: "Nome completo").
   → Campo fica ATIVO (destaque visual).
   → Teclado virtual ENTRA por baixo (slide-up), ancorado no rodapé.
   → A área do formulário encolhe seu "palco visível" (viewport interno),
     garantindo que o campo ativo role para a zona segura acima do teclado.
3. Participante digita pelas teclas virtuais → caracteres entram no campo ativo.
   → Validação de erro do campo (se havia) é limpa ao digitar (comportamento atual).
4. Participante toca em outro campo:
   → Conteúdo de cada campo é preservado.
   → Layout do teclado troca conforme o TIPO do novo campo (alfabético/e-mail/numérico).
   → Novo campo rola para a zona segura.
5. Ao concluir, toca "Jogar":
   → Se válido: onSubmit dispara, teclado some.
   → Se inválido: erros aparecem, teclado PERMANECE para correção, primeiro
     campo com erro recebe foco e rola para a zona segura.
6. Toque fora de qualquer campo e fora do teclado (área neutra do form) → opcional:
   mantém teclado aberto (kiosk). Não há "fechar teclado" no MVP — em totem o
   teclado aberto é o estado natural; evita re-toques. (ver §11 Decisões)
```

### Princípio de layout: split-screen ancorado (não overlay)

O teclado **não** é um overlay flutuante sobre o form. A tela é dividida em duas regiões fixas quando o teclado está visível:

- **Região A (form, topo):** ocupa o espaço acima do teclado; tem rolagem interna própria (`overflow-y-auto`). É aqui que o campo ativo é mantido visível.
- **Região B (teclado, base):** altura fixa, ancorada ao rodapé (`position: sticky/fixed` no rodapé do container do totem). Nunca sobrepõe a Região A.

Isso atende Cenário 6: o form **não é deslocado, redimensionado nem quebrado** — apenas sua *altura de palco* muda, e a rolagem interna reposiciona o campo ativo. O DOM do form não muda; muda o espaço de viewport disponível.

```
Estado SEM teclado            Estado COM teclado (campo ativo)
┌───────────────────┐         ┌───────────────────┐
│                   │         │  Região A (form)  │  ← scroll interno
│   FORM            │         │  campo ativo aqui │     mantém campo ativo
│   (centralizado)  │         │  na zona segura   │     acima do teclado
│                   │         ├───────────────────┤
│                   │         │  Região B         │
│                   │         │  TECLADO VIRTUAL  │  ← altura fixa, ancorado
└───────────────────┘         └───────────────────┘
```

### Zona segura do campo ativo

Quando um campo fica ativo, ele deve ser rolado (scroll interno suave da Região A) para que **a borda inferior do campo + a mensagem de erro fiquem com folga mínima de 24px acima do topo do teclado**. O campo ativo nunca fica colado ou atrás do teclado. Se o campo já estiver na zona segura, não há rolagem (evita "pulo" desnecessário).

---

## 3. Wireframes ASCII (retrato 1080×1920)

### 3.1 Campo `name` ativo — teclado alfabético pt-BR

```
┌─────────────────────────────────────────────┐ 1080px
│              Preencha seus dados!            │  título (mantido)
│                                              │
│  Nome completo *                             │
│ ┌──────────────────────────────────────────┐│  ← CAMPO ATIVO
│ │ Joã|                                      ││    (anel de destaque
│ └──────────────────────────────────────────┘│     primaryColor)
│  E-mail *                                    │
│ ┌──────────────────────────────────────────┐│
│ │                                          ││
│ └──────────────────────────────────────────┘│
│  WhatsApp                                    │  (rola se necessário)
│         ▼ zona segura ≥24px ▼                │
├─────────────────────────────────────────────┤  topo do teclado
│  q   w   e   r   t   y   u   i   o   p       │  fileira 1
│   a   s   d   f   g   h   j   k   l   ç      │  fileira 2 (ç na ponta)
│ [⇧]  z   x   c   v   b   n   m   [⌫]         │  fileira 3
│ [´`^~]  [ESPAÇO............]  [Limpar]       │  fileira 4 (acentos+util)
└─────────────────────────────────────────────┘  rodapé
```

### 3.2 Campo `email` ativo — teclado e-mail

```
├─────────────────────────────────────────────┤
│ [@gmail.com] [@hotmail.com] [@outlook.com]   │  atalhos de domínio (fileira 0)
│  q   w   e   r   t   y   u   i   o   p        │
│   a   s   d   f   g   h   j   k   l           │
│ [⇧]  z   x   c   v   b   n   m   [⌫]          │
│  @    .    [ESPAÇO.......]  -  _   [Limpar]   │  @ e . sempre visíveis
└─────────────────────────────────────────────┘
```

### 3.3 Campo `phone` ativo — teclado numérico

```
├─────────────────────────────────────────────┤
│        1            2            3            │
│        4            5            6            │
│        7            8            9            │
│      [⌫]            0          [Limpar]       │
└─────────────────────────────────────────────┘
       (3 colunas, teclas grandes — telefone)
```

---

## 4. Telas / Componentes

- **`LeadForm` (Região A):** componente existente, sem mudança estrutural de layout. Ganha: gestão de `activeFieldId`, anel de destaque do campo ativo, scroll-into-safe-zone, e leitura de toques vindos do teclado virtual em vez do teclado do SO. Inputs ficam `readOnly` (ou `inputMode="none"`) para suprimir o teclado do SO mantendo cursor/seleção visuais.
- **`VirtualKeyboard` (Região B) — NOVO componente do Design System:** container ancorado ao rodapé, altura fixa, recebe `layout` (derivado do tipo do campo ativo) e emite eventos de tecla (`char`, `backspace`, `clear`, `space`, `shift`, `domain-shortcut`). Stateless quanto ao conteúdo do campo — apenas emite intenções; o `LeadForm` aplica no campo ativo (inclui máscara de telefone via `applyPhoneMask` já existente).
- **`KeyboardKey` — NOVO subcomponente:** tecla individual. Variações: `char` (padrão), `wide` (espaço), `util` (backspace/limpar/shift), `accent` (toggle de acentos), `shortcut` (domínio). Props: `label`, `variant`, `pressed`, `disabled`, `onPress`.
- **`AccentBar` / popover de acentos:** ver §5.1 — exposição de acentos sem poluir.

---

## 5. Layouts de teclado por tipo de campo

### Mapeamento tipo→layout (EXTENSÍVEL — decisão firme: form vai crescer)

O teclado é selecionado por uma **função de resolução** baseada no `type` do campo (e, futuramente, em `id`/`mask` quando necessário). Tabela de mapeamento declarativa, fácil de estender sem tocar no componente:

| `field.type` | Layout | Observações |
|---|---|---|
| `text` | `alpha-ptbr` | Alfabético pt-BR com acentos (default para texto livre) |
| `email` | `email` | Alfabético + `@` `.` + atalhos de domínio |
| `tel` | `numeric` | 0–9, respeita `mask` via `applyPhoneMask` |
| *(futuro)* `number` / CPF | `numeric` | Reusa layout numérico |
| *(futuro)* `text` campo "empresa" | `alpha-ptbr` | Reusa alfabético sem mudança |

**Regra de extensão:** um novo campo no `config.json` herda automaticamente o layout pelo seu `type`. Se um tipo novo surgir (ex.: data), adiciona-se **uma linha** no mapa `TYPE_TO_LAYOUT` e, se preciso, um novo layout no registro de layouts — nenhuma lógica condicional espalhada. O `LeadForm` é orientado por config (já é hoje), então o teclado acompanha o crescimento do form sem retrabalho de UX.

```
resolveLayout(field):
  return TYPE_TO_LAYOUT[field.type] ?? 'alpha-ptbr'   // fallback seguro
```

### 5.1 Layout `alpha-ptbr` (campo `name`) — acentos sem poluir

Disposição **QWERTY pt-BR** (familiar ao público brasileiro), 4 fileiras. O `ç` ganha lugar fixo na 2ª fileira (ponta direita), pois é frequente em nomes (Conceição, França).

**Estratégia de acentos (a decisão de UX mais importante deste layout):**
Não poluir o teclado com 30+ variantes acentuadas. Duas camadas:

1. **Long-press (toque longo) na vogal/consoante base** → abre um *popover de variantes* logo acima da tecla, com os acentos daquela letra. Padrão de teclado mobile já conhecido.
   - `a` → `á à â ã`
   - `e` → `é ê`
   - `i` → `í`
   - `o` → `ó ô õ`
   - `u` → `ú`
   - `c` → `ç` (além da tecla fixa)
2. **Tecla "dead key" de acento `[´\`^~]`** na 4ª fileira (fallback para quem não descobre o long-press): toca-se o acento e depois a vogal → compõe o caractere. Visualmente é **uma única tecla** que abre uma barra com os 4 diacríticos (´ ` ^ ~) ao ser tocada.

> Por que as duas? Em totem público, parte dos usuários não conhece long-press. A dead key visível garante descobribilidade (acessibilidade cognitiva) sem encher a grade. O long-press acelera para quem já sabe. Custo de implementação baixo, ganho de cobertura alto.

```
Fileira 1: q w e r t y u i o p
Fileira 2: a s d f g h j k l ç
Fileira 3: [⇧] z x c v b n m [⌫]
Fileira 4: [´`^~]  [  ESPAÇO  ]  [Limpar]
```

- **Shift `[⇧]`:** alterna maiúscula/minúscula do PRÓXIMO caractere; após inserir, volta a minúscula (modo "uma letra"). Toque duplo = caps-lock (realce persistente). Altera o caractere efetivamente inserido (Cenário 3). As legendas das teclas refletem o estado (mostram `A` vs `a`).
- Espaço permitido (nomes compostos).

### 5.2 Layout `email` (campo `email`)

- `@` e `.` **fixos e sempre visíveis** na 4ª fileira (Cenário 4 — sem trocar de página).
- `-` e `_` também na 4ª fileira (comuns em e-mails).
- **Atalhos de domínio (fileira 0, decisão firme do cliente):** `[@gmail.com]` `[@hotmail.com]` `[@outlook.com]`. Ao tocar, **anexam a string ao conteúdo atual** do campo (inserem `@gmail.com` ao final do que já foi digitado). Se o campo já contém um `@`, o atalho **substitui** do `@` em diante (evita `joao@@gmail.com`). Caso de borda tratado no comportamento, não na UI.
- **Sem acentos, sem autocapitalize, sem autocorreção** (Cenário 4). Letras minúsculas por padrão; shift disponível mas raramente usado.
- Acentos (long-press/dead key) **desativados** neste layout — e-mail não usa acento.

```
Fileira 0: [@gmail.com] [@hotmail.com] [@outlook.com]
Fileira 1: q w e r t y u i o p
Fileira 2: a s d f g h j k l
Fileira 3: [⇧] z x c v b n m [⌫]
Fileira 4: @ . [ ESPAÇO ] - _ [Limpar]
```

### 5.3 Layout `numeric` (campo `phone`)

- Grade **3 colunas × 4 fileiras**, teclas grandes (telefone discado, baixa carga cognitiva).
- Apenas `0–9` + `[⌫]` + `[Limpar]`. Sem `*`/`#` (não fazem parte da máscara).
- A máscara `(99) 99999-9999` é aplicada progressivamente pelo `applyPhoneMask` já existente (Cenário 5). Dígitos além de 11 são ignorados → tecla numérica vira **estado `disabled`/sem feedback** quando o campo já tem 11 dígitos (feedback de "cheio").
- Backspace recalcula a máscara (Cenário 7) — comportamento existente.

```
[ 1 ] [ 2 ] [ 3 ]
[ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ]
[ ⌫ ] [ 0 ] [Limpar]
```

---

## 6. Teclas mínimas de controle (todos os layouts aplicáveis)

| Tecla | Símbolo | Comportamento | Layouts |
|---|---|---|---|
| Backspace | `⌫` | Apaga último caractere; em `phone` recalcula máscara | todos |
| Limpar | `Limpar` | Esvazia o campo ativo inteiro | todos |
| Espaço | barra larga | Insere espaço | alpha, email |
| Shift/Maiúscula | `⇧` | Alterna caixa do próximo char; duplo-toque = caps-lock | alpha, email |
| Acentos | `´\`^~` | Abre barra de diacríticos (dead key) | alpha (name) |

- **Troca de campo preserva conteúdo** de cada campo e troca o layout pelo tipo (Cenário 8).
- **Limpar** afeta só o campo ativo, nunca os demais.

---

## 7. Acessibilidade e ergonomia touch (WCAG 2.1 AA + ergonomia de totem)

### Tamanho de tecla e espaçamento

| Métrica | Mínimo (WCAG/PO) | **Recomendado para totem (Designer)** |
|---|---|---|
| Alvo de toque (tecla char) | ≥ 44×44px | **72×84px** (alpha/email) |
| Tecla numérica (`phone`) | ≥ 44×44px | **≥ 120×110px** (grandes, 3 colunas) |
| Espaçamento entre teclas (gap) | — | **10–12px** (evita toque acidental) |
| Padding lateral do teclado | — | 16px |
| Altura total da Região B (teclado) | — | **alpha/email ≈ 560–620px; numeric ≈ 520px** (≤ ~33% da altura 1920) |

> Justificativa: 44px é o piso WCAG para apontamento, mas em totem público (uso em pé, sem precisão, possível luva) o erro de toque sobe. 72px de alvo + 10px de gap reduz toques errados drasticamente sem comprometer a contagem de teclas em 1080px de largura (10 teclas × ~92px de passo cabe com folga). Numérico maior porque há poucas teclas e muito espaço.

### Feedback visual / estado pressed (Cenário 9)

- **Estado pressed (toque ativo):** mudança imediata (<100ms) — fundo passa a `primaryColor` (ou tom 10% mais claro), leve `scale(0.96)`, e sombra interna. Feedback ocorre no `pointerdown`, não no `pointerup`, para sensação de resposta instantânea.
- **Repique tátil simulado:** flash de realce de 120ms ao inserir caractere.
- **Tecla `disabled`** (ex.: numérico cheio): opacidade 40%, sem feedback de pressed.
- Sem dependência de cor isolada para significado (estados também usam forma/opacidade) — daltonismo.

### Contraste (usando cores do `config.json`)

Branding atual: `primaryColor #7C3AED` (roxo), `backgroundColor #1E1B4B` (índigo escuro).

| Elemento | Cor | Contraste alvo |
|---|---|---|
| Superfície do teclado (Região B) | `backgroundColor` escurecido ~8% (ex.: `#171340`) p/ separar do form | — |
| Tecla (repouso) | branco `#FFFFFF` com texto `#1F2937` | **≥ 12:1** (AAA) |
| Texto da tecla | cinza-900 sobre branco | ≥ 4.5:1 (AA texto) ✔ |
| Tecla pressed | `primaryColor` com texto branco | par `#7C3AED`/branco ≈ **4.7:1** ✔ AA |
| Tecla util (shift/backspace) | superfície translúcida + ícone branco | ≥ 4.5:1 |
| Anel do campo ativo | `primaryColor`, borda 3px | ≥ 3:1 vs. fundo (componente AA) ✔ |
| Atalho de domínio | contorno `primaryColor`, texto claro | ≥ 4.5:1 |

> **Regra de robustez de contraste:** como as cores vêm do config (operador pode trocar), o teclado deriva tons por função (superfície escura, teclas claras com texto escuro) de modo que o **contraste do texto da tecla não dependa de `primaryColor`**. `primaryColor` é usado só em destaques (pressed, anel, contornos), onde o piso AA é mais baixo (3:1). Isso evita que um branding com cor clara quebre a legibilidade. Recomenda-se que o teclado avalie a luminância de `primaryColor` e escolha texto branco/preto no estado pressed automaticamente (item para a spec técnica).

### Navegação e leitor de tela

- Cada `KeyboardKey` é um `<button>` real com `aria-label` semântico (`"Letra a"`, `"Apagar"`, `"Limpar campo"`, `"Maiúscula"`, `"Arroba gmail ponto com"`).
- Campo ativo: `aria-activedescendant`/`aria-controls` ligando teclado ao input; mudança de campo anuncia o novo campo (`aria-live="polite"`).
- **Foco visível** no anel do campo ativo (não depende do foco nativo, que está suprimido).
- Em kiosk, leitor de tela é uso de borda, mas a estrutura semântica é mantida (custo baixo, conformidade AA).
- Ordem de leitura: título → campos do form → teclado.

---

## 8. Responsividade (tela RETRATO de totem)

Layout desenhado **portrait-first** (a orientação é fixa; landscape não é requisito MVP).

| Breakpoint (altura × largura) | Comportamento |
|---|---|
| **1080×1920 (referência)** | Tecla char ~72–92px de passo; teclado ~580px; form com folga ampla acima |
| **720×1280 (totem menor)** | Escala proporcional via unidades relativas; tecla mínima nunca < 56px; teclado ≤ 36% da altura |
| **1200×1920+ (totem grande)** | Teclas crescem até teto ~110px; mantém proporção, não estica horizontalmente de forma feia (max-width central nas teclas alfabéticas) |
| Largura < 720px (fallback inesperado) | Mantém 10 teclas/fileira reduzindo gap a 8px; alvo ≥ 44px garantido |

Regras:
- Teclado dimensionado em **% da altura da viewport** (teto ~33–36%), nunca em px fixo, para preservar a zona segura do form em telas de altura variável.
- Largura das teclas alfabéticas baseada em `(largura_util) / 10` com gap; numérico em 3 colunas largas.
- **Orientação retrato travada**: se o totem girar, o app mantém retrato (fora do escopo de design tratar landscape).
- Nada de hover (touch-only): todos os estados são `pressed`/`active`, sem `:hover`.

---

## 9. Estados (do campo e do form)

### Estados do CAMPO

- [x] **Vazio (inativo):** input branco, borda transparente (atual). Placeholder ausente (form não usa placeholder hoje — manter).
- [x] **Ativo:** anel `primaryColor` 3px + leve glow; cursor piscando; teclado correspondente exibido. Campo rolado para zona segura.
- [x] **Preenchido (inativo):** valor visível, borda transparente.
- [x] **Erro:** borda vermelha `#EF4444` (atual `border-red-500`), mensagem abaixo (`E-mail inválido` / `<label> é obrigatório`) — validação existente intocada (Cenário 10). Se o campo com erro é tocado, vira ativo e mantém a mensagem até o usuário digitar (erro limpa ao digitar — comportamento atual de `handleChange`).
- [x] **Sucesso:** sem estilo dedicado no MVP (evitar gold-plating). Validade é comunicada pela habilitação do botão Jogar.

### Estados do TECLADO (Região B)

- [x] **Oculto:** nenhum campo ativo (estado inicial). Form centralizado, tela cheia.
- [x] **Entrando:** slide-up ~180ms ease-out ao primeiro foco.
- [x] **Visível/ativo:** layout conforme tipo do campo ativo.
- [x] **Trocando de layout:** ao mudar de tipo de campo, troca de grade é instantânea ou com cross-fade ≤120ms (sem reflow do form).
- [x] **Tecla pressed:** §7.
- [x] **Loading/erro de teclado:** não aplicável (teclado é estático, sem I/O). Se o config falhar, o app já bloqueia antes do form (tela de erro do ConfigLoader) — não há estado de loading do teclado.

### Estado do BOTÃO "Jogar" (Cenário 11)

- **Habilitado somente com campos válidos:** todos os `required` preenchidos e e-mail no formato da regex atual `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
  - Habilitado: fundo `primaryColor`, opacidade 100%, `active:opacity-80` (atual).
  - Desabilitado: opacidade 50%, sem `active`; `aria-disabled="true"`. (Recomendação: feedback de desabilitado é preferível a deixar clicável e só mostrar erro; reduz fricção em totem. Se houver decisão de manter o submit-then-validate atual, o botão dispara `validate()` e os erros aparecem com teclado preservado — ambos os caminhos atendem o Cenário 11; **decisão de UX: desabilitar quando inválido** para guiar o usuário.)
- Ao submeter válido: teclado some, `onSubmit(values)` dispara (fluxo existente).

---

## 10. Componentes do Design System

**Reutilizados:**
- `LeadForm` (estrutura e estilos de input/label/botão/erro existentes — preservados).
- `applyPhoneMask` (máscara de telefone — reutilizada pelo handler do teclado numérico).
- Tokens de cor via `config.event.primaryColor` / `backgroundColor`.

**Novos (a documentar no Design System):**
- `VirtualKeyboard` — container ancorado, recebe `layout`, emite intenções de tecla. Variantes: `alpha-ptbr`, `email`, `numeric`.
- `KeyboardKey` — tecla; variants: `char | wide | util | accent | shortcut`; props `pressed`/`disabled`.
- `AccentPopover` — barra de diacríticos (long-press + dead key).
- `DomainShortcut` — botão de atalho de domínio (caso particular de `KeyboardKey` variant `shortcut`).

Cada novo componente deve ser documentado com: variações, props, estados (repouso/pressed/disabled) e checagem de acessibilidade isolada (alvo ≥ alvo de totem, aria-label, contraste).

---

## 11. Decisões de design (resumo das mais importantes)

1. **Split-screen ancorado, não overlay:** teclado fixo no rodapé (Região B), form com scroll interno (Região A). Form nunca é coberto nem reflowado — só muda o palco visível. Campo ativo rolado para zona segura (≥24px acima do teclado).
2. **Mapa `TYPE_TO_LAYOUT` declarativo e extensível:** novos campos do `config.json` herdam o teclado pelo `type`; crescer o form não exige retrabalho de UX.
3. **Acentos sem poluir:** long-press (popover de variantes) + dead key visível `[´\`^~]` como fallback descobrível. Grade alfabética permanece limpa (QWERTY pt-BR + `ç` fixo).
4. **Atalhos de domínio** (`@gmail/@hotmail/@outlook`) em fileira própria no layout e-mail, com regra anti-duplo-`@`.
5. **Numérico de 3 colunas grandes** respeitando `applyPhoneMask`; teclas viram `disabled` ao atingir 11 dígitos.
6. **Alvo de tecla 72×84px** (muito acima do piso WCAG de 44px) por ser totem público em pé; numérico ≥120px; gap 10–12px; teclado ≤ ~33% da altura.
7. **Contraste robusto a branding:** texto da tecla não depende de `primaryColor` (teclas claras/texto escuro); `primaryColor` só em destaques (pressed/anel). Luminância de `primaryColor` decide texto branco/preto no pressed.
8. **Botão Jogar desabilitado enquanto inválido** (guia o usuário); validação/máscara/erros existentes 100% preservados.

---

## 12. Itens deixados para a Spec Técnica (Tech Lead)

- Build custom vs. biblioteca de teclado (fora do escopo de design).
- Mecanismo exato de suprimir teclado do SO (`readOnly` + foco controlado vs. `inputMode="none"`) preservando cursor/seleção.
- Cálculo de luminância de `primaryColor` para escolher texto do estado pressed.
- Telemetria mínima (issue paralela, não bloqueia esta US).

## 13. Critérios de aceite de UX (complementam os 11 cenários do PO)

- [ ] Campo ativo sempre visível com folga ≥24px acima do teclado em todos os 3 campos (retrato 1080×1920 e 720×1280).
- [ ] Form não sofre reflow/quebra ao abrir/trocar teclado.
- [ ] Alvo de toque de toda tecla ≥ 44px (real ≥72px alpha/≥120px numérico); gap ≥ 10px.
- [ ] Feedback de pressed visível em <100ms no `pointerdown`.
- [ ] Contraste de texto de tecla ≥ 4.5:1 e de destaques ≥ 3:1 com o branding default e com pelo menos um branding claro de teste.
- [ ] Acento acessível por long-press E por dead key; ambos produzem o caractere correto no `name`.
- [ ] Atalho de domínio não gera `@@`; substitui do `@` em diante.
- [ ] Numérico respeita máscara e bloqueia >11 dígitos com feedback de "cheio".
- [ ] Botão Jogar desabilitado enquanto inválido; validações/erros idênticos ao comportamento atual.
