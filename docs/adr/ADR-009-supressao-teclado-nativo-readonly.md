# ADR-009: Supressão do teclado nativo do SO via `readOnly` + `inputMode="none"`

**Data:** 2026-06-26
**Status:** Aceito

## Contexto

No modo LIGADO do teclado virtual (`leadForm.virtualKeyboard.enabled === true`), o teclado
nativo do SO **não deve subir** ao tocar num campo — a entrada vem exclusivamente do teclado
virtual on-screen. É preciso um mecanismo cross-platform (iOS/Android/WebView kiosk) que impeça
o VK nativo sem quebrar foco, seleção por toque, semântica de form nem o submit.

## Decisão

Aplicar, **somente no modo ligado e condicionalmente**, no `<input>`:

- `readOnly` (mecanismo **primário**): garante cross-platform que o teclado nativo não sobe,
  pois o campo não é editável pelo SO; mantém foco, estilo de foco, semântica de form e submit
  (diferente de `disabled`, que ficaria cinza, não focável e fora do submit).
- `inputMode="none"` (**reforço** belt-and-suspenders): sinaliza ao browser para não exibir VK
  mesmo em foco programático.
- `onClick`/`onFocus` → `setActiveField(field.id)`: o toque seleciona o campo ativo.

A entrada do teclado virtual atualiza o estado React (`values`) pelo mesmo `handleChange`
existente; o `value` segue controlado. **Não** se usa `pointerEvents:none` nem `tabIndex=-1`
(quebrariam seleção por toque e foco visual).

No modo DESLIGADO (default) nada disso é aplicado — comportamento nativo idêntico ao atual.

## Consequências

### Positivas
- Supressão confiável e cross-device do teclado nativo sem perder semântica de form/submit.
- Sem regressão no modo desligado (props aplicadas só quando `vkEnabled`).

### Negativas / Trade-offs
- **Acessibilidade:** `readOnly` é anunciado como "somente leitura" por leitores de tela —
  semanticamente impreciso para um campo que aceita entrada via teclado virtual. Mitigação:
  o totem é **single-purpose kiosk sem tecnologia assistiva** (premissa da discovery);
  mantêm-se `label`/`aria-label` e marcação visual do campo ativo.
- **Limite de teste:** jsdom/RTL não provam que o SO físico não exibe o teclado. Os testes
  validam o **contrato DOM** (`readOnly` + `inputMode="none"` + entrada exclusiva via VK); a
  prova física final do Cenário 1 é validação do QA em totem retrato real (exigida na DoD).
