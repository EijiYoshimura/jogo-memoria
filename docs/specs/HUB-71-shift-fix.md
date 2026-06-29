# Spec: HUB-71 — Correção do SHIFT (regressão HUB-69) + auto-shift na 1ª letra do nome

## Contexto

No teclado virtual, tocar SHIFT e depois uma letra está produzindo **minúscula** — o shift
não surte efeito. **Causa-raiz (diagnosticada):** a HUB-69 introduziu, em `LeadForm.tsx`, um
`useLayoutEffect` que chama `el.focus()` para reposicionar o caret após cada tecla. Esse
`focus()` programático dispara o `onFocus` do `<input>` → `setActiveField(field.id)`, e
`setActiveField` (em `useVirtualKeyboard.ts`, desde a HUB-57) faz `setIsShifted(false)`.
Resultado: o shift é zerado a cada keypress, antes da próxima letra. O núcleo
(`applyChar` com `isShifted ? toUpperCase()`) está **correto** — o defeito é no
gerenciamento de estado do shift entre re-focos do mesmo campo.

Além da correção, o stakeholder pediu uma melhoria de usabilidade: ao focar o campo **nome**
vazio, iniciar com shift ativo para a primeira letra sair maiúscula (auto-capitalize),
voltando ao comportamento normal depois.

Esta entrega corrige o bug e adiciona o auto-shift. Caret/edição (HUB-69), validações/máscara,
símbolos/numérico (HUB-59), consentimento (HUB-67) e layout (HUB-65/68/70) devem ser
preservados sem regressão.

## User Story

**Como** visitante que digita meu nome no totem usando o teclado virtual,
**quero** que o SHIFT realmente produza letras maiúsculas e que a primeira letra do meu nome já comece maiúscula,
**para que** eu escreva nomes próprios corretamente, sem que o teclado "engula" o shift a cada tecla.

## Critérios de Aceite

**Cenário 1: SHIFT + letra produz maiúscula**
- [ ] **Dado** o teclado virtual com um campo de texto ativo e o shift desligado
- **Quando** o visitante toca em SHIFT e em seguida numa letra (ex.: `a`)
- **Então** o caractere inserido é maiúsculo (`A`)

**Cenário 2: O shift não é resetado pelo re-foco do mesmo campo entre teclas**
- [ ] **Dado** o campo ativo e o shift ligado
- **Quando** o reposicionamento de caret re-foca o **mesmo** campo (efeito da HUB-69) entre o toque no SHIFT e o toque na letra
- **Então** o shift permanece ligado e a letra sai maiúscula
- **E** o estado de shift só é resetado quando o campo ativo **muda de fato** (id diferente)

**Cenário 3: Política do shift entre teclas (single-shot)**
- [ ] **Dado** o shift ligado e um campo de texto ativo
- **Quando** o visitante toca em uma letra
- **Então** essa letra sai maiúscula
- **E** o shift é desligado automaticamente após essa letra (a próxima letra, sem novo toque em SHIFT, sai minúscula)

**Cenário 4: SHIFT é alternável manualmente**
- [ ] **Dado** o shift desligado
- **Quando** o visitante toca em SHIFT
- **Então** o shift liga (indicação visual ativa); **e quando** toca em SHIFT novamente, desliga — sem inserir caractere

**Cenário 5: Maiúsculas acentuadas via shift (long-press) continuam funcionando**
- [ ] **Dado** o shift ligado e um campo de texto ativo
- **Quando** o visitante faz long-press numa vogal e seleciona uma variante (ex.: `ã`)
- **Então** o caractere inserido é a versão maiúscula acentuada (`Ã`), como na HUB-59

**Cenário 6: Auto-shift ao focar o campo nome vazio**
- [ ] **Dado** que o campo **nome** está vazio
- **Quando** o visitante foca o campo nome
- **Então** o shift inicia **ativado**
- **E** a primeira letra digitada sai maiúscula

**Cenário 7: Após a 1ª letra do auto-shift, o shift volta ao normal**
- [ ] **Dado** o auto-shift ativo no campo nome vazio
- **Quando** o visitante digita a primeira letra (que sai maiúscula)
- **Então** o shift é desligado
- **E** as letras seguintes saem minúsculas (sem caps forçado no resto do nome)

**Cenário 8: Auto-shift não dispara em campo nome já preenchido**
- [ ] **Dado** que o campo nome **já contém** texto
- **Quando** o visitante foca o campo nome (ex.: para editar)
- **Então** o shift **não** é forçado a ligar pelo auto-shift (comportamento normal de edição)

**Cenário 9: Trocar para outro campo reseta o shift**
- [ ] **Dado** o shift ligado num campo
- **Quando** o visitante seleciona **outro** campo (id diferente)
- **Então** o shift é resetado (desligado) ao mudar de campo — exceto pelo auto-shift quando o novo campo for o nome vazio

**Cenário 10: Regressão zero — caret/edição (HUB-69)**
- [ ] **Dado** a edição com caret
- **Quando** o visitante posiciona o caret, insere/apaga no meio e edita telefone com máscara
- **Então** tudo funciona como na HUB-69; a correção do shift não altera o reposicionamento de caret

**Cenário 11: Regressão zero — validações e máscara**
- [ ] **Dado** o formulário
- **Quando** o visitante envia com campos inválidos
- **Então** as validações de obrigatórios, e-mail e máscara `(99) 99999-9999` operam como antes

**Cenário 12: Regressão zero — símbolos, numérico, consentimento e layout**
- [ ] **Dado** o formulário
- **Quando** o visitante usa o modo símbolos/numérico (HUB-59), o checkbox/modal de consentimento (HUB-67) e observa o layout (HUB-65/68/70)
- **Então** tudo permanece intacto e funcional

## Decisões do PO

1. **Campo que recebe auto-shift.** Decisão: o auto-shift aplica-se ao **campo de nome**,
   identificado por `field.id === 'name'`. Justificativa: é o campo onde nomes próprios exigem
   inicial maiúscula; e-mail (minúsculo por convenção) e telefone (numérico) não se beneficiam.
   O critério é **vinculado ao `field.id === 'name'`**; caso o id não exista na config, nenhum
   campo recebe auto-shift (degrada sem erro). O Tech Lead pode generalizar para "primeiro
   campo de texto" se for trivial e sem custo, mas o requisito funcional mínimo é o campo `name`.
2. **Comportamento do shift após a 1ª letra do auto-shift.** Decisão: depois que a primeira
   letra (maiúscula) é digitada, o shift **volta a desligado** — as letras seguintes saem
   minúsculas. Não há caps-lock contínuo. Auto-shift = "uma única letra maiúscula no início".
3. **Política do shift entre teclas (single-shot).** Decisão: o shift é **single-shot** — ao
   tocar em SHIFT, ele se aplica à **próxima letra** e desliga automaticamente após ela
   (comportamento idêntico ao auto-shift, e consistente com o que o núcleo já faz: `applyChar`
   mantém `nextShift`, e o consumidor reseta após inserir). Para digitar várias maiúsculas
   seguidas, o visitante toca SHIFT antes de cada letra. Caps-lock (shift travado) **não** faz
   parte desta entrega (ver Fora de Escopo). O essencial é que o shift **persista corretamente
   até a próxima letra**, sem ser zerado pelo re-foco do mesmo campo (correção do bug).

## Design (link Figma/Excalidraw)

> N/A funcional — não há elemento visual novo além da indicação de estado ativo do SHIFT, que
> já existe (HUB-59). Designer pode refinar o realce do SHIFT ativo se desejar, mas não há tela
> nova.

## Spec Técnica

> Preenchida pelo Tech Lead em 2026-06-29. Correção de bug de estado + melhoria de UX. Três pontos
> cirúrgicos: (a) `useVirtualKeyboard` reseta o shift **só quando o id do campo muda**; (b) `applyChar`
> passa a ser **single-shot** (consome o shift após inserir); (c) `LeadForm` arma o **auto-shift** ao
> ativar o campo `name` vazio. O núcleo `applyKey` permanece puro. Regra de dependência preservada.

> **Correção factual da premissa do PO 3:** hoje `applyChar` retorna `nextShift: isShifted` — ou seja, o
> núcleo é **sticky** (mantém o shift), **não** single-shot. A afirmação "o núcleo já faz single-shot, e o
> consumidor reseta" não corresponde ao código atual. Combinada com o bug do re-foco (que zerava o shift
> *antes* da letra), o efeito observado era "o shift nunca funciona". Esta entrega torna o núcleo
> **single-shot determinístico** (decisão técnica abaixo).

### Arquitetura envolvida

| Arquivo | Mudança | Camada |
|---------|---------|--------|
| `src/lead-capture/keyboard/useVirtualKeyboard.ts` | `setActiveField` reseta `isShifted` **apenas quando `fieldId` muda**; mesmo id → no-op (corrige o bug do re-foco). Sem stale-closure (ver decisão 1). | Apresentação (hook de estado) |
| `src/lead-capture/keyboard/keyboardInput.ts` | `applyChar` **single-shot**: inserção de char com shift → maiúscula **e** `nextShift: false`. `backspace`/`clear`/`space`/`toggle-symbols` preservam `isShifted`; `shift` alterna. Puro. | Núcleo puro |
| `src/standalone/LeadForm.tsx` | Helper `activateField(fieldId)` (compartilhado por `onFocus`/`onClick`): chama `setActiveField` e, ao **ativar** (id mudou) o `name` **vazio**, `setShift(true)` (auto-shift). Regra de form fica no LeadForm, não vaza para o hook genérico. | Apresentação |
| `__tests__/` | Novo `useVirtualKeyboard.test.ts`; atualizar `keyboardInput.test.ts` (sticky→single-shot); novos casos em `LeadForm.test.tsx`. | Testes |

**Intocados (regressão zero):** `VirtualKeyboard.tsx`/`useLongPress`, `phoneMask.ts`, `game/*`, persistência,
`TermsModal`/consentimento, layout. `applyKey` mantém assinatura; `VirtualKeyboardState` inalterado.

### Decisões técnicas (encizadas)

**1. Fix do reset — `setActiveField` reseta só na mudança de id (StrictMode-safe).**
O app roda em `StrictMode`, então **não** colocar efeito colateral (`setIsShifted`) dentro do updater de
`setActiveFieldId` (updaters podem rodar 2×). Usar um **ref-espelho** para comparar sem stale-closure (o
`useCallback` é memoizado com `[enabled]`, logo `activeFieldId` lido direto estaria *stale*):
```ts
const activeFieldIdRef = useRef<string | null>(null)
const setActiveField = useCallback((fieldId: string | null) => {
  if (!enabled) return
  if (fieldId === activeFieldIdRef.current) return   // mesmo id → no-op: NÃO reseta o shift (fix)
  activeFieldIdRef.current = fieldId
  setActiveFieldId(fieldId)
  setIsShifted(false)                                // id mudou → reset (Cenário 9)
}, [enabled])
```
- Re-foco do **mesmo** campo (efeito da HUB-69) → no-op total → shift preservado (Cenários 1/2).
- Troca de campo (id diferente) → reset do shift (Cenário 9). O auto-shift (decisão 3) rearma depois, quando
  aplicável.

**2. Single-shot no núcleo (`applyChar`) — Opção A (puro/determinístico).**
`applyChar` passa a retornar **`nextShift: false`** em **todos** os seus caminhos de retorno (inserção de 1
char, multi-char/atalho de domínio, `@`): uma inserção de caractere **consome** o shift.
```ts
// dentro de applyChar, em cada return:  nextShift: false
const inserted = isShifted && raw.length === 1 ? raw.toUpperCase() : raw   // maiúscula quando shift on
// ... retorna { nextRaw, nextShift: false, nextCaret }
```
- char com shift → maiúscula **+ shift desliga** (Cenário 3). char sem shift → minúscula + shift off (idem).
- `space`/`backspace`/`clear`/`toggle-symbols` → `nextShift: isShifted` (não forçam nem consomem caps);
  `shift` → `!isShifted` (alterna sem inserir, Cenário 4).
- **Variante acentuada (long-press, HUB-59):** `selectVariant` emite uma char key → `applyChar` aplica
  `toUpperCase()` sob shift (`ã`→`Ã`) e consome o shift — Cenário 5 preservado.
- **Por que Opção A (e não no `LeadForm`):** o núcleo fica **determinístico e testável** ("dado shift on +
  letra, sai maiúscula e shift off"), sem espalhar a regra de single-shot pela apresentação. O `LeadForm`
  apenas propaga `setShift(nextShift)` (já faz). Os **Critérios (Cenário 3) são agnósticos** a *onde* o
  reset ocorre — não há conflito com a spec, apenas com a prosa da decisão PO 3 (ver Conflitos).

**3. Auto-shift no `name` vazio — regra de form no `LeadForm` (não no hook genérico).**
Extrair um helper único usado por `onFocus` e `onClick` (hoje ambos chamam `setActiveField`):
```ts
const AUTO_SHIFT_FIELD_ID = 'name'
function activateField(fieldId: string) {
  const isActivating = fieldId !== activeFieldId            // id da render atual (já commitado)
  setActiveField(fieldId)                                   // reseta shift se id mudou; no-op se igual
  if (isActivating && fieldId === AUTO_SHIFT_FIELD_ID && (values[fieldId] ?? '') === '') {
    setShift(true)                                          // arma a 1ª maiúscula (Cenário 6)
  }
}
```
- No mesmo event handler, `setActiveField` (que faz `setIsShifted(false)`) e `setShift(true)` são batched →
  estado final `isShifted=true` (o `setShift(true)` vem depois). 1ª letra sai maiúscula; sendo single-shot,
  o shift desliga após ela (Cenário 7).
- `isActivating` (`fieldId !== activeFieldId`) impede re-armar no **re-foco** do mesmo campo (o
  `useLayoutEffect` re-foca `name`, mas aí `fieldId === activeFieldId` → não rearma) e cobre o Cenário 8
  (name já preenchido → `values.name !== ''` → não arma).
- **Generalização (PO 1, opcional):** o id `'name'` fica numa constante nomeada. Se a config não tiver
  `name`, nenhum campo recebe auto-shift (degrada sem erro). Não generalizo para "primeiro campo de texto"
  (YAGNI — o requisito mínimo é `name`).
- **Não vaza regra para o hook:** o `useVirtualKeyboard` permanece genérico; quem conhece `'name'`/vazio é
  o `LeadForm`.

**4. Trocar de campo reseta o shift (Cenário 9):** consequência direta da decisão 1 (id diferente →
`setIsShifted(false)`), com a exceção do auto-shift quando o novo campo for o `name` vazio (decisão 3).

### Contratos de API (se houver)

N/A. `VirtualKeyboardState` (`activeFieldId`/`isShifted`/`setActiveField`/`setShift`) **inalterado** —
mantenho a assinatura de `setActiveField(fieldId)` (não adiciono `options`, para não vazar a regra de
auto-shift ao hook genérico). `applyKey`/`ApplyKeyResult` inalterados na forma (só muda o *valor* de
`nextShift` no caminho char).

### Modelo de dados (se houver)

N/A — sem schema/persistência. Apenas estado de UI (`isShifted`) e a semântica de `nextShift`.

### Plano de testes (vitest — sem sobre-engenharia)

**Núcleo `keyboardInput.test.ts` (atualizar + adicionar):**
1. **Atualizar** o teste atual "mantém o shift após inserir caractere" → **"consome o shift (single-shot)
   após inserir caractere"**: char com `isShifted:true` → `nextRaw` maiúsculo **e** `nextShift:false`
   (Cenário 3). *(Mudança legítima por spec — o comportamento sticky era o bug latente; proibido mascarar.)*
2. char sem shift → minúsculo + `nextShift:false`. `shift` → alterna `nextShift` sem inserir (Cenário 4).
3. `space`/`backspace`/`clear`/`toggle-symbols` → preservam `isShifted` (não forçam caps).

**Novo `useVirtualKeyboard.test.ts`:**
4. `setActiveField(sameId)` chamado 2× **não** reseta `isShifted` (após `setShift(true)`, segue `true`) —
   reproduz o bug do re-foco e prova o fix (Cenário 2).
5. `setActiveField(otherId)` **reseta** `isShifted` para `false` (Cenário 9).
6. `enabled:false` → setters no-op (regressão HUB-57).

**`LeadForm.test.tsx`:**
7. **Shift persiste entre teclas no mesmo campo:** tocar SHIFT, simular o re-foco (efeito), tocar letra →
   sai **maiúscula** (Cenários 1/2). *(Renderizar com VK ligado; exercitar `handleVirtualKey` SHIFT→letra.)*
8. **Single-shot:** após a maiúscula, a próxima letra (sem novo SHIFT) sai **minúscula** (Cenário 3).
9. **Auto-shift:** focar `name` **vazio** → 1ª letra **maiúscula**; 2ª letra **minúscula** (Cenários 6/7).
10. **Auto-shift não dispara** em `name` já preenchido (Cenário 8); trocar de campo reseta (Cenário 9).
11. **Regressão HUB-59/69/65/67:** suíte existente (caret/edição, máscara de telefone, símbolos/numérico,
    consentimento, layout) **toda verde**; long-press acentuado sob shift → maiúscula acentuada (Cenário 5).

> **Riscos no jsdom (mitigações):** (a) `el.focus()`/`onFocus` no jsdom disparam o handler — testar o ciclo
> SHIFT→(re-foco)→letra de forma **comportamental** (asserir o valor inserido), com `act()` para o
> `useLayoutEffect`. (b) Evitar depender de piscar/realce visual do SHIFT (validação manual/QA). (c) StrictMode
> só atua no entrypoint; nos testes, garantir que o fix não dependa de efeito em updater (decisão 1 usa ref).

### Considerações de performance/segurança

- **Performance:** desprezível — o fix **reduz** renders (re-foco do mesmo id vira no-op; antes disparava
  `setIsShifted(false)` a cada tecla). Sem rede, sem custo extra.
- **Segurança/privacidade:** N/A — apenas estado de UI; nenhuma mudança em coleta/validação/persistência.
- **Acessibilidade:** o realce de SHIFT ativo (HUB-59) passa a refletir o estado correto; auto-shift melhora
  a entrada de nomes próprios sem prejudicar leitor de tela (input nativo).

### Estimativa técnica

- **Story points: 3** (moderado, ~1 dia): mudanças pequenas e localizadas; o esforço está na **cobertura de
  teste** do estado de shift (re-foco, single-shot, auto-shift) e na regressão.
- **Riscos técnicos:** (1) stale-closure no fix (mitigado: ref-espelho); (2) ordem de batching
  `setActiveField`+`setShift` no auto-shift (mitigado: setShift por último vence); (3) StrictMode duplicando
  efeitos (mitigado: sem efeito em updater); (4) re-foco da HUB-69 não pode voltar a zerar o shift (coberto
  pelo teste 7).

### Conflitos Design × Critérios sinalizados

1. **Prosa do PO 3 × implementação (Opção A).** O PO descreveu "o núcleo mantém `nextShift` e o consumidor
   reseta" — mas o núcleo hoje é **sticky** e isso seria o caminho Opção B. Adoto a **Opção A** (núcleo
   single-shot determinístico), mais limpa/testável; **funcionalmente idêntica** ao resultado esperado
   (Cenário 3). Sem conflito com os Critérios (agnósticos quanto ao *onde* do reset) — apenas alinhamento de
   redação. PO/QA: validar o Cenário 3 pelo **efeito** (próxima letra minúscula), não pela implementação.
2. **Design N/A** (sem elemento visual novo; realce de SHIFT já existe na HUB-59) — sem conflito de Design.
3. **Auto-shift vs. caret (HUB-69):** o auto-shift só chama `setShift(true)`; **não** mexe em
   `pendingCaret`/`setSelectionRange` — o reposicionamento de caret segue intacto (Cenário 10).

## Fora de Escopo

- Caps-lock (shift travado para várias maiúsculas seguidas) — não nesta entrega
- Auto-capitalize após espaço/pontuação (ex.: maiúscula em cada palavra) — apenas a 1ª letra do nome vazio
- Auto-shift em outros campos que não o `name`
- Mudança nas regras de validação, no layout ou no consentimento
- Alteração do conjunto de teclas/layouts do teclado (HUB-59)

## Definition of Done

- [ ] SHIFT + letra → maiúscula; o shift não é zerado pelo re-foco do mesmo campo entre teclas
- [ ] `setActiveField` só reseta o shift quando o id do campo ativo **muda de fato**
- [ ] Shift single-shot: aplica à próxima letra e desliga; SHIFT alternável manualmente sem inserir caractere
- [ ] Maiúsculas acentuadas via shift (long-press) continuam funcionando (HUB-59)
- [ ] Auto-shift: campo `name` vazio ao focar → shift ativo → 1ª letra maiúscula → shift volta a desligado
- [ ] Auto-shift não dispara em campo `name` já preenchido; trocar de campo reseta o shift
- [ ] Núcleo `applyKey` permanece puro; ajuste em `useVirtualKeyboard.ts` e/ou `LeadForm.tsx`
- [ ] Testes cobrindo: shift não reseta no re-foco do mesmo campo; auto-shift no nome vazio; maiúscula acentuada
- [ ] Regressão zero: caret/edição (HUB-69), validações/máscara, símbolos/numérico (HUB-59), consentimento (HUB-67), layout (HUB-65/68/70)
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks no PR)
- [ ] Sem código morto
- [ ] Validação (stakeholder) aprovada
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue atualizada no Linear (HUB-71)
