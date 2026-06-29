# Spec: HUB-69 — Edição com cursor (caret visível + inserir/apagar na posição do cursor)

## Contexto

Hoje o input do teclado virtual só insere/apaga no **fim** da string — decisão de MVP da
HUB-57, registrada em `keyboardInput.ts` ("append/backspace no fim — sem caret no meio").
Os inputs do form são `readOnly`/`inputMode=none` para suprimir o teclado nativo do
dispositivo, então o cursor de edição não é visível nem posicionável.

O stakeholder quer permitir **edição no meio do texto**: ver o cursor "|" piscando no campo
ativo, tocar para posicioná-lo no meio de um campo já preenchido e inserir/corrigir ali —
sem precisar apagar tudo. Para o campo de telefone, a máscara `(99) 99999-9999` deve
continuar coerente ao editar no meio.

O núcleo `applyKey` deve permanecer **puro** (sem DOM): a posição do caret entra como **dado
de entrada** e sai como **nova posição**; o `LeadForm` lê/escreve a `selectionStart` do
`<input>`. Esta entrega depende da HUB-68 (ambas tocam `LeadForm.tsx`) e deve ser
implementada após o merge dela. Comportamento de entrada, validações, layout (HUB-65/68) e
consentimento (HUB-67) devem ser **preservados sem regressão**.

## User Story

**Como** visitante que preenche o formulário do totem usando o teclado virtual,
**quero** ver o cursor piscando e tocar no meio de um campo para corrigir o texto ali mesmo,
**para que** eu conserte um erro de digitação sem precisar apagar tudo o que já escrevi.

## Critérios de Aceite

**Cenário 1: Caret visível e piscando no campo ativo**
- [ ] **Dado** que o teclado virtual está habilitado e o visitante seleciona um campo
- **Quando** o campo se torna o campo ativo
- **Então** um cursor "|" piscando é exibido no campo, indicando a posição de edição
- **E** isso ocorre mesmo com o input em `readOnly`/`inputMode=none` (sem abrir o teclado nativo)

**Cenário 2: Tocar posiciona o caret no meio de um campo preenchido**
- [ ] **Dado** um campo já preenchido (ex.: `"Maria"`) e ativo
- **Quando** o visitante toca entre dois caracteres (ex.: entre `r` e `i`)
- **Então** o caret é posicionado naquele ponto (`selectionStart` correspondente)
- **E** o cursor piscando passa a aparecer naquela posição

**Cenário 3: Inserção de caractere na posição do caret**
- [ ] **Dado** o valor `"Maria"` com o caret entre `Mar` e `ia` (posição 3)
- **Quando** o visitante toca numa tecla de caractere (ex.: `x`)
- **Então** o caractere é inserido na posição do caret, resultando em `"Marxia"`
- **E** o caret avança 1 (passa para a posição 4, logo após o caractere inserido)

**Cenário 4: Backspace remove à esquerda do caret**
- [ ] **Dado** o valor `"Maria"` com o caret na posição 3 (entre `Mar` e `ia`)
- **Quando** o visitante toca em backspace
- **Então** o caractere imediatamente à esquerda do caret (`r`) é removido, resultando em `"Maia"`
- **E** o caret recua 1 (passa para a posição 2)

**Cenário 5: Backspace com caret no início é no-op**
- [ ] **Dado** um campo preenchido com o caret na posição 0 (início)
- **Quando** o visitante toca em backspace
- **Então** nada é removido — o valor permanece inalterado
- **E** o caret permanece na posição 0

**Cenário 6: Edição no meio preserva o restante do texto**
- [ ] **Dado** um campo com texto e o caret em uma posição intermediária qualquer
- **Quando** o visitante insere ou remove caracteres naquela posição
- **Então** apenas o trecho na posição do caret é afetado
- **E** os caracteres antes e depois do ponto de edição são preservados na ordem original

**Cenário 7: Digitar no fim continua funcionando (compatibilidade)**
- [ ] **Dado** um campo com o caret no fim da string (ou recém-focado sem reposicionar)
- **Quando** o visitante insere caracteres ou usa backspace
- **Então** o comportamento é idêntico ao anterior (append no fim / remoção do último caractere)

**Cenário 8: Máscara de telefone coerente ao editar no meio**
- [ ] **Dado** o campo de telefone com `(11) 99999-8888` e o caret posicionado entre dígitos no meio
- **Quando** o visitante insere ou remove um dígito
- **Então** a máscara `(99) 99999-9999` é reaplicada corretamente ao valor resultante
- **E** o resultado respeita o limite de 11 dígitos
- **E** o caret é reposicionado de forma coerente após a reformatação (conforme a regra de PO no item de Decisões)

**Cenário 9: Backspace sobre separador da máscara remove o dígito, não o símbolo**
- [ ] **Dado** o campo de telefone com o caret imediatamente após um separador da máscara (ex.: após `) ` ou `-`)
- **Quando** o visitante toca em backspace
- **Então** o dígito relevante é removido e a máscara é reaplicada de forma consistente (o usuário não fica "preso" apagando apenas espaços/parênteses sem efeito)

**Cenário 10: Regressão zero — teclado virtual (HUB-57/59)**
- [ ] **Dado** o teclado virtual habilitado
- **Quando** o visitante usa fileira numérica, QWERTY, shift, long-press/acentos, símbolos e dialpad
- **Então** todas as funções operam como antes; a edição com caret não altera o comportamento das teclas

**Cenário 11: Regressão zero — validações**
- [ ] **Dado** o formulário
- **Quando** o visitante envia com campos obrigatórios vazios, e-mail inválido ou telefone incompleto
- **Então** as validações de obrigatórios, e-mail e máscara operam exatamente como antes

**Cenário 12: Regressão zero — layout (HUB-65/68) e consentimento (HUB-67)**
- [ ] **Dado** o formulário renderizado
- **Quando** o visitante observa e usa a tela
- **Então** o layout (HUB-65/68), o checkbox de consentimento, o modal de termos e o gating obrigatório (HUB-67) permanecem intactos e funcionais

**Cenário 13: Núcleo `applyKey` permanece puro e caret-aware**
- [ ] **Dado** o núcleo `keyboardInput.ts`
- **Quando** `applyKey` é chamado com o valor atual, a tecla e a posição do caret como entrada
- **Então** ele retorna o novo valor e a nova posição do caret, sem acessar o DOM
- **E** é coberto por testes unitários para inserção/remoção no meio, no início, no fim e com máscara

## Decisões do PO

1. **Backspace com caret no início = no-op.** Decisão: quando o caret está na posição 0, o
   backspace **não faz nada** — valor e posição do caret inalterados, sem erro. Não há
   "wrap-around" nem efeito colateral.
2. **Seleção de intervalo (arrastar para selecionar) fora de escopo.** Decisão: esta entrega
   cobre apenas **caret pontual** (uma posição única). Selecionar um intervalo por arrasto e
   substituí-lo/apagá-lo de uma vez **não** faz parte desta entrega — fica como melhoria
   futura. Se o `<input>` expuser `selectionStart !== selectionEnd` (intervalo), o
   comportamento mínimo aceitável é tratar a posição como o `selectionStart` (caret pontual),
   sem quebrar; o tratamento completo de range é fora de escopo.
3. **Posição do caret após editar dentro da máscara de telefone.** Decisão (regra simples e
   previsível): trabalhar a edição sobre os **dígitos crus** (sem separadores), aplicar a
   inserção/remoção na posição correspondente em dígitos, reaplicar a máscara e então
   **posicionar o caret imediatamente após o último dígito que o visitante inseriu/afetou,
   pulando quaisquer separadores** (`(`, `)`, espaço, `-`). Ou seja, o caret nunca pousa
   "dentro" de um separador: se a posição calculada cair sobre um separador, ela avança para
   logo após ele (na inserção) ou recua para logo após o dígito anterior (na remoção). Em
   caso de borda (início/fim), o caret vai para o início/fim do valor mascarado. O ajuste
   fino visual do piscar/realce fica com o Designer; a regra de posicionamento acima é
   funcionalmente vinculante.

## Design (link Figma/Excalidraw)

> N/A funcional — o único elemento visual novo é o caret "|" piscando no campo ativo (cursor
> padrão de input). Designer pode definir cor/espessura/taxa de piscar se desejar refinar,
> mas não há tela nova. Demais elementos seguem HUB-65/68.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. **Documentação — implementação só começa após o merge da
> HUB-68** (ambas tocam `LeadForm.tsx`); o dev rebaseia em `master` pós-HUB-68 e revalida o baseline.
> Princípio: o núcleo `applyKey` permanece **puro** (sem DOM) — o caret entra como **dado** (`caretStart`)
> e sai como **dado** (`nextCaret`); o `LeadForm` faz a ponte com o `<input>` (ler/escrever `selectionStart`).
> Regra de dependência preservada: `game ⊅ lead-capture ⊅ standalone`.

### Arquitetura envolvida

| Arquivo | Mudança | Camada |
|---------|---------|--------|
| `src/lead-capture/keyboard/keyboardInput.ts` | `applyKey` **caret-aware**: `ApplyKeyInput += caretStart?/caretEnd?`, `ApplyKeyResult += nextCaret`. `applyChar` insere em `caretStart`; `applyBackspace` remove à esquerda; no-op em `caretStart===0`. Sem DOM. | Núcleo puro |
| `src/lead-capture/mask/phoneMask.ts` (**novo**) | Máscara de telefone **extraída do `LeadForm`** (DRY) + helpers puros de mapeamento de caret: `applyPhoneMask`, `maskedToRawIndex`, `rawToMaskedIndex`. | Núcleo puro (reutilizável) |
| `src/lead-capture/keyboard/index.ts` (barrel) | Exporta os novos tipos e (se público) o `phoneMask`. | Barrel |
| `src/standalone/LeadForm.tsx` | Refs por campo; lê `selectionStart/End` do input ativo; passa ao `applyKey`; reposiciona o caret com `useLayoutEffect` + `setSelectionRange`; **remapeia `type`** dos campos sob VK para um tipo que suporta seleção; importa `applyPhoneMask` do novo módulo (remove a cópia local). | Apresentação |
| `__tests__/` | Núcleo (`keyboardInput.test.ts`, `phoneMask.test.ts`) + `LeadForm.test.tsx` (reposicionamento, toque, máscara no meio). | Testes |

**Intocados (regressão zero):** `VirtualKeyboard.tsx`/`useLongPress`/`useVirtualKeyboard` (o teclado **não**
muda — ver decisão 6 sobre foco), `game/*`, persistência, `TermsModal`/consentimento (HUB-67), layout (HUB-65/68).

### Decisões técnicas (encizadas)

**1. `applyKey` caret-aware, retrocompatível.**
```ts
export interface ApplyKeyInput {
  currentValue: string
  key: KeyboardKey
  isShifted: boolean
  fieldType: string
  hasMask: boolean
  /** Posição do caret no `currentValue` (coords do valor exibido). Default = fim (retrocompat HUB-57). */
  caretStart?: number
  /** Fim da seleção; se `start!==end` (range), trata-se como `caretStart` (decisão PO 2). Opcional. */
  caretEnd?: number
}
export interface ApplyKeyResult {
  nextRaw: string
  nextShift: boolean
  /** Nova posição do caret, nas coords do valor **exibido após o consumidor** (ver decisão 2 p/ tel). */
  nextCaret: number
}
```
- `caretStart` **opcional, default `currentValue.length`** (fim) → todas as chamadas/testes atuais
  (HUB-57/59) seguem **idênticos** sem alteração (Cenário 7). `nextCaret` é sempre devolvido.
- **char (não-mascarado):** `inserted = isShifted && raw.length===1 ? raw.toUpperCase() : raw`;
  `next = currentValue.slice(0,c) + inserted + currentValue.slice(c)`; `nextCaret = c + inserted.length`.
- **backspace (não-mascarado):** se `c===0` → no-op (`nextRaw=currentValue`, `nextCaret=0`, Cenário 5);
  senão `currentValue.slice(0,c-1)+currentValue.slice(c)`, `nextCaret=c-1`.
- **clear** → `''`, `nextCaret=0`. **space** → insere `' '` em `c`, `nextCaret=c+1`. **shift /
  toggle-symbols** → valor e caret inalterados (`nextCaret=caretStart`).
- **Atalhos de e-mail (valores multi-char, ex.: `@gmail.com`) permanecem âncora-fim** + regra anti-`@@`
  atual (inserir um domínio "no meio" não faz sentido) — preserva os testes de shortcut. Apenas inserções
  de **1 caractere** são caret-posicionadas. Documentar essa distinção no código.

**2. Máscara de telefone (a parte difícil) — coordenadas mascaradas ↔ dígitos crus.**
O `currentValue` do `tel` é **mascarado** e o caret está em coords mascaradas; `applyKey` continua
devolvendo `nextRaw` = **dígitos crus** (contrato atual; o `LeadForm` reaplica `applyPhoneMask`). O desafio
é devolver `nextCaret` já nas coords do valor **mascarado novo**. Algoritmo (no branch `hasMask &&
fieldType==='tel'` de `applyKey`, usando os helpers puros de `phoneMask.ts`):
1. `rawDigits = onlyDigits(currentValue)` (até 11).
2. `rawCaret = maskedToRawIndex(currentValue, caretStart)` = nº de dígitos em `currentValue.slice(0, caretStart)`.
3. **Editar nos dígitos crus** na posição `rawCaret`:
   - char (dígito): insere em `rawCaret` (ignora não-dígitos no tel), respeitando o teto de 11;
     `newRawCaret = rawCaret + 1`.
   - backspace: se `rawCaret===0` → no-op; senão remove o dígito em `rawCaret-1`; `newRawCaret = rawCaret-1`.
     *(Cenário 9: como se trabalha sobre dígitos crus, backspace "após um separador" remove o dígito
     adjacente à esquerda — o usuário nunca fica preso apagando `(`/`)`/espaço/`-`.)*
4. `newMasked = applyPhoneMask(newRawDigits)`.
5. `nextCaret = rawToMaskedIndex(newMasked, newRawCaret)` = índice em `newMasked` **logo após o
   `newRawCaret`-ésimo dígito, pulando separadores** (decisão PO 3); clamp em `[0, newMasked.length]`.
6. retorna `{ nextRaw: newRawDigits, nextShift, nextCaret }`. O `LeadForm` faz `value =
   applyPhoneMask(nextRaw)` (como hoje) e `setSelectionRange(nextCaret)`.

> **Por que extrair `phoneMask.ts` para `lead-capture` (e não deixar no `LeadForm`):** o `applyKey` (em
> `lead-capture`) precisa do `applyPhoneMask` para calcular `nextCaret`; importá-lo de `standalone/`
> violaria a regra de dependência. Movê-lo para `src/lead-capture/mask/phoneMask.ts` (a) respeita a direção
> de dependência, (b) é **DRY** (remove a cópia local do `LeadForm`, que passa a importar de lá), (c) é
> reutilizável pelo Hub futuro, (d) torna o mapeamento de caret **testável em isolamento**. `maskedToRawIndex`
> e `rawToMaskedIndex` encapsulam a regra "pular separadores" (PO 3) — uma função cada, sem over-engineering.

**3. `LeadForm` — caret no input controlado (efeito controlado).**
- **Refs por campo:** `const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})`; no JSX,
  `ref={(el) => { inputRefs.current[field.id] = el }}`.
- **Ler o caret** no momento da tecla: em `handleVirtualKey`, `const el = inputRefs.current[activeField.id];
  const caretStart = el?.selectionStart ?? value.length; const caretEnd = el?.selectionEnd ?? caretStart;`
  passar ambos ao `applyKey`. (Toque para posicionar — Cenário 2 — vem de graça: o `selectionStart` do
  input já reflete o ponto tocado; não é preciso rastrear `onSelect` continuamente.)
- **Reposicionar o caret após o `setState`:** guardar o alvo em `const pendingCaret = useRef<number | null>(null)`
  (setado em `handleVirtualKey`); num **`useLayoutEffect`** (após o re-render controlado), se
  `pendingCaret.current != null` e o input ativo existir: `el.focus(); el.setSelectionRange(p, p);
  pendingCaret.current = null`. O `useLayoutEffect` evita o flicker entre o paint e o reposicionamento.
- **Foco/caret visível sem tocar no teclado (decisão 6):** o `el.focus()` no `useLayoutEffect` **re-foca**
  o input ativo após cada tecla, garantindo que o caret continue visível mesmo que o `<button>` da tecla
  tenha "roubado" o foco no clique. Assim **não** é preciso alterar o `VirtualKeyboard` (menos superfície
  de regressão). *(Alternativa preterida: `preventDefault` no pointerdown das teclas — tocaria o teclado.)*

**4. Caret visível com `readOnly`/`inputMode='none'` — e o gotcha do `type="email"`.**
- Inputs `readOnly` **exibem** o caret quando focados; `inputMode='none'` suprime o teclado nativo, **não**
  o caret. Garantir `caret-color` visível (não transparente) no CSS do input.
- ⚠️ **Gotcha crítico:** `selectionStart`/`setSelectionRange` **só** existem em inputs dos tipos
  `text|search|url|tel|password`. Em **`type="email"`** (e `number`), `selectionStart` retorna `null` e
  `setSelectionRange` **lança `InvalidStateError`** no browser. O campo de e-mail usa `type="email"`.
  **Decisão:** sob VK (`vkEnabled`), renderizar o input com um `type` que suporta seleção —
  `const inputType = vkEnabled ? (field.type === 'email' ? 'text' : field.type) : field.type` (ou
  simplesmente `'text'` para todos sob VK). Isso **não** perde nada: a validação de e-mail já é por **regex
  em JS** (não pela validação nativa do `type`), e o `inputMode='none'` continua suprimindo o teclado. O
  `field.type` lógico (para validação/máscara/`resolveLayout`) **permanece** `'email'`/`'tel'` — só o
  atributo `type` do DOM muda sob VK. `tel`/`text` já suportam seleção (mantêm-se).

**5. Sem mudança de contrato externo.** `LeadForm.onSubmit(formData)` e `SaveLeadParams` inalterados. O
`handleChange`/`validate`/`applyPhoneMask` (agora importado) preservam a semântica; só a **posição** da
edição muda.

### Contratos de API (se houver)

N/A (sem rede). Contrato interno `applyKey` **estendido de forma retrocompatível** (campos novos opcionais;
`nextCaret` adicional no resultado). `VirtualKeyboardProps`/`onKey` inalterados.

### Modelo de dados (se houver)

N/A (sem persistência/schema). Apenas as interfaces `ApplyKeyInput`/`ApplyKeyResult` ganham campos
(decisão 1). Nenhuma migração.

### Plano de testes (vitest — sem sobre-engenharia)

**Núcleo puro `keyboardInput.test.ts` (determinístico):**
1. char no meio: `('Maria', caret 3, 'x') → 'Marxia', nextCaret 4` (Cenário 3); preserva entorno (Cenário 6).
2. backspace no meio: `('Maria', caret 3, ⌫) → 'Maia', nextCaret 2` (Cenário 4).
3. backspace no início: `caret 0 → no-op, nextCaret 0` (Cenário 5).
4. default fim: sem `caretStart`, append/last-remove idênticos ao atual + `nextCaret` = novo fim (Cenário 7;
   **os testes existentes continuam válidos** com o default de fim).
5. range → trata como `caretStart` (`caretEnd` ignorado além de start) (PO 2).
6. shift/clear/space/toggle-symbols devolvem `nextCaret` coerente.

**Núcleo puro `phoneMask.test.ts` (novo — encapsula PO 3):**
7. `applyPhoneMask` (migrado do `LeadForm`): formatação e teto de 11 dígitos (preserva cobertura).
8. `maskedToRawIndex`/`rawToMaskedIndex`: mapeamento ida/volta; caret **nunca pousa em separador** (pula
   `( ) ` espaço `-`); bordas (início/fim) → início/fim do mascarado.
9. Fluxo tel via `applyKey`: inserir/remover dígito no meio de `(11) 99999-8888` reaplica a máscara, respeita
   11 dígitos e devolve `nextCaret` coerente (Cenários 8/9).

**`LeadForm.test.tsx` (integração):**
10. Após uma tecla, o caret do input ativo é reposicionado (`selectionStart` esperado) — usar input de
    `type` selecionável (text/tel) e `setSelectionRange` para simular o toque (Cenário 2/3/4).
11. Edição no meio do tel reflete máscara + caret corretos (Cenário 8).
12. **Regressão HUB-57/59/65/67/68:** suíte existente do `LeadForm` (VK, validações, máscara fim-de-string,
    consentimento/gating, layout) **toda verde**; o `type="email"` remapeado sob VK não quebra a validação
    de e-mail (regex).

> **Riscos de `setSelectionRange`/`selectionStart` no jsdom (mitigações):** (a) o jsdom **implementa**
> `selectionStart`/`setSelectionRange` para `type=text|tel` — testar a **lógica** de reposicionamento é
> viável; **não** usar `type=email` nos testes de seleção (mesmo gotcha do browser). (b) O **piscar** do
> caret e a **visibilidade** são puramente visuais → validação manual/QA (vídeo, DoD), não em vitest. (c)
> `focus()` no jsdom funciona, mas não há render real; assertar `selectionStart` após o efeito, não pixels.
> (d) Em React controlado, garantir que o `useLayoutEffect` rode após o commit do novo `value` — testar com
> `act()`.

### Considerações de performance/segurança

- **Performance:** desprezível — operações de string O(n≤~40) por tecla; um `useLayoutEffect` por tecla;
  máscara recomputada O(11). Sem rede, sem re-render global.
- **Segurança/privacidade:** N/A — edição local; nenhuma mudança na coleta/validação/persistência do lead.
- **Acessibilidade:** caret nativo do input (semântica preservada); `type` lógico mantido para validação;
  re-foco do input ativo mantém o contexto de edição.

### Estimativa técnica

- **Story points: 5** (complexo, ~2–3 dias): o mapeamento de caret na máscara e a restauração do caret no
  input controlado (com o gotcha do `type=email`) são os pontos sensíveis; o núcleo puro é direto.
- **Riscos técnicos:** (1) `type="email"` + selection API (mitigado: remap sob VK); (2) caret no React
  controlado (mitigado: `useLayoutEffect` + `pendingCaret` ref); (3) foco roubado pela tecla (mitigado:
  re-`focus()` no efeito, sem tocar o teclado); (4) jsdom não cobre o visual do caret (validação manual);
  (5) **dependência da HUB-68** — só iniciar após o merge e revalidar o baseline.

### Conflitos Design × Critérios sinalizados

- **Design N/A** (sem tela nova; só o caret nativo) — sem conflito de Design.
- **Cenário 1 (caret visível) × `type="email"`:** não é conflito de spec, e sim **restrição técnica do
  DOM** resolvida pela decisão 4 (remapear `type` sob VK). Registrado para o dev não esbarrar nisso.
- **Cenário 8/9 (máscara) × PO 3:** a regra "pular separadores" do PO é determinística e cobre o Cenário 9
  (backspace após separador remove o dígito) — sem conflito; apenas exige os helpers de mapeamento testados.
- **Range selection (PO 2):** fora de escopo; tratar `selectionStart!==selectionEnd` como caret pontual em
  `selectionStart` — comportamento mínimo definido, sem quebrar.

## Fora de Escopo

- Seleção de intervalo por arrasto (range selection) e operações sobre o intervalo
- Copiar/colar, recortar, desfazer/refazer
- Caret multi-linha (os campos são de linha única)
- Mudança no conjunto de teclas ou nos layouts do teclado (HUB-59)
- Alteração das regras de validação, do layout (HUB-65/68) ou do consentimento (HUB-67)

## Definition of Done

- [ ] Caret "|" visível e piscando no campo ativo, mesmo com input `readOnly`/`inputMode=none`
- [ ] Tocar no campo posiciona o caret na posição correspondente
- [ ] Inserção de caractere ocorre na posição do caret; caret avança 1
- [ ] Backspace remove o caractere à esquerda do caret; caret recua 1; no início é no-op
- [ ] Edição no meio preserva o restante do texto; digitar no fim continua funcionando
- [ ] Máscara de telefone coerente ao editar no meio, com caret reposicionado conforme a regra do PO
- [ ] Núcleo `applyKey` permanece puro (sem DOM), recebendo e devolvendo a posição do caret
- [ ] Testes cobrindo inserção/remoção no início, meio e fim + máscara de telefone
- [ ] Regressão zero: teclado virtual (HUB-57/59), validações, layout (HUB-65/68), consentimento (HUB-67)
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks no PR)
- [ ] Sem código morto
- [ ] Validação visual (screenshot/vídeo do caret) aprovada pelo stakeholder
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-69)
