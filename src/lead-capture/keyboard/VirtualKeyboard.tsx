// Componente apresentacional PURO: recebe um layout já resolvido + estado de shift,
// renderiza o grid de teclas e emite a tecla pressionada via onKey.
// Não conhece values, máscara, GameConfig nem LeadForm (Clean Architecture).

import type { KeyboardKey, KeyboardLayout } from './keyboardLayouts'

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

function displayLabel(key: KeyboardKey, isShifted: boolean): string {
  if (isCharKey(key) && key.value && key.value.length === 1) {
    return isShifted ? key.value.toUpperCase() : key.value
  }
  return key.label
}

function keyClassName(key: KeyboardKey): string {
  const base =
    'flex items-center justify-center rounded-xl select-none transition-transform ' +
    'active:scale-95 touch-manipulation font-medium'
  const sizing = 'min-h-[72px] min-w-[44px] text-2xl px-2'
  const isControl = !isCharKey(key)
  const palette = isControl
    ? 'bg-white/15 text-white active:bg-white/30'
    : 'bg-white text-gray-900 active:bg-purple-200'
  return `${base} ${sizing} ${palette}`
}

function KeyButton({
  k,
  isShifted,
  onKey,
}: {
  k: KeyboardKey
  isShifted: boolean
  onKey: (key: KeyboardKey) => void
}) {
  const ariaLabel = k.action ? CONTROL_ARIA_LABELS[k.action] : undefined
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onKey(k)}
      className={keyClassName(k)}
      style={{ flexGrow: k.widthUnits ?? 1, flexBasis: 0 }}
    >
      {displayLabel(k, isShifted)}
    </button>
  )
}

export function VirtualKeyboard({ layout, isShifted, onKey, visible }: VirtualKeyboardProps) {
  if (!visible) return null

  const baseRows = isShifted && layout.shiftRows ? layout.shiftRows : layout.rows

  return (
    <div
      role="group"
      aria-label="Teclado virtual"
      className="w-full shrink-0 flex flex-col gap-2 p-3 bg-black/30"
    >
      {layout.shortcutsRow && (
        <div className="flex gap-2">
          {layout.shortcutsRow.map((k, i) => (
            <KeyButton key={`s-${i}`} k={k} isShifted={isShifted} onKey={onKey} />
          ))}
        </div>
      )}
      {baseRows.map((row, rowIndex) => (
        <div key={`r-${rowIndex}`} className="flex gap-2 justify-center">
          {row.map((k, i) => (
            <KeyButton key={`${rowIndex}-${i}`} k={k} isShifted={isShifted} onKey={onKey} />
          ))}
        </div>
      ))}
    </div>
  )
}
