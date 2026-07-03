import { describe, it, expect } from 'vitest'
import { applyKey } from '../keyboardInput'
import { applyPhoneMask } from '../../mask/phoneMask'
import { CPF_MASK } from '../../mask/maskSpec'
import type { KeyboardKey } from '../keyboardLayouts'

const char = (value: string): KeyboardKey => ({ label: value, value })
const BACKSPACE: KeyboardKey = { label: '⌫', action: 'backspace' }
const CLEAR: KeyboardKey = { label: 'Limpar', action: 'clear' }
const SPACE: KeyboardKey = { label: 'espaço', action: 'space' }
const SHIFT: KeyboardKey = { label: '⇧', action: 'shift' }
const TOGGLE_SYMBOLS: KeyboardKey = { label: '?123', action: 'toggle-symbols' }

function call(
  currentValue: string,
  key: KeyboardKey,
  opts: Partial<{
    isShifted: boolean
    fieldType: string
    hasMask: boolean
    caretStart: number
    caretEnd: number
  }> = {}
) {
  return applyKey({
    currentValue,
    key,
    isShifted: opts.isShifted ?? false,
    fieldType: opts.fieldType ?? 'text',
    hasMask: opts.hasMask ?? false,
    caretStart: opts.caretStart,
    caretEnd: opts.caretEnd,
  })
}

const tel = (caretStart?: number) => ({ fieldType: 'tel', hasMask: true, caretStart })

describe('applyKey — char', () => {
  it('anexa caractere minúsculo no fim', () => {
    expect(call('jo', char('a')).nextRaw).toBe('joa')
  })

  it('com shift insere maiúscula efetiva (Cenário 3)', () => {
    expect(call('jo', char('a'), { isShifted: true }).nextRaw).toBe('joA')
  })

  it('insere acentos pt-BR diretos (á, ã, ç)', () => {
    expect(call('jo', char('ã')).nextRaw).toBe('joã')
    expect(call('fran', char('ç')).nextRaw).toBe('franç')
    expect(call('', char('á')).nextRaw).toBe('á')
  })

  it('acento com shift vira maiúscula acentuada', () => {
    expect(call('', char('ã'), { isShifted: true }).nextRaw).toBe('Ã')
  })

  it('consome o shift (single-shot) após inserir caractere com shift ligado (Cenário 3)', () => {
    const r = call('a', char('b'), { isShifted: true })
    expect(r.nextRaw).toBe('aB') // a letra sai maiúscula
    expect(r.nextShift).toBe(false) // e o shift desliga (próxima letra minúscula)
  })

  it('char sem shift mantém o shift desligado', () => {
    expect(call('a', char('b'), { isShifted: false }).nextShift).toBe(false)
  })

  it('atalho de domínio e tecla @ também consomem o shift (single-shot)', () => {
    expect(call('joao', char('@gmail.com'), { isShifted: true }).nextShift).toBe(false)
    expect(call('joao@x', char('@'), { isShifted: true }).nextShift).toBe(false)
  })

  it('inserir dígito no tel consome o shift (single-shot)', () => {
    expect(call('(11) 9', char('8'), { ...tel(), isShifted: true }).nextShift).toBe(false)
  })
})

describe('applyKey — atalho de domínio (Cenário 4)', () => {
  it('anexa o domínio ao conteúdo atual', () => {
    expect(call('joao', char('@gmail.com')).nextRaw).toBe('joao@gmail.com')
  })

  it('regra anti-@@: substitui do @ existente em diante', () => {
    expect(call('joao@gm', char('@gmail.com')).nextRaw).toBe('joao@gmail.com')
  })

  it('tecla @ isolada não duplica @ existente', () => {
    expect(call('joao@x', char('@')).nextRaw).toBe('joao@')
  })
})

describe('applyKey — backspace', () => {
  it('remove o último caractere em texto', () => {
    expect(call('joao', BACKSPACE).nextRaw).toBe('joa')
  })

  it('em tel devolve os dígitos crus sem o último (máscara recalculada pelo consumidor — Cenário 7)', () => {
    expect(call('(11) 98', BACKSPACE, { fieldType: 'tel', hasMask: true }).nextRaw).toBe('119')
  })

  it('backspace em string vazia permanece vazio', () => {
    expect(call('', BACKSPACE).nextRaw).toBe('')
  })
})

describe('applyKey — clear / space', () => {
  it('clear esvazia o campo', () => {
    expect(call('qualquer coisa', CLEAR).nextRaw).toBe('')
  })

  it('space anexa um espaço', () => {
    expect(call('maria', SPACE).nextRaw).toBe('maria ')
  })

  it('space/backspace/clear preservam o shift (não forçam nem consomem caps)', () => {
    expect(call('maria', SPACE, { isShifted: true }).nextShift).toBe(true)
    expect(call('maria', BACKSPACE, { isShifted: true }).nextShift).toBe(true)
    expect(call('maria', CLEAR, { isShifted: true }).nextShift).toBe(true)
  })
})

describe('applyKey — shift', () => {
  it('alterna o estado de shift sem mudar o valor', () => {
    const result = call('abc', SHIFT, { isShifted: false })
    expect(result.nextRaw).toBe('abc')
    expect(result.nextShift).toBe(true)
  })

  it('toggle desliga o shift quando já ativo', () => {
    expect(call('abc', SHIFT, { isShifted: true }).nextShift).toBe(false)
  })
})

describe('applyKey — toggle-symbols (no-op preservador)', () => {
  it('não altera o valor e preserva o shift (modo é resolvido na apresentação)', () => {
    const off = call('abc', TOGGLE_SYMBOLS, { isShifted: false })
    expect(off.nextRaw).toBe('abc')
    expect(off.nextShift).toBe(false)
    const on = call('abc', TOGGLE_SYMBOLS, { isShifted: true })
    expect(on.nextRaw).toBe('abc')
    expect(on.nextShift).toBe(true)
  })
})

describe('applyKey — caret (HUB-69)', () => {
  it('insere caractere na posição do caret e avança 1 (Cenário 3)', () => {
    const r = call('Maria', char('x'), { caretStart: 3 })
    expect(r.nextRaw).toBe('Marxia')
    expect(r.nextCaret).toBe(4)
  })

  it('preserva o entorno ao inserir no meio (Cenário 6)', () => {
    expect(call('abcdef', char('Z'), { caretStart: 2 }).nextRaw).toBe('abZcdef')
  })

  it('backspace remove o caractere à esquerda do caret e recua 1 (Cenário 4)', () => {
    const r = call('Maria', BACKSPACE, { caretStart: 3 })
    expect(r.nextRaw).toBe('Maia')
    expect(r.nextCaret).toBe(2)
  })

  it('backspace com caret no início é no-op (Cenário 5)', () => {
    const r = call('Maria', BACKSPACE, { caretStart: 0 })
    expect(r.nextRaw).toBe('Maria')
    expect(r.nextCaret).toBe(0)
  })

  it('sem caretStart usa o fim da string (retrocompat — Cenário 7)', () => {
    expect(call('Mari', char('a')).nextCaret).toBe(5)
    expect(call('Maria', BACKSPACE).nextCaret).toBe(4)
  })

  it('range (start !== end) é tratado como caretStart (decisão PO 2)', () => {
    const r = call('Maria', char('x'), { caretStart: 1, caretEnd: 4 })
    expect(r.nextRaw).toBe('Mxaria')
    expect(r.nextCaret).toBe(2)
  })

  it('space insere na posição do caret e avança 1', () => {
    const r = call('abc', SPACE, { caretStart: 1 })
    expect(r.nextRaw).toBe('a bc')
    expect(r.nextCaret).toBe(2)
  })

  it('clear zera o caret; shift/toggle preservam o caret', () => {
    expect(call('abc', CLEAR, { caretStart: 2 }).nextCaret).toBe(0)
    expect(call('abc', SHIFT, { caretStart: 2 }).nextCaret).toBe(2)
    expect(call('abc', TOGGLE_SYMBOLS, { caretStart: 2 }).nextCaret).toBe(2)
  })
})

describe('applyKey — tel com caret no meio (Cenários 8 e 9)', () => {
  it('insere dígito no meio sobre os dígitos crus, reaplica máscara e posiciona o caret após o dígito', () => {
    // '(11) 98765-4' = dígitos crus '11987654'; caret 7 = logo após o 4º dígito ('8').
    const r = call('(11) 98765-4', char('0'), { ...tel(7) })
    expect(r.nextRaw).toBe('119807654')
    expect(applyPhoneMask(r.nextRaw)).toBe('(11) 98076-54')
    // caret logo após o '0' inserido (5º dígito) no valor mascarado, pulando separadores.
    expect(r.nextCaret).toBe(8)
  })

  it('respeita o teto de 11 dígitos ao inserir no meio de um número cheio', () => {
    const r = call('(11) 99999-8888', char('0'), { ...tel(6) })
    expect(r.nextRaw.length).toBe(11)
  })

  it('backspace no meio remove o dígito à esquerda (não o separador — Cenário 9)', () => {
    // caret 5 = logo após o espaço ') '; à esquerda há o 2º dígito do DDD, não o separador.
    const r = call('(11) 99999-8888', BACKSPACE, { ...tel(5) })
    expect(r.nextRaw).toBe('1999998888')
    expect(r.nextCaret).toBe(2)
  })

  it('backspace com caret antes do 1º dígito é no-op no tel', () => {
    const r = call('(11) 99', BACKSPACE, { ...tel(1) })
    expect(r.nextRaw).toBe('1199')
    expect(r.nextCaret).toBe(0)
  })

  it('backspace no fim do tel mantém o comportamento atual (retrocompat)', () => {
    expect(call('(11) 98', BACKSPACE, { fieldType: 'tel', hasMask: true }).nextRaw).toBe('119')
  })

  it('inserir no fim do tel sem caret usa o fim (retrocompat)', () => {
    const r = call('(11) 9', char('8'), { fieldType: 'tel', hasMask: true })
    expect(r.nextRaw).toBe('1198')
  })
})

describe('applyKey — máscara de CPF (HUB-91, mask explícita)', () => {
  const cpfChar = (value: string, digit: string, caretStart?: number) =>
    applyKey({
      currentValue: value,
      key: char(digit),
      isShifted: false,
      fieldType: 'tel',
      hasMask: true,
      mask: CPF_MASK,
      caretStart,
    })
  const cpfBackspace = (value: string, caretStart?: number) =>
    applyKey({
      currentValue: value,
      key: BACKSPACE,
      isShifted: false,
      fieldType: 'tel',
      hasMask: true,
      mask: CPF_MASK,
      caretStart,
    })

  it('insere dígito no fim e a máscara reformata para 000.000.000-00', () => {
    const r = cpfChar('111.444.777-3', '5')
    expect(r.nextRaw).toBe('11144477735')
    expect(CPF_MASK.format(r.nextRaw)).toBe('111.444.777-35')
  })

  it('ignora o 12º dígito (limite de 11 do CPF)', () => {
    const r = cpfChar('111.444.777-35', '9')
    expect(r.nextRaw).toBe('11144477735')
  })

  it('backspace no fim remove o último dígito, não o separador', () => {
    const r = cpfBackspace('111.444.777-35')
    expect(r.nextRaw).toBe('1114447773')
  })

  it('insere no meio sobre os dígitos crus (caret em coords mascaradas)', () => {
    const r = cpfChar('111.4', '9', 5)
    expect(r.nextRaw).toBe('11149')
  })
})
