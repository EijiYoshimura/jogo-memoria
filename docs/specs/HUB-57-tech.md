# Spec Técnica: HUB-57 — Teclado virtual on-screen para formulário de lead

- **Issue:** HUB-57
- **Autor:** Tech Lead
- **Data:** 2026-06-25
- **Base funcional:** `/home/eiji/work/jogo-memoria/docs/discovery/HUB-57-teclado-virtual.md` (não contradita)
- **Componente alvo:** `/home/eiji/work/jogo-memoria/src/standalone/LeadForm.tsx`

---

## 0. Restrição arquitetural (inviolável)

**Correção do cliente (2026-06-25):** o teclado virtual **não é exclusivo do standalone**. Na versão final (Hub) ele é uma **opção configurável por ativação** — o operador escolhe **ativar ou não**. Logo o teclado é uma **capability reutilizável da camada de lead capture / Activation Runtime**, consumida tanto pelo standalone atual quanto pelo Hub futuro, ligada/desligada por flag de config (ver §4.0).

**Decisão arquitetural:** o código novo do teclado (núcleo puro + hook + componente apresentacional + layouts) **nasce numa camada reutilizável `src/lead-capture/`**, não preso ao `src/standalone/` descartável.

Regras de dependência (apontam para dentro):
- `src/game/` (plugin) **NUNCA** depende de `src/lead-capture/` nem de `src/standalone/`.
- `src/lead-capture/` **NUNCA** depende de `src/standalone/` — senão deixa de ser reutilizável pelo Hub.
- O núcleo do teclado é **agnóstico de framework de form e de máscara**: não importa `GameConfig`, não conhece `applyPhoneMask`. Recebe descritores primitivos de campo (`{ type, keyboardLayout? }`) e devolve `raw`; o **consumidor** (LeadForm hoje, form do Hub amanhã) aplica sua própria máscara/validação. Isso mantém `lead-capture` desacoplado até de `GameConfig`.
- `src/standalone/LeadForm.tsx` (consumidor atual) **importa** de `src/lead-capture/`.

**Fronteira mínima do MVP (dívida explícita):** mover o `LeadForm` inteiro para `src/lead-capture/` é maior que o MVP e arriscaria regressão sob prazo de ≤2 semanas. Então: **o código novo do teclado nasce em `src/lead-capture/`** (já reutilizável) e o `LeadForm` **permanece em `src/standalone/` por ora**, apenas importando o teclado. Dívida registrada → Issue `tech-debt` no backlog: numa fase seguinte, extrair um `LeadCaptureForm` reutilizável (ou migrar o `LeadForm`) para `src/lead-capture/`, para o Hub consumir a captura de lead inteira.

**Como o Hub pluga:** importa `VirtualKeyboard`, `useVirtualKeyboard` e o registry de `src/lead-capture/`, lê o mesmo flag `leadForm.virtualKeyboard.enabled` do config da ativação e renderiza seu form de captura com o mesmo contrato — **sem reescrever o teclado**.

Dependências apontam para dentro: o núcleo de lógica do teclado (registry + aplicação de tecla) é **puro** (sem React, sem DOM), e os componentes React/o `LeadForm` dependem dele — nunca o contrário.

---

## 1. Decisão: biblioteca vs. componente próprio

### Recomendação: **COMPONENTE PRÓPRIO (custom)**.

Avaliei `react-simple-keyboard` (lib madura, layouts custom, theming) contra um componente próprio.

| Critério | `react-simple-keyboard` | Custom (recomendado) |
|---|---|---|
| Renderização das teclas | Pronta (economiza ~80 linhas de grid) | Grid de `<button>` a partir de dados — trivial em React |
| Acentos pt-BR (MVP por teclas diretas á/ã/ç…) | Suportado via layout custom | Suportado — é só dados no registry |
| Máscara `applyPhoneMask` + validação e-mail | **Lógica é nossa de qualquer forma** | **Lógica é nossa de qualquer forma** |
| Modelo de input/caret interno | Possui buffer interno próprio que **teríamos que contornar** (usar só `onKeyPress`) → fricção | 100% sob nosso controle (estado em React) |
| Contrato tipo-de-campo→layout extensível (§4) | Constrangido ao formato da lib | Interface nossa, livre, fácil de estender |
| React 19 peer dep | Risco de fricção de peer/`overrides` no Vite | Zero (sem dependência nova) |
| Bundle | +dependência | ~0 (button grid + CSS Tailwind já presente) |
| Manutenção | Acoplado à evolução da lib | Código pequeno e auditável no repo |
| Theming kiosk (alvos ≥44px, retrato) | Sobrescrever CSS da lib | Tailwind direto, já no projeto |

**Justificativa:** a complexidade real desta feature — máscara progressiva, validação de e-mail, registry tipo→layout extensível, estado controlado por campo, teclas de acento — é **lógica de domínio que possuímos independentemente da escolha**. A lib só pouparia renderizar um grid de botões (~80 linhas), ao custo de (a) contornar o modelo de input interno dela, (b) sobrescrever theming para o kiosk e (c) carregar risco de peer-dependency com React 19. O ganho de controle, a ausência de dependência nova e a aderência ao "controle do estado" exigido pela discovery pendem claramente para o custom. O custom também mantém o teclado como **componente puramente apresentacional** que emite eventos de tecla, com todo o estado em React — exatamente o que Clean Architecture pede.

**Fallback documentado:** registrar **ADR-00X (custom vs. react-simple-keyboard)** com esta decisão; se em campo o custom mostrar custo de manutenção inesperado, a lib fica como plano B, e a fronteira (componente apresentacional + núcleo puro) torna a troca barata, pois a lib entraria só na camada de renderização.

---

## 2. Supressão do teclado nativo do SO (somente no modo LIGADO)

> Esta seção descreve o **modo LIGADO** (`virtualKeyboard.enabled === true`). No **modo DESLIGADO** (default — ver §4.0), o input mantém o comportamento **nativo**: **sem** `readOnly`, **sem** `inputMode="none"`, teclado do SO permitido e **sem** render do `VirtualKeyboard`. As props abaixo são aplicadas **condicionalmente** apenas quando ligado.

### Abordagem (modo ligado): `readOnly` no `<input>` + estado de "campo ativo" controlado pela aplicação, reforçado por `inputMode="none"`.

```
// props aplicadas apenas quando virtualKeyboard.enabled === true
<input
  readOnly
  inputMode="none"
  onClick={() => setActiveField(field.id)}   // toque seleciona o campo
  onFocus={() => setActiveField(field.id)}
  aria-readonly="true"
  ... (demais props atuais preservadas)
/>
```

**Por que `readOnly` como mecanismo primário:**
- Garante de forma cross-platform (iOS/Android/WebView kiosk) que **o teclado nativo não sobe**, porque o campo não é editável pelo SO.
- **Não** bloqueia nosso fluxo: a entrada vem do teclado virtual atualizando o estado React (`values`) via o mesmo `handleChange` atual; o `value` continua controlado e renderiza normalmente.
- Diferente de `disabled`: `readOnly` **mantém foco, estilo de foco, semântica de form e submit** — só impede edição nativa. Por isso **não** usamos `disabled` (cinza, não focável, fora do submit).

**`inputMode="none"` como reforço (belt-and-suspenders):** sinaliza ao browser para não exibir VK mesmo em foco programático; isoladamente é menos confiável que `readOnly` em alguns WebViews kiosk, por isso é secundário.

**Trade-off de acessibilidade:** `readOnly` é anunciado como "somente leitura" por leitores de tela, o que é semanticamente impreciso para um campo que aceita entrada via teclado virtual. Mitigação: (a) o totem é **single-purpose kiosk sem tecnologia assistiva** (premissa da discovery §6); (b) mantemos `aria-label`/`label` e marcação do campo ativo para feedback visual; (c) registrar **ADR-00Y** justificando a exceção semântica. Não usar `pointerEvents:none` nem `tabIndex=-1` no input — quebraria a seleção por toque e o foco visual exigido pelo Cenário 2.

**Limite de teste:** jsdom/RTL **não** conseguem provar que o SO não exibe o teclado físico do dispositivo. O teste automatizado valida o **contrato DOM** (`readOnly` presente, `inputMode="none"`, entrada exclusiva via teclado virtual). A prova final do Cenário 1 é validação do **QA em totem retrato real** (já exigida na DoD funcional).

---

## 3. Arquitetura / Componentes

### Estrutura de arquivos — código novo na camada reutilizável `src/lead-capture/`

```
src/lead-capture/                        # NOVA camada reutilizável (standalone atual + Hub futuro)
├── keyboard/
│   ├── keyboardLayouts.ts               # NOVO — registry tipo→layout + tipos (DADOS, sem React)
│   ├── keyboardInput.ts                 # NOVO — núcleo PURO: applyKey() (agnóstico de máscara)
│   ├── useVirtualKeyboard.ts            # NOVO — estado: activeFieldId, shift; resolve layout
│   ├── VirtualKeyboard.tsx              # NOVO — apresentacional puro (renderiza grid, emite onKey)
│   └── index.ts                         # NOVO — barrel: API pública consumida por standalone e Hub
└── (futuro) LeadCaptureForm.tsx         # dívida: extração do LeadForm numa fase posterior

src/standalone/
└── LeadForm.tsx                         # EDITADO — consumidor: importa de src/lead-capture/keyboard;
                                         #   lê o flag e alterna modo nativo/virtual; máscara/validação intactas

src/game/types.ts                        # EDITADO — só tipos: + virtualKeyboard?{enabled} e keyboardLayout? (opcionais)
```

**Camadas (dependências para dentro):**
- `keyboardLayouts.ts` + `keyboardInput.ts` = **núcleo puro** (testável sem DOM). Não importam React, não importam `GameConfig`, não conhecem máscara.
- `useVirtualKeyboard.ts` = adaptador de estado React sobre o núcleo.
- `VirtualKeyboard.tsx` = apresentação pura (sem lógica de negócio: recebe layout + callbacks, renderiza, emite).
- `index.ts` = superfície estável que o standalone **e o Hub** importam.
- `LeadForm.tsx` (em `src/standalone/`, consumidor) = composição: lê o flag, liga campos ↔ hook ↔ teclado, aplica sua máscara/validação/submit. `src/lead-capture/` nunca importa daqui.

### Contrato de props — `VirtualKeyboard`

```ts
interface VirtualKeyboardProps {
  layout: KeyboardLayout          // já resolvido para o campo ativo
  isShifted: boolean              // estado de maiúscula/minúscula
  onKey: (key: KeyboardKey) => void   // emite tecla pressionada; LeadForm decide o efeito
  visible: boolean                // controla render quando há campo ativo
}
```

`VirtualKeyboard` **não** conhece `values`, `LeadForm` nem máscara — só renderiza `layout.rows` (ou `shiftRows` quando `isShifted`) como botões com alvo ≥44×44px (valor final do Designer) e feedback `active:`/pressed via Tailwind. Sem lógica de negócio na apresentação (regra Clean Architecture).

### Integração no `LeadForm` — dois modos, sem código morto

O `LeadForm` lê `const vkEnabled = config.leadForm.virtualKeyboard?.enabled ?? false` (default DESLIGADO — ver §4.0) e decide o modo **uma vez**:

**Regras de Hooks:** `useVirtualKeyboard(vkEnabled)` é chamado **incondicionalmente** (nunca dentro de `if`). Quando `vkEnabled === false` o hook retorna estado inerte (`activeFieldId: null`, handlers no-op) e **não registra efeitos** — sem trabalho desperdiçado nem código morto em runtime.

**Modo DESLIGADO (default / nativo):**
- Inputs renderizam com o comportamento **atual/nativo**: **sem** `readOnly`, **sem** `inputMode="none"` (exceto o `inputMode="numeric"` que `tel` já tem hoje), teclado do SO permitido, `onChange` nativo direto no `handleChange` existente.
- `VirtualKeyboard` **não é renderizado** (`{vkEnabled && activeFieldId && <VirtualKeyboard .../>}`).
- Comportamento idêntico ao de hoje → zero regressão para configs/ativações que não optam pelo teclado.

**Modo LIGADO (opt-in da ativação):**
- Cada `<input>` recebe **condicionalmente** `readOnly`, `inputMode="none"`, `onClick/onFocus → setActiveField(field.id)` e marcação visual de ativo (props montadas só quando `vkEnabled`).
- `VirtualKeyboard` renderizado **dentro do fluxo, abaixo do `<form>`**, no container já com `overflow-y-auto` — sem `position: fixed`/overlay, atendendo Cenário 6 (não cobre, não desloca). Posição/altura finais alinhadas com o Designer.
- O `onKey` do teclado chama uma função que computa o novo `raw` do campo ativo e **reaproveita o `handleChange` existente**.

**Comum aos dois modos (zero regressão):** a **assinatura e o corpo de `handleChange`, `validate`, `handleSubmit`, `applyPhoneMask` e a regex de e-mail permanecem intactos**. A máscara e a validação são do **consumidor** (`LeadForm`), não do `lead-capture` — ambos os modos passam pelo mesmo `handleChange`. Backspace/clear/shift/space são tratados por `applyKey` (núcleo) antes de cair no `handleChange`.

---

## 4.0 Contrato de config — toggle liga/desliga (por ativação)

O teclado virtual é **opcional e configurável por ativação**. Flag proposto em `GameConfig.leadForm` (`src/game/types.ts`), **opcional e retrocompatível**:

```ts
// src/game/types.ts — adição em leadForm
leadForm: {
  title: string
  virtualKeyboard?: {           // NOVO — opcional
    enabled: boolean
  }
  fields: Array<{
    id: string
    label: string
    type: 'text' | 'email' | 'tel'
    required: boolean
    mask?: string
    keyboardLayout?: string     // NOVO — opcional (ver §4); só relevante quando enabled
  }>
}
```

**Estrutura escolhida — objeto `virtualKeyboard?: { enabled: boolean }`** (em vez de um booleano solto `virtualKeyboardEnabled?`): cria um namespace que absorve **opções futuras** do teclado (ex.: `layoutOverrides`, `accents`, `locale`, `shortcuts`) sem novo campo de topo, mantendo o contrato estável para o Hub.

**Default explícito recomendado: DESLIGADO** (`enabled` ausente ou `false` ⇒ comportamento **nativo**). Justificativa:
- **Retrocompatibilidade total:** todo `config.json` existente continua se comportando exatamente como hoje (teclado do SO), sem migração.
- **Opt-in explícito** casa com a decisão do cliente ("o operador escolhe ativar"): a capability só liga quando a ativação declara `enabled: true`.
- O **totem do evento** habilita via seu próprio `config.json` (`leadForm.virtualKeyboard.enabled = true`) — é a única config que precisa mudar para o go-live.

Leitura no consumidor: `const vkEnabled = config.leadForm.virtualKeyboard?.enabled ?? false`.

---

## 4. Contrato tipo-de-campo → layout (extensível, sem hardcode dos 3 campos)

O mapeamento é um **registry de dados**, resolvido por uma função pura. Campos futuros (empresa, CPF) entram **adicionando dados**, sem reescrever componente nem hook.

```ts
// keyboardLayouts.ts
export type KeyAction = 'char' | 'backspace' | 'clear' | 'space' | 'shift'

export interface KeyboardKey {
  label: string            // o que aparece na tecla
  value?: string           // caractere(s) inseridos (ex.: 'a', '@', '@gmail.com')
  action?: KeyAction       // default 'char'
  widthUnits?: number      // largura relativa para o grid (default 1)
}

export interface KeyboardLayout {
  id: string                       // 'alpha-ptbr' | 'email' | 'numeric' | futuros
  rows: KeyboardKey[][]            // teclas minúsculas/base
  shiftRows?: KeyboardKey[][]      // variante shift (maiúsculas/acentos), se houver
  shortcutsRow?: KeyboardKey[]     // ex.: atalhos de domínio de e-mail
}

// Registry: id de layout -> definição
export const LAYOUT_REGISTRY: Record<string, KeyboardLayout> = {
  'alpha-ptbr': { /* a-z, espaço, acentos diretos: á é í ó ú ã õ â ê ô ç à, shift, backspace, clear */ },
  'email':      { /* a-z, 0-9, @, ., _, -, shortcutsRow: @gmail.com, .com.br, @hotmail.com, @outlook.com */ },
  'numeric':    { /* 0-9, backspace, clear */ },
}

// Mapa tipo-de-campo padrão -> layout (extensível por config)
const TYPE_TO_LAYOUT: Record<string, string> = {
  text: 'alpha-ptbr',
  email: 'email',
  tel: 'numeric',
}

// Resolução: prioriza override explícito no campo; cai no tipo
export function resolveLayout(field: { type: string; keyboardLayout?: string }): KeyboardLayout {
  const layoutId = field.keyboardLayout ?? TYPE_TO_LAYOUT[field.type] ?? 'alpha-ptbr'
  return LAYOUT_REGISTRY[layoutId] ?? LAYOUT_REGISTRY['alpha-ptbr']  // fallback seguro
}
```

**Extensibilidade (decisões do cliente):**
- Adicionar campo `empresa` (text) → já mapeia para `alpha-ptbr` sem código.
- Adicionar `cpf` → registrar `'numeric-cpf'` no `LAYOUT_REGISTRY` (ou reusar `numeric`) e setar `keyboardLayout: 'numeric-cpf'` no campo via `config.json`. Para isso, **estender `GameConfig.leadForm.fields[]` em `src/game/types.ts` com `keyboardLayout?: string` opcional** (retrocompatível; ausência cai no `type`). Nenhum dos 3 campos atuais precisa do campo novo.
- Atalhos de domínio (cliente: SIM no MVP) entram como `shortcutsRow` do layout `email` — dados, não código novo.

Esse contrato cumpre a decisão firme "form vai crescer → generalizar, não hardcode".

---

## 5. Estado e aplicação de tecla (núcleo puro)

`keyboardInput.ts` concentra a lógica pura e testável:

```ts
export interface ApplyKeyInput {
  currentValue: string     // valor atual do campo (já mascarado, p/ tel)
  key: KeyboardKey
  isShifted: boolean
  fieldType: string        // 'text' | 'email' | 'tel'
  hasMask: boolean
}
// Retorna { nextRaw, nextShift } — 'nextRaw' alimenta o handleChange existente
export function applyKey(input: ApplyKeyInput): { nextRaw: string; nextShift: boolean }
```

Regras:
- **char:** `nextRaw = currentValue + (isShifted ? value.toUpperCase() : value)`. Acentos são `value` diretos do layout (á, ç…), também afetados por shift.
- **backspace:**
  - tel: normaliza para dígitos (`replace(/\D/g,'')`), remove o último dígito, devolve os **dígitos crus**; o `handleChange(tel)` reaplica `applyPhoneMask` → máscara recalculada corretamente (Cenário 7).
  - demais: `currentValue.slice(0, -1)`.
- **clear:** `nextRaw = ''`.
- **space:** `nextRaw = currentValue + ' '` (apenas layouts que expõem a tecla).
- **shift:** não altera valor; alterna `nextShift` (MVP: shift "single-shot" ou toggle — decidir com Designer; default toggle simples).
- **Integração da máscara:** `applyKey` devolve **raw**; a máscara permanece centralizada no `handleChange`/`applyPhoneMask` atuais — **não duplicar** a regra da máscara (DRY). Limite de 11 dígitos continua garantido por `applyPhoneMask` (Cenário 5).

**Caret (decisão de escopo MVP):** operações de append/backspace atuam **no fim da string** (sem caret no meio do texto). Justificativa: cobre 100% dos casos do form (nome/e-mail/telefone digitados sequencialmente), reduz superfície de bug sob prazo de ≤2 semanas e **não gera dívida arquitetural** — o núcleo puro pode ganhar `caretIndex` depois sem mudar a fronteira. Documentar como decisão consciente no PR/ADR.

**Estado consolidado:**
- `values: Record<string,string>` (existente, inalterado).
- `activeFieldId: string | null` (hook).
- `isShifted: boolean` (hook).
- Layout ativo derivado: `resolveLayout(activeField)` — troca automática ao mudar de campo (Cenário 8); valores preservados porque vivem em `values`.

---

## 6. Contratos de API e Modelo de Dados

- **Contratos de API:** **nenhum**. Feature 100% client-side; não toca `supabaseClient`, `leadsDb`, `leadsSync`. O `onSubmit(values)` mantém o contrato atual.
- **Contrato de config (`GameConfig`):** duas adições **opcionais e retrocompatíveis** em `src/game/types.ts`, ambas afetando só tipos (sem migração de dados, sem mudança no shape persistido do lead):
  1. `leadForm.virtualKeyboard?: { enabled: boolean }` — toggle liga/desliga; default DESLIGADO (§4.0).
  2. `leadForm.fields[].keyboardLayout?: string` — override de layout por campo; ausência cai no `type` (§4).
- **Modelo de dados (lead persistido):** **sem migração**. O `Record<string,string>` enviado em `onSubmit`/persistido em `leadsDb` é idêntico. Configs existentes sem os novos campos continuam válidas e se comportam como hoje (modo nativo).

---

## 7. Testes (vitest) e gate de qualidade

Ambiente já configurado: `vite.config.ts` (`test.environment: 'jsdom'`, `globals: true`), `@testing-library/react`, `@testing-library/jest-dom`.

### 7.1 Núcleo puro — `keyboardLayouts.test.ts` / `keyboardInput.test.ts` (rápidos, sem DOM)
- `resolveLayout`: `text→alpha-ptbr`, `email→email`, `tel→numeric`; override `keyboardLayout` respeitado; tipo desconhecido cai no fallback seguro.
- `applyKey` char: append; **shift** insere maiúscula efetiva (Cenário 3); **acento** pt-BR (á, ã, ç) inserido corretamente (decisão cliente: acentos SIM).
- `applyKey` backspace/clear/space.
- **Máscara preservada:** sequência de dígitos via `applyKey`+`handleChange` produz `(99) 99999-9999` progressivamente; **>11 dígitos ignorados**; **backspace** no tel recalcula a máscara (Cenários 5 e 7).
- **Atalho de domínio:** tecla `@gmail.com` no layout email anexa o domínio (Cenário 4).

### 7.2 Integração — `LeadForm.test.tsx` (RTL + jsdom) — cobre os DOIS modos

**Modo LIGADO (`virtualKeyboard.enabled: true`):**
- **Supressão do nativo (contrato DOM):** cada input tem `readOnly` e `inputMode="none"` (proxy do Cenário 1; prova física = QA em totem).
- `VirtualKeyboard` é renderizado ao focar um campo.
- Tocar um campo o marca ativo e exibe o **layout correto**; trocar de campo **troca o layout e preserva valores** (Cenários 2 e 8).
- Digitar pelas teclas virtuais atualiza o valor do campo ativo.
- Máscara de telefone aplicada ao digitar pelo teclado virtual (Cenário 5).

**Modo DESLIGADO (default / config sem `virtualKeyboard` e `enabled: false`):**
- Inputs **não** têm `readOnly` nem `inputMode="none"` (exceto `numeric` no `tel`, como hoje) — teclado nativo permitido.
- `VirtualKeyboard` **não** é renderizado (ausente do DOM).
- Digitar via `onChange` nativo (`fireEvent.change`) atualiza o valor e a máscara de telefone é aplicada — **regressão do comportamento atual** preservada.

**Comum aos dois modos (regressão):**
- **Validação intacta:** obrigatório vazio bloqueia; e-mail inválido exibe "E-mail inválido" (regex atual); submit só dispara `onSubmit` com tudo válido (Cenários 10 e 11) — a lógica atual não muda em nenhum modo.

### 7.3 Gate completo como DoD (bloqueante)
Rodar e anexar evidência dos **três** no PR (sandbox-friendly, paths absolutos, sem `cd`/`source`/`export`):
```
# lint
/home/eiji/work/jogo-memoria/node_modules/.bin/eslint .
# type-check
/home/eiji/work/jogo-memoria/node_modules/.bin/tsc -b --noEmit
# testes
/home/eiji/work/jogo-memoria/node_modules/.bin/vitest run
```
- Baseline verde **antes** de iniciar; regressão verde **ao finalizar**.
- Sem `// @ts-ignore`, `eslint-disable`, `catch` genérico vazio. Erros de máscara/validação devem propagar visivelmente.
- Cobertura ≥80% no núcleo puro (`keyboardInput`/`keyboardLayouts`), que concentra a lógica de negócio.

---

## 8. Considerações técnicas

- **Performance:** render de ~40 botões; trivial. Estado por campo já existe. Sem N+1, sem I/O. Memoizar o `layout` resolvido por campo ativo evita recomputo desnecessário.
- **Segurança/LGPD:** nenhuma mudança no fluxo de consentimento/persistência; dados continuam pelo mesmo `onSubmit`. Sem secrets.
- **Escalabilidade (de produto):** o registry tipo→layout absorve novos campos/layouts por dados; multi-idioma (fora de escopo) caberia como novos layouts no mesmo registry no futuro, sem refatorar a fronteira.
- **Dependências externas:** **nenhuma nova** (decisão custom). Usa React 19 + Tailwind 4 já presentes.
- **Acessibilidade:** alvos ≥44×44px, feedback pressed, `aria-label` por tecla; exceção semântica do `readOnly` documentada em ADR.

---

## 9. ADRs a registrar (antes/junto da implementação)

1. **ADR-00X — Teclado virtual: componente próprio vs. `react-simple-keyboard`.** Decisão: custom; justificativa §1; consequências (sem dependência nova / mais código próprio).
2. **ADR-00Y — Supressão do teclado nativo via `readOnly` + `inputMode="none"`.** Inclui o trade-off de semântica de acessibilidade e a justificativa kiosk single-purpose.
3. **ADR-00Z — Teclado como capability configurável e reutilizável.** Toggle `leadForm.virtualKeyboard.enabled` (default DESLIGADO), código novo em `src/lead-capture/` consumido por standalone e Hub, e a dívida explícita de extrair o `LeadCaptureForm` numa fase posterior (com a regra `game` ⊅ `lead-capture` ⊅ `standalone`).

---

## 10. Estimativa técnica

**Story points: 5** (complexo, ~2–3 dias) — **mantida**, no limite superior do 5.

A correção do cliente (toggle liga/desliga + camada reutilizável `src/lead-capture/`) **não altera a estimativa**:
- O toggle é um **branch condicional limpo** + cobertura de testes do modo desligado (~meio dia somado), não uma nova subsystem.
- A camada reutilizável é, na prática, **escolher a pasta de nascimento do código novo** (`src/lead-capture/` em vez de `src/standalone/`) — custo marginal, e o núcleo já era desenhado puro/agnóstico. Não migramos o `LeadForm` agora (dívida diferida), o que evita o salto para 8.

Justificativa:
- **Não é 3:** múltiplas partes móveis — 3 layouts, registry extensível, integração da máscara sem duplicar regra, supressão do nativo com risco cross-device, acentos pt-BR, CSS responsivo em retrato, **dois modos (nativo/virtual) sem código morto** e superfície de teste ampla (puro + integração de ambos os modos + regressão).
- **Não é 8:** sem backend, sem dependência nova, sem migração de dados; a lógica é bem delimitada e majoritariamente **pura/testável**; reaproveita `applyPhoneMask`/`validate`/`handleSubmit`; o `LeadForm` **não** é movido agora; caret-no-fim reduz a complexidade do MVP.

### Riscos técnicos e mitigação
| Risco | Mitigação |
|---|---|
| Teclado nativo ainda aparecer em algum WebView kiosk apesar de `readOnly` | `readOnly` primário + `inputMode="none"`; **validar em totem real cedo** (QA), antes do code review final; configurar o browser kiosk |
| Semântica de `readOnly` para acessibilidade | Kiosk single-purpose sem AT (premissa); `aria-label`; ADR-00Y documentando a exceção |
| Teclado cobrir/deslocar form em retrato (Cenário 6) | Render **no fluxo** abaixo do form (sem overlay fixo) + container `overflow-y-auto`; alinhar altura/posição com o Designer |
| Edge cases de máscara + backspace no tel | Núcleo puro testado dígito a dígito; máscara centralizada (sem duplicação) |
| Shift + acentos interagindo (maiúsculas acentuadas) | Coberto por testes do `applyKey`; layout define variantes shift |
| Caret no meio do texto fora do MVP gerar pedido tardio | Decisão de escopo explícita no PR/ADR; fronteira preparada para `caretIndex` futuro sem reescrita |
| Form crescer e exigir novo layout | Registry de dados + `keyboardLayout?` opcional no config — extensão sem refatorar componente/hook |
| Código morto / hooks condicionais quando teclado desligado | `useVirtualKeyboard(vkEnabled)` chamado incondicionalmente (regras de hooks), retorna estado inerte; props e `VirtualKeyboard` montados só com `vkEnabled` — branch limpo, sem handlers órfãos |
| Regressão no modo nativo (ativações sem teclado) | Default DESLIGADO = comportamento atual; testes de integração do modo desligado garantem paridade com hoje |
| `src/lead-capture/` acoplar acidentalmente ao `standalone` (quebra reutilização do Hub) | Regra de dependência explícita (§0); núcleo agnóstico de `GameConfig`/máscara; revisão no code review checa imports proibidos |
| Dívida de não migrar o `LeadForm` agora travar o Hub depois | Issue `tech-debt` registrada; fronteira já reutilizável (Hub importa o teclado e replica só a casca do form com o mesmo contrato) |
```