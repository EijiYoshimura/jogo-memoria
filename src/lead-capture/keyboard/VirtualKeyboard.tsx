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

const CONTROL_ARIA_LABELS: Record<string, string> = {
  backspace: 'Apagar',
  clear: 'Limpar campo',
  space: 'Espaço',
  shift: 'Maiúscula',
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
  const sizing = naturalWidth ? 'w-[84px] h-[64px] text-2xl' : 'min-h-[60px] min-w-[40px] text-2xl px-1'
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

function KeyButton({
  k,
  isShifted,
  naturalWidth,
  active,
  onActivate,
  onLongPress,
}: {
  k: KeyboardKey
  isShifted: boolean
  naturalWidth: boolean
  active: boolean
  onActivate: (key: KeyboardKey) => void
  onLongPress: (key: KeyboardKey) => void
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

  return (
    <button
      type="button"
      aria-label={ariaLabelFor(k)}
      onClick={handleClick}
      {...(hasVariants ? handlers : {})}
      className={keyClassName(k, isShifted, naturalWidth, active)}
      style={naturalWidth ? undefined : { flexGrow: k.widthUnits ?? 1, flexBasis: 0 }}
    >
      {displayLabel(k, isShifted)}
    </button>
  )
}

function VariantPopup({
  originKey,
  isShifted,
  onSelect,
  onCancel,
}: {
  originKey: KeyboardKey
  isShifted: boolean
  onSelect: (variant: string) => void
  onCancel: () => void
}) {
  const variants = originKey.variants ?? []
  return (
    <>
      <div className="absolute inset-0 z-10" aria-hidden onClick={onCancel} />
      <div
        role="group"
        aria-label={`Variantes de ${originKey.value ?? originKey.label}`}
        className="absolute z-20 left-1/2 -translate-x-1/2 top-1 flex gap-1 rounded-2xl bg-white p-1.5 shadow-xl"
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
    </>
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

  const effectiveLayout =
    mode === 'symbols' && layout.id === 'alpha-ptbr' ? LAYOUT_REGISTRY['symbols'] : layout
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
              onActivate={handleKey}
              onLongPress={setPopupKey}
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
              onActivate={handleKey}
              onLongPress={setPopupKey}
            />
          ))}
        </div>
      ))}
      {popupKey && (
        <VariantPopup
          originKey={popupKey}
          isShifted={isShifted}
          onSelect={selectVariant}
          onCancel={() => setPopupKey(null)}
        />
      )}
    </div>
  )
}
