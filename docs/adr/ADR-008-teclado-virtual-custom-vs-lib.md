# ADR-008: Teclado virtual — componente próprio vs. `react-simple-keyboard`

**Data:** 2026-06-26
**Status:** Aceito

## Contexto

A HUB-57 exige um teclado virtual on-screen para o formulário de captura de lead em totem
retrato/touch (o teclado nativo do SO não deve subir). A complexidade real da feature —
máscara progressiva de telefone (`applyPhoneMask`), validação de e-mail, registry
tipo-de-campo → layout extensível, estado controlado por campo, acentos pt-BR e atalhos de
domínio — é **lógica de domínio que possuímos independentemente da biblioteca escolhida**.

Avaliou-se `react-simple-keyboard` (lib madura, layouts custom, theming) contra um componente
próprio. A lib só pouparia a renderização de um grid de botões (~80 linhas), ao custo de
contornar seu modelo de input/buffer interno, sobrescrever theming para o kiosk e carregar
risco de peer-dependency com React 19.

## Decisão

Implementar um **componente próprio (custom)**, sem dependência nova:

- Núcleo puro (`keyboardInput.ts` + `keyboardLayouts.ts`) — sem React/DOM/`GameConfig`.
- `VirtualKeyboard.tsx` — componente puramente apresentacional que emite eventos de tecla.
- Todo o estado vive em React (`useVirtualKeyboard`), 100% sob nosso controle.

A renderização do grid é trivial em React/Tailwind (já presentes no projeto) a partir dos dados
do registry.

## Consequências

### Positivas
- Zero dependência nova; sem risco de peer-dependency com React 19; bundle ~inalterado.
- Controle total do modelo de input (sem contornar buffer interno de uma lib).
- Teclado puramente apresentacional + núcleo puro = aderência direta a Clean Architecture.
- Código pequeno, auditável e fácil de estender (novos layouts são dados, não código).

### Negativas / Trade-offs
- Mantemos ~80 linhas de grid de botões que a lib daria de graça.
- **Fallback documentado:** se em campo o custom mostrar custo de manutenção inesperado, a lib
  fica como plano B; como a renderização está isolada no componente apresentacional sobre um
  núcleo puro, a troca entraria só na camada de renderização, a baixo custo.
