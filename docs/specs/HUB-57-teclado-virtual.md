# Spec: HUB-57 — Teclado virtual on-screen para formulário de lead (totem retrato, touch)

- **Issue:** [HUB-57](https://linear.app/hub-de-ativacoes/issue/HUB-57) · **Prioridade:** Urgent · **Estimativa:** 5 pontos
- **Discovery:** [`docs/discovery/HUB-57-teclado-virtual.md`](../discovery/HUB-57-teclado-virtual.md) (PM + PO)
- **Spec de Design (completa):** [`docs/specs/HUB-57-design.md`](./HUB-57-design.md)
- **Spec Técnica (completa):** [`docs/specs/HUB-57-tech.md`](./HUB-57-tech.md)
- **Componente alvo:** `src/standalone/LeadForm.tsx`

## Contexto

A ativação roda em **totem retrato, touch, sem teclado físico**. O teclado do SO sobrepõe a aplicação ou empurra/quebra o layout — não é confiável. Precisamos de um teclado virtual renderizado **dentro do layout, abaixo do formulário de lead**, para o participante digitar via touch. O formulário de lead é a porta de entrada obrigatória da ativação (sem enviá-lo, ninguém joga), logo qualquer fricção aqui impacta diretamente a captação de leads — o objetivo de negócio central do evento. Evento iminente (≤ 2 semanas): escopo de MVP, sem gold-plating.

**Decisões firmes do cliente (25/06):** acentos pt-BR **SIM** · form **vai crescer** (mapeamento tipo→layout generalizado) · atalhos de domínio de e-mail **SIM** no MVP · idioma único pt-BR · **o teclado é uma OPÇÃO CONFIGURÁVEL (liga/desliga) por ativação, default DESLIGADO** — não é exclusivo do standalone; a versão final do Hub consome o mesmo componente.

## User Story

**Como** participante do evento diante de um totem touch em retrato (sem teclado físico),
**quero** digitar nome, e-mail e WhatsApp por um teclado virtual na própria tela, abaixo do formulário,
**para que** eu consiga preencher e enviar meus dados de forma confiável e iniciar o jogo, sem que o teclado do SO apareça, cubra ou quebre o layout.

## Critérios de Aceite

11 cenários Given/When/Then detalhados na discovery (seção "Discovery Funcional — PO") + critérios de UX no design. Resumo:

- [ ] **C1 — Teclado nativo do SO não aparece** ao tocar qualquer campo; entrada exclusiva pelo teclado virtual.
- [ ] **C2 — Teclado virtual aparece abaixo do form** ao selecionar um campo; campo ativo marcado visualmente.
- [ ] **C3 — Layout alfabético pt-BR com acentos** para `nome`; alternância maiúscula/minúscula altera o caractere inserido.
- [ ] **C4 — Layout e-mail** com `@` e `.` sempre visíveis + atalhos de domínio (`@gmail.com`/`@hotmail.com`/`@outlook.com`); sem autocorreção/capitalização.
- [ ] **C5 — Layout numérico** para `phone` respeitando `applyPhoneMask` `(99) 99999-9999`; >11 dígitos ignorados.
- [ ] **C6 — Posicionamento retrato sem cobrir nem deslocar:** teclado abaixo do form; layout não é deslocado/redimensionado/quebrado; campo ativo com folga ≥24px acima do teclado (split-screen ancorado, não overlay).
- [ ] **C7 — Teclas mínimas:** backspace, limpar, espaço, alternar maiúscula; backspace no `phone` recalcula a máscara.
- [ ] **C8 — Troca de campo** troca o layout pelo tipo e preserva o conteúdo de cada campo.
- [ ] **C9 — Alvos de toque acessíveis** (≥44px, real ≥72px alpha / ≥120px numérico) com feedback de pressed <100ms.
- [ ] **C10 — Validação existente intacta** (obrigatório + regex de e-mail), mensagens idênticas.
- [ ] **C11 — Botão "Jogar"** só submete com campos válidos; inválido bloqueia, mostra erros e mantém o teclado.
- [ ] **C12 — Toggle configurável:** com `leadForm.virtualKeyboard.enabled = true`, o teclado virtual é exibido e os inputs ficam `readOnly`; com o flag ausente/`false` (default), o formulário usa o **teclado nativo do SO** (sem `readOnly`, sem render do teclado virtual) e mantém máscara/validação idênticas. Sem código morto em nenhum dos modos.

## Design

Resumo (completo em [`HUB-57-design.md`](./HUB-57-design.md)):

- **Split-screen ancorado, não overlay:** teclado fixo no rodapé (altura ≤ ~33% da viewport); form com scroll interno próprio. O form nunca é coberto nem reflowado; o campo ativo rola para a zona segura (≥24px acima do teclado).
- **3 layouts:** alfabético QWERTY pt-BR (`ç` fixo) com acentos via long-press + dead key `[´\`^~]`; e-mail com `@`/`.` + fileira de atalhos de domínio (regra anti-`@@`); numérico 3 colunas grandes respeitando a máscara (teclas `disabled` ao atingir 11 dígitos).
- **Mapa `TYPE_TO_LAYOUT` declarativo e extensível:** novos campos do `config.json` herdam o teclado pelo `type`.
- **Ergonomia de totem:** tecla 72×84px (numérico ≥120px), gap 10–12px, feedback de pressed no `pointerdown`, contraste robusto a branding (texto da tecla não depende de `primaryColor`).
- Wireframes ASCII dos 3 layouts em retrato no doc de design.
- **Modo desligado (default):** quando o teclado virtual está desabilitado por config, o `LeadForm` mantém o layout e o comportamento atuais com o teclado nativo do SO — nenhuma mudança visual; a feature de teclado virtual simplesmente não é renderizada.

## Spec Técnica

Resumo (completa em [`HUB-57-tech.md`](./HUB-57-tech.md)):

- **Decisão: componente próprio (custom), não `react-simple-keyboard`** — a lógica (máscara, validação, registry, estado) é nossa de qualquer forma; custom dá controle total do estado, zero dependência nova, bundle ~0, sem risco de peer-dep com React 19. Lib fica como plano B em ADR.
- **Toggle configurável (correção 25/06):** `leadForm.virtualKeyboard?: { enabled: boolean }` em `GameConfig` (objeto, para absorver opções futuras), **default DESLIGADO** (`?? false`) — retrocompatível. `useVirtualKeyboard(vkEnabled)` é chamado incondicionalmente (regras de hooks) e fica inerte quando desligado; ligado/desligado passam pelo mesmo `handleChange` (zero regressão, sem código morto).
- **Supressão do nativo (modo ligado):** `readOnly` (garantia cross-platform) + `inputMode="none"`; entrada vem do teclado virtual via o `handleChange` existente. Não usar `disabled`. No modo desligado, inputs voltam ao comportamento nativo.
- **Arquitetura — camada reutilizável `src/lead-capture/keyboard/` (não o `src/standalone/` descartável), sem tocar `src/game/`:** núcleo puro (registry tipo→layout + `applyKey`) + `useVirtualKeyboard` + `VirtualKeyboard` (apresentacional puro), agnósticos de `GameConfig`/máscara. Regra de dependência: **`game ⊅ lead-capture ⊅ standalone`**. O `LeadForm` permanece em `src/standalone/` no MVP e só importa o teclado; o **Hub pluga** importando os mesmos artefatos de `src/lead-capture/`. `applyPhoneMask`/`validate`/`handleSubmit` **intactos**.
- **Contrato extensível:** `keyboardLayout?: string` opcional e retrocompatível em `GameConfig.leadForm.fields[]`; campos futuros entram por dados.
- **Caret no fim da string** (decisão de escopo MVP; fronteira preparada para `caretIndex` futuro).
- **Sem contrato de API e sem migração de dados** — feature 100% client-side.
- **Testes (vitest):** núcleo puro (resolveLayout, applyKey, máscara, acentos, atalho) + integração RTL (supressão DOM, troca de layout, validação/regressão). Gate completo (eslint + tsc + vitest) bloqueante; cobertura ≥80% no núcleo.
- **ADRs a registrar:** custom vs. lib; supressão via `readOnly`; teclado configurável/reutilizável (ADR-00Z).

## Fora de Escopo

- Multi-idioma (só pt-BR no MVP).
- Campos além de nome/e-mail/phone (o contrato suporta, mas não entram nesta entrega).
- **Telemetria/instrumentação** do funil do form (recomendação do PM) — issue paralela, não bloqueia esta US.
- Predição de texto / autocomplete além dos atalhos de domínio.
- Caret no meio do texto.
- **Extração de um `LeadCaptureForm` reutilizável** (mover o `LeadForm` de `src/standalone/` para a camada de runtime) — dívida técnica registrada para o Hub consumir o form inteiro, não só o teclado. Não bloqueia este MVP.

## Definition of Done

- [ ] Os 11 cenários validados pelo QA em totem **retrato touch** (real ou emulado).
- [ ] Teclado do SO comprovadamente não aparece em nenhum campo (prova física do QA em totem).
- [ ] Os 3 layouts funcionam e trocam corretamente; máscara e validações idênticas ao atual.
- [ ] **Os dois modos do toggle testados:** ligado (teclado virtual + `readOnly`) e desligado/default (teclado nativo, paridade com o comportamento atual).
- [ ] Layout retrato não é deslocado nem coberto pelo teclado.
- [ ] Gate completo verde (lint + type-check + testes) com evidência no PR; cobertura ≥80% no núcleo.
- [ ] ADRs registrados.
- [ ] Code review aprovado pelo Tech Lead; PO aprova o PR; trilha de aprovação (AUD-04) registrada.
- [ ] Issue atualizada no Linear.

## Trilha de aprovação da spec

| Gate | Responsável | Status |
|------|-------------|--------|
| Spec funcional (user story + critérios) | PO | ⬜ pendente |
| Alinhamento de negócio | PM | ⬜ pendente |
| Spec de design | Designer | ⬜ pendente |
| Spec técnica + arquitetura | Tech Lead | ⬜ pendente |
| Testabilidade dos critérios | QA | ⬜ pendente |

> SDD: nenhuma linha de código antes da spec aprovada por PO + PM + Tech Lead.
