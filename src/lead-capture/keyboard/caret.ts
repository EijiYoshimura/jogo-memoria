// Medição de texto e geometria do caret customizado do teclado virtual (HUB-78).
//
// Sob VK os inputs voltam a ser `readOnly` (única forma confiável de suprimir o
// teclado nativo no Android). `readOnly` esconde o caret nativo, então renderizamos
// um caret próprio. Estas funções são o núcleo testável dessa renderização:
// `caretIndexFromOffset` (toque → índice) e o clamp são puros; a medição real usa
// canvas (`measureText`) e é injetável atrás de `TextMeasurer`, pois o jsdom não
// implementa `measureText` — nesses casos o consumidor injeta um medidor fake.

/** Mede a largura em pixels de um trecho de texto na fonte do input. */
export type TextMeasurer = (text: string) => number

/** Fonte do input do formulário (HUB-65): 20px BB Textos. */
export const INPUT_FONT = '20px "BB Textos", ui-sans-serif, sans-serif'

// Um único canvas/medidor por fonte para todo o processo: criar o contexto por mount
// é desperdício e, em jsdom, dispara o aviso "getContext não implementado" a cada render.
const measurerCache = new Map<string, TextMeasurer>()

/**
 * Cria (ou reaproveita) um medidor de largura via canvas 2D na fonte informada. Em
 * ambientes sem suporte a canvas/measureText (ex.: jsdom), o contexto é `null` e
 * devolvemos um medidor neutro (sempre 0) — caminho previsto, não um erro a silenciar;
 * nesses ambientes o consumidor injeta um medidor próprio para os testes de geometria.
 */
export function createCanvasTextMeasurer(font: string): TextMeasurer {
  const cached = measurerCache.get(font)
  if (cached) return cached
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  const context = canvas?.getContext('2d') ?? null
  const measurer: TextMeasurer = context
    ? (text: string) => {
        context.font = font
        return context.measureText(text).width
      }
    : () => 0
  measurerCache.set(font, measurer)
  return measurer
}

/** Restringe um índice de caret ao intervalo válido [0, length]. */
export function clampCaretIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length))
}

/**
 * Índice de caret cujo prefixo melhor se aproxima de `offsetX` — a coordenada do
 * toque já convertida para o sistema de conteúdo (descontados borda, padding e
 * scroll do input). Como a largura do prefixo é monotônica crescente, varre da
 * esquerda e para assim que ultrapassa o offset, escolhendo o índice de menor
 * distância. Retorno em [0, value.length].
 */
export function caretIndexFromOffset(
  offsetX: number,
  value: string,
  measure: TextMeasurer
): number {
  if (offsetX <= 0) return 0
  let bestIndex = 0
  let bestDistance = offsetX // distância do prefixo vazio (largura 0)
  for (let index = 1; index <= value.length; index++) {
    const width = measure(value.slice(0, index))
    const distance = Math.abs(width - offsetX)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
    if (width >= offsetX) break // monotônico: além daqui a distância só cresce
  }
  return bestIndex
}

/**
 * Novo `scrollLeft` que mantém o caret (em `caretX`, coords de conteúdo) visível
 * dentro da janela do input, com uma margem igual ao padding. Devolve o próprio
 * `scrollLeft` quando o caret já está visível ou quando a largura útil é 0
 * (ex.: layout ainda não medido no jsdom).
 */
export function nextVisibleScrollLeft(
  caretX: number,
  scrollLeft: number,
  clientWidth: number,
  margin: number
): number {
  if (clientWidth <= 0) return scrollLeft
  if (caretX < scrollLeft + margin) return Math.max(0, caretX - margin)
  if (caretX > scrollLeft + clientWidth - margin) {
    return Math.max(0, caretX - clientWidth + margin)
  }
  return scrollLeft
}
