import { clampCaretIndex, type TextMeasurer } from '../lead-capture/keyboard/caret'

// Geometria do input pill do formulário (HUB-65): `px-5` = 20px de padding lateral
// e `border-4` = 4px de borda. O conteúdo (texto) começa a borda + padding da
// extremidade esquerda do input — é a origem das coordenadas do caret e do toque.
export const INPUT_PADDING_LEFT_PX = 20
export const INPUT_BORDER_PX = 4
export const CONTENT_LEFT_OFFSET_PX = INPUT_PADDING_LEFT_PX + INPUT_BORDER_PX
const CARET_HEIGHT_PX = 24

interface CaretOverlayProps {
  /** Valor exibido no input (já mascarado, no caso de tel). */
  value: string
  /** Posição do caret em caracteres do `value`. */
  caretPos: number
  /** Medidor de largura na fonte do input (injetável p/ testes). */
  measure: TextMeasurer
  /** `scrollLeft` atual do input (textos que estouram a largura). */
  scrollLeft: number
}

/**
 * Caret customizado (HUB-78): barra azul piscante posicionada sobre o input
 * `readOnly`, já que o caret nativo some sob `readOnly`. A posição horizontal é a
 * largura do texto à esquerda do caret, na fonte real, mais a origem do conteúdo,
 * menos o scroll. Pisca via CSS (`.vk-caret`). Renderizado apenas pelo campo ativo.
 */
export function CaretOverlay({ value, caretPos, measure, scrollLeft }: CaretOverlayProps) {
  const clamped = clampCaretIndex(caretPos, value.length)
  const left = CONTENT_LEFT_OFFSET_PX + measure(value.slice(0, clamped)) - scrollLeft
  return (
    <span
      aria-hidden
      data-testid="vk-caret"
      className="vk-caret pointer-events-none absolute w-[2px] bg-[#0333BD]"
      style={{
        left: `${left}px`,
        top: '50%',
        height: `${CARET_HEIGHT_PX}px`,
        transform: 'translateY(-50%)',
      }}
    />
  )
}
