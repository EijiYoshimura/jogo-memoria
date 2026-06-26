// Superfície pública da capability de teclado virtual.
// Consumida pelo standalone (LeadForm) hoje e pelo Hub futuro — sem reescrever o teclado.

export type {
  KeyAction,
  KeyboardKey,
  KeyboardLayout,
  FieldDescriptor,
} from './keyboardLayouts'
export { LAYOUT_REGISTRY, resolveLayout } from './keyboardLayouts'

export type { ApplyKeyInput, ApplyKeyResult } from './keyboardInput'
export { applyKey } from './keyboardInput'

export type { VirtualKeyboardState } from './useVirtualKeyboard'
export { useVirtualKeyboard } from './useVirtualKeyboard'

export type { VirtualKeyboardProps } from './VirtualKeyboard'
export { VirtualKeyboard } from './VirtualKeyboard'
