// Núcleo puro (sem React, sem DOM, sem GameConfig): registry tipo→layout + tipos.
// Camada reutilizável `src/lead-capture/`. Regra de dependência: game ⊅ lead-capture ⊅ standalone.

export type KeyAction = 'char' | 'backspace' | 'clear' | 'space' | 'shift' | 'toggle-symbols'

export interface KeyboardKey {
  /** Texto exibido na tecla. */
  label: string
  /** Caractere(s) inseridos (ex.: 'a', '@', '@gmail.com'). Só para action 'char'. */
  value?: string
  /** Ação da tecla; default 'char'. */
  action?: KeyAction
  /** Largura relativa no grid (flex-grow); default 1. Ignorado quando o layout é `align: 'center'`. */
  widthUnits?: number
  /**
   * Variantes de long-press (minúsculas, ordem pt-BR). Ex.: 'a' → ['á','ã','â','à','ä'].
   * Apenas dado: a apresentação aplica `toUpperCase()` quando `isShifted`.
   */
  variants?: string[]
}

export interface KeyboardLayout {
  /** Identificador do layout: 'alpha-ptbr' | 'email' | 'numeric' | 'symbols' | futuros. */
  id: string
  /** Teclas base (minúsculas). */
  rows: KeyboardKey[][]
  /** Variante shift explícita (opcional); quando ausente, o caso é derivado por isShifted. */
  shiftRows?: KeyboardKey[][]
  /** Fileira de atalhos (ex.: domínios de e-mail). */
  shortcutsRow?: KeyboardKey[]
  /**
   * Distribuição das teclas na fileira.
   * 'fill' (default) = flex-grow ocupando a largura; 'center' = largura natural + justify-center (dialpad).
   */
  align?: 'fill' | 'center'
}

/** Variantes acentuadas por tecla (pt-BR), ordem priorizando as formas mais comuns. */
const VARIANTS: Record<string, string[]> = {
  a: ['á', 'ã', 'â', 'à', 'ä'],
  e: ['é', 'ê', 'è', 'ë'],
  i: ['í', 'î', 'ì', 'ï'],
  o: ['ó', 'õ', 'ô', 'ò', 'ö'],
  u: ['ú', 'û', 'ù', 'ü'],
  c: ['ç'],
  n: ['ñ'],
}

const charKey = (c: string): KeyboardKey =>
  VARIANTS[c] ? { label: c, value: c, variants: VARIANTS[c] } : { label: c, value: c }
const charRow = (chars: string): KeyboardKey[] => chars.split('').map(charKey)

const SHIFT_KEY: KeyboardKey = { label: '⇧', action: 'shift' }
const BACKSPACE_KEY: KeyboardKey = { label: '⌫', action: 'backspace' }
const CLEAR_KEY: KeyboardKey = { label: 'Limpar', action: 'clear', widthUnits: 2 }
const SPACE_KEY: KeyboardKey = { label: 'espaço', action: 'space', widthUnits: 5 }
const TO_SYMBOLS_KEY: KeyboardKey = { label: '?123', action: 'toggle-symbols', widthUnits: 2 }
const TO_ALPHA_KEY: KeyboardKey = { label: 'ABC', action: 'toggle-symbols', widthUnits: 2 }
const PERIOD_KEY = charKey('.')

const ALPHA_PTBR: KeyboardLayout = {
  id: 'alpha-ptbr',
  rows: [
    charRow('1234567890'), // fileira numérica fixa estilo smartphone (Cenário 1/2)
    charRow('qwertyuiop'),
    charRow('asdfghjkl'),
    [SHIFT_KEY, ...charRow('zxcvbnm'), BACKSPACE_KEY],
    [TO_SYMBOLS_KEY, SPACE_KEY, PERIOD_KEY],
  ],
}

const SYMBOLS: KeyboardLayout = {
  id: 'symbols',
  rows: [
    charRow('1234567890'),
    [
      charKey('@'),
      charKey('#'),
      charKey('$'),
      charKey('_'),
      charKey('&'),
      charKey('-'),
      charKey('+'),
      charKey('('),
      charKey(')'),
      charKey('/'),
    ],
    [
      charKey('*'),
      charKey('"'),
      charKey("'"),
      charKey(':'),
      charKey(';'),
      charKey('!'),
      charKey('?'),
      charKey(','),
      BACKSPACE_KEY,
    ],
    [TO_ALPHA_KEY, SPACE_KEY, PERIOD_KEY],
  ],
}

const EMAIL: KeyboardLayout = {
  id: 'email',
  shortcutsRow: [
    { label: '@gmail.com', value: '@gmail.com' },
    { label: '@hotmail.com', value: '@hotmail.com' },
    { label: '@outlook.com', value: '@outlook.com' },
  ],
  rows: [
    charRow('qwertyuiop'),
    charRow('asdfghjkl'),
    [SHIFT_KEY, ...charRow('zxcvbnm'), BACKSPACE_KEY],
    [charKey('@'), charKey('.'), SPACE_KEY, charKey('-'), charKey('_'), CLEAR_KEY],
  ],
}

const NUMERIC: KeyboardLayout = {
  id: 'numeric',
  align: 'center', // dialpad: teclas de largura natural, centralizadas (Cenário 9)
  rows: [
    charRow('123'),
    charRow('456'),
    charRow('789'),
    [BACKSPACE_KEY, charKey('0'), CLEAR_KEY],
  ],
}

/** Registry: id de layout → definição. */
export const LAYOUT_REGISTRY: Record<string, KeyboardLayout> = {
  'alpha-ptbr': ALPHA_PTBR,
  symbols: SYMBOLS,
  email: EMAIL,
  numeric: NUMERIC,
}

/** Mapa tipo-de-campo padrão → id de layout (extensível por dados). */
const TYPE_TO_LAYOUT: Record<string, string> = {
  text: 'alpha-ptbr',
  email: 'email',
  tel: 'numeric',
}

const FALLBACK_LAYOUT_ID = 'alpha-ptbr'

export interface FieldDescriptor {
  type: string
  /** Override explícito de layout por campo; ausência cai no tipo. */
  keyboardLayout?: string
}

/** Resolve o layout do campo: prioriza override explícito, cai no tipo, fallback seguro. */
export function resolveLayout(field: FieldDescriptor): KeyboardLayout {
  const layoutId = field.keyboardLayout ?? TYPE_TO_LAYOUT[field.type] ?? FALLBACK_LAYOUT_ID
  return LAYOUT_REGISTRY[layoutId] ?? LAYOUT_REGISTRY[FALLBACK_LAYOUT_ID]
}
