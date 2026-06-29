// Componente apresentacional: recebe um layout já resolvido + estado de shift,
// renderiza o teclado estilo smartphone (fileira numérica fixa, QWERTY, dialpad
// centralizado, modo símbolos e popup de long-press) e emite a tecla pressionada
// via onKey. Não conhece values, máscara, GameConfig nem LeadForm (Clean Architecture).
// O modo símbolos e o long-press são internos: o contrato onKey(charKey) não muda.

import { useCallback, useEffect, useState } from 'react'
import type { KeyboardKey, KeyboardLayout } from './keyboardLayouts'
import { LAYOUT_REGISTRY } from './keyboardLayouts'
import { useLongPress } from './useLongPress'

export interface VirtualKeyboardProps {
  layout: KeyboardLayout
  isShifted: boolean
  onKey: (key: KeyboardKey) => void
  visible: boolean
}

/** Alinhamento horizontal do popup relativo à tecla (clamp nas bordas). */
type PopupEdge = 'left' | 'center' | 'right'

const POPUP_ANCHOR: Record<PopupEdge, string> = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
}

const CONTROL_ARIA_LABELS: Record<string, string> = {
  backspace: 'Apagar',
  clear: 'Limpar campo',
  space: 'Espaço',
  shift: 'Maiúscula',
}

/** Posição da tecla na fileira → borda para o clamp do popup (extremidades não cortam). */
function edgeForIndex(index: number, rowLength: number): PopupEdge {
  if (index <= 1) return 'left'
  if (index >= rowLength - 2) return 'right'
  return 'center'
}

function isCharKey(key: KeyboardKey): boolean {
  return (key.action ?? 'char') === 'char'
}

function ariaLabelFor(key: KeyboardKey): string | undefined {
  if (key.action === 'toggle-symbols') return key.label === 'ABC' ? 'Letras' : 'Símbolos'
  return key.action ? CONTROL_ARIA_LABELS[key.action] : undefined
}

function displayLabel(key: KeyboardKey, isShifted: boolean): string {
  if (isCharKey(key) && key.value && key.value.length === 1) {
    return isShifted ? key.value.toUpperCase() : key.value
  }
  return key.label
}

function keyClassName(key: KeyboardKey, isShifted: boolean, naturalWidth: boolean, active: boolean): string {
  const base =
    'flex items-center justify-center rounded-xl select-none transition-transform ' +
    'active:scale-95 touch-manipulation font-medium'
  const sizing = naturalWidth ? 'w-[84px] h-[64px] text-2xl' : 'w-full min-h-[60px] text-2xl px-1'
  const shiftActive = key.action === 'shift' && isShifted
  let palette: string
  if (shiftActive || active) {
    palette = 'bg-[#FCFC30] text-[#0A2472]'
  } else if (!isCharKey(key)) {
    palette = 'bg-white/12 text-white active:bg-white/30'
  } else {
    palette = 'bg-white text-[#0A2472] active:bg-[#FCFC30]'
  }
  return `${base} ${sizing} ${palette}`
}

function VariantBalloon({
  originKey,
  isShifted,
  edge,
  onSelect,
}: {
  originKey: KeyboardKey
  isShifted: boolean
  edge: PopupEdge
  onSelect: (variant: string) => void
}) {
  const variants = originKey.variants ?? []
  return (
    <div
      role="group"
      aria-label={`Variantes de ${originKey.value ?? originKey.label}`}
      className={
        'absolute bottom-full z-30 mb-2 flex gap-1 rounded-2xl bg-white p-1.5 ' +
        'border-2 border-[#FCFC30] shadow-2xl ' +
        POPUP_ANCHOR[edge]
      }
    >
      {variants.map((v, i) => {
        const shown = isShifted ? v.toUpperCase() : v
        return (
          <button
            key={`v-${i}`}
            type="button"
            aria-label={shown}
            onClick={() => onSelect(v)}
            className="flex min-h-[52px] min-w-[48px] items-center justify-center rounded-xl text-2xl text-[#0A2472] transition-transform active:scale-95 active:bg-[#FCFC30] touch-manipulation"
          >
            {shown}
          </button>
        )
      })}
    </div>
  )
}

function KeyButton({
  k,
  isShifted,
  naturalWidth,
  active,
  edge,
  popupOpen,
  onActivate,
  onLongPress,
  onSelectVariant,
}: {
  k: KeyboardKey
  isShifted: boolean
  naturalWidth: boolean
  active: boolean
  edge: PopupEdge
  popupOpen: boolean
  onActivate: (key: KeyboardKey) => void
  onLongPress: (key: KeyboardKey) => void
  onSelectVariant: (variant: string) => void
}) {
  const hasVariants = isCharKey(k) && !!k.variants && k.variants.length > 0
  const handleLongPress = useCallback(() => onLongPress(k), [onLongPress, k])
  const { handlers, consumeSuppressedClick } = useLongPress({
    onLongPress: handleLongPress,
    enabled: hasVariants,
  })

  function handleClick() {
    // Após um long-press, o click sintético do pointerup é suprimido (não insere a base).
    if (consumeSuppressedClick()) return
    onActivate(k)
  }

  // A célula é o item flex da fileira; o popup é ancorado nela (relative) → segue a coluna da tecla.
  return (
    <div
      className="relative flex"
      style={naturalWidth ? undefined : { flexGrow: k.widthUnits ?? 1, flexBasis: 0 }}
    >
      <button
        type="button"
        aria-label={ariaLabelFor(k)}
        onClick={handleClick}
        {...(hasVariants ? handlers : {})}
        className={keyClassName(k, isShifted, naturalWidth, active)}
      >
        {displayLabel(k, isShifted)}
      </button>
      {popupOpen && (
        <VariantBalloon
          originKey={k}
          isShifted={isShifted}
          edge={edge}
          onSelect={onSelectVariant}
        />
      )}
    </div>
  )
}

export function VirtualKeyboard({ layout, isShifted, onKey, visible }: VirtualKeyboardProps) {
  const [mode, setMode] = useState<'alpha' | 'symbols'>('alpha')
  const [popupKey, setPopupKey] = useState<KeyboardKey | null>(null)

  // Trocar de campo (novo layout) reseta modo e fecha o popup — sem vazamento entre campos.
  useEffect(() => {
    setMode('alpha')
    setPopupKey(null)
  }, [layout.id])

  const handleKey = useCallback(
    (k: KeyboardKey) => {
      if (k.action === 'toggle-symbols') {
        setMode((m) => (m === 'symbols' ? 'alpha' : 'symbols'))
        return
      }
      onKey(k)
    },
    [onKey]
  )

  const selectVariant = useCallback(
    (variant: string) => {
      onKey({ label: variant, value: variant })
      setPopupKey(null)
    },
    [onKey]
  )

  if (!visible) return null

  // Símbolos (?123) valem para o alfanumérico e para o e-mail — ambos têm a tecla de toggle.
  const canUseSymbols = layout.id === 'alpha-ptbr' || layout.id === 'email'
  const effectiveLayout =
    mode === 'symbols' && canUseSymbols ? LAYOUT_REGISTRY['symbols'] : layout
  const naturalWidth = effectiveLayout.align === 'center'
  const baseRows =
    isShifted && effectiveLayout.shiftRows ? effectiveLayout.shiftRows : effectiveLayout.rows

  return (
    <div
      role="group"
      aria-label="Teclado virtual"
      className="relative w-full shrink-0 flex flex-col gap-1.5 p-2 bg-[#022a9e]"
    >
      {effectiveLayout.shortcutsRow && (
        <div className="flex gap-1.5">
          {effectiveLayout.shortcutsRow.map((k, i) => (
            <KeyButton
              key={`s-${i}`}
              k={k}
              isShifted={isShifted}
              naturalWidth={false}
              active={false}
              edge="center"
              popupOpen={false}
              onActivate={handleKey}
              onLongPress={setPopupKey}
              onSelectVariant={selectVariant}
            />
          ))}
        </div>
      )}
      {baseRows.map((row, rowIndex) => (
        <div key={`r-${rowIndex}`} className="flex gap-1.5 justify-center">
          {row.map((k, i) => (
            <KeyButton
              key={`${rowIndex}-${i}`}
              k={k}
              isShifted={isShifted}
              naturalWidth={naturalWidth}
              active={popupKey === k}
              edge={edgeForIndex(i, row.length)}
              popupOpen={popupKey === k}
              onActivate={handleKey}
              onLongPress={setPopupKey}
              onSelectVariant={selectVariant}
            />
          ))}
        </div>
      ))}
      {/* Backdrop: clicar/soltar fora do popup cancela sem inserir (z abaixo do balão). */}
      {popupKey && (
        <div
          className="absolute inset-0 z-10"
          aria-hidden
          onClick={() => setPopupKey(null)}
        />
      )}
    </div>
  )
}
