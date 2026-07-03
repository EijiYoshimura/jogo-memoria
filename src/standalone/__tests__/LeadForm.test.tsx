import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { LeadForm } from '../LeadForm'
import { checkCpfParticipation, type CpfLookupResult } from '../lib/cpfLookup'
import type { GameConfig } from '../../game/types'

// A consulta online do gate de CPF (HUB-91) fica atrás deste módulo — mockado para não
// tocar Supabase e permitir controlar o resultado por teste. Default: CPF novo.
vi.mock('../lib/cpfLookup', () => ({ checkCpfParticipation: vi.fn() }))
const mockLookup = vi.mocked(checkCpfParticipation)
beforeEach(() => {
  mockLookup.mockReset()
  mockLookup.mockResolvedValue({ status: 'not-found' })
})

function makeConfig(virtualKeyboardEnabled?: boolean): GameConfig {
  return {
    event: {
      id: 'e',
      name: 'Evento',
      logo: '',
      primaryColor: '#7C3AED',
      backgroundColor: '#1E1B4B',
    },
    game: { pairs: 6, cardImages: [], cardBack: '', timeLimitSeconds: 60 },
    leadForm: {
      title: 'Preencha seus dados',
      ...(virtualKeyboardEnabled === undefined
        ? {}
        : { virtualKeyboard: { enabled: virtualKeyboardEnabled } }),
      fields: [
        { id: 'name', label: 'Nome completo', type: 'text', required: true },
        { id: 'email', label: 'E-mail', type: 'email', required: true },
        { id: 'phone', label: 'WhatsApp', type: 'tel', required: false, mask: '(99) 99999-9999' },
      ],
    },
    offlineExportPin: '1234',
  }
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement
const vkey = (name: string) =>
  within(screen.getByRole('group', { name: 'Teclado virtual' })).getByRole('button', { name })
const consentCheckbox = () => screen.getByRole('checkbox')
const acceptConsent = () => fireEvent.click(consentCheckbox())

// CPFs válidos/ inválidos usados nos testes do gate (HUB-91).
const VALID_CPF = '111.444.777-35'
const VALID_CPF_DIGITS = '11144477735'
const INVALID_CPF = '111.444.777-34'

/** Preenche o CPF (1º campo) e aguarda o gate resolver (spinner some). */
async function fillCpf(cpf: string = VALID_CPF) {
  fireEvent.change(input('cpf'), { target: { value: cpf } })
  await waitFor(() => expect(screen.queryByTestId('cpf-spinner')).toBeNull())
}

describe('LeadForm — modo LIGADO (virtualKeyboard.enabled: true)', () => {
  it('sob VK os inputs são readOnly (suprime teclado nativo Android), sem inputMode (HUB-78)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    for (const id of ['name', 'email', 'phone']) {
      // readOnly suprime o teclado nativo de forma confiável e continua focável.
      expect(input(id).readOnly).toBe(true)
      // sem inputMode none (que era inconsistente no Android); readOnly já basta.
      expect(input(id).getAttribute('inputmode')).toBeNull()
    }
  })

  it('readOnly bloqueia mutação nativa; só o teclado virtual muta o valor (HUB-78)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    // sem o caret-color nativo: o caret é o CaretOverlay customizado.
    expect(input('name').className).not.toContain('caret-[#0333BD]')
    // readOnly garante que a digitação nativa não altera o valor.
    expect(input('name').readOnly).toBe(true)
  })

  it('sem VK os inputs não são readOnly (teclado nativo, paridade atual)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(input('name').readOnly).toBe(false)
    expect(fireEvent.keyDown(input('name'), { key: 'a' })).toBe(true)
  })

  it('não renderiza o teclado até um campo ser focado; renderiza ao focar (Cenário 2)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Teclado virtual' })).toBeNull()
    fireEvent.click(input('name'))
    expect(screen.getByRole('group', { name: 'Teclado virtual' })).toBeDefined()
  })

  it('digita pelo teclado virtual atualizando o campo ativo (auto-shift capitaliza a 1ª — HUB-71)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    // name vazio → auto-shift arma a 1ª letra maiúscula (a tecla exibe 'J').
    fireEvent.click(vkey('J'))
    fireEvent.click(vkey('o'))
    expect(input('name').value).toBe('Jo')
  })

  it('troca o layout pelo tipo do campo e preserva valores (Cenários 5 e 8)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    // name vazio → auto-shift: 1ª letra maiúscula (tecla 'A').
    fireEvent.click(vkey('A'))
    // troca para o campo phone → layout numérico (tecla '1' existe; 'a' não)
    fireEvent.click(input('phone'))
    expect(vkey('1')).toBeDefined()
    expect(
      within(screen.getByRole('group', { name: 'Teclado virtual' })).queryByRole('button', {
        name: 'a',
      })
    ).toBeNull()
    // valor do name preservado ao voltar
    fireEvent.click(input('name'))
    expect(input('name').value).toBe('A')
  })

  it('aplica a máscara de telefone ao digitar pelo teclado virtual e ignora >11 dígitos (Cenário 5)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('phone'))
    for (const d of '11999998888'.split('')) fireEvent.click(vkey(d))
    expect(input('phone').value).toBe('(11) 99999-8888')
    // 12º dígito é ignorado pela máscara
    fireEvent.click(vkey('7'))
    expect(input('phone').value).toBe('(11) 99999-8888')
  })

  it('backspace no telefone recalcula a máscara (Cenário 7)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('phone'))
    for (const d of '1199'.split('')) fireEvent.click(vkey(d))
    expect(input('phone').value).toBe('(11) 99')
    fireEvent.click(vkey('Apagar'))
    expect(input('phone').value).toBe('(11) 9')
  })
})

describe('LeadForm — edição com caret (HUB-69)', () => {
  // Digita no campo name. O auto-shift (HUB-71) capitaliza a 1ª letra do nome vazio, então a
  // 1ª tecla é exibida em maiúscula; as demais saem minúsculas (single-shot). Resultado: a
  // string com a inicial maiúscula. O foco aqui é a posição do caret, não a capitalização.
  function typeName(text: string) {
    fireEvent.click(input('name'))
    text.split('').forEach((c, i) => fireEvent.click(vkey(i === 0 ? c.toUpperCase() : c)))
  }

  // Caret customizado (HUB-78): o estado vive em React (caretPos) e é renderizado pelo
  // CaretOverlay, não mais via selectionStart nativo. Medidor determinístico (10px/char)
  // e origem do conteúdo (borda 4px + padding 20px) tornam a posição do caret verificável.
  const FAKE_MEASURE = (text: string) => text.length * 10
  const CONTENT_LEFT_OFFSET = 24
  const renderVK = () =>
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} measureText={FAKE_MEASURE} />)
  const caret = () => document.querySelector('[data-testid="vk-caret"]') as HTMLElement | null
  const caretLeft = () => caret()?.style.left ?? null
  // Toque-para-posicionar: converte o índice-alvo em clientX (rect.left e scroll = 0 no jsdom).
  const tapCaret = (id: string, index: number) =>
    fireEvent.pointerDown(input(id), { clientX: CONTENT_LEFT_OFFSET + index * 10 })

  it('posiciona o caret customizado ao fim após digitar pelo teclado virtual (Cenário 7)', () => {
    renderVK()
    typeName('maria')
    expect(input('name').value).toBe('Maria')
    // caret ao fim: 24 (origem) + 5 chars × 10px.
    expect(caretLeft()).toBe('74px')
  })

  it('toque posiciona o caret e a tecla insere no meio, avançando 1 (Cenários 2/3)', () => {
    renderVK()
    typeName('maria')
    tapCaret('name', 3) // toque entre 'Mar' e 'ia'
    fireEvent.click(vkey('x'))
    expect(input('name').value).toBe('Marxia')
    // caret avançou para 4: 24 + 4 × 10.
    expect(caretLeft()).toBe('64px')
  })

  it('backspace remove o caractere à esquerda do caret no meio (Cenário 4)', () => {
    renderVK()
    typeName('maria')
    tapCaret('name', 3)
    fireEvent.click(vkey('Apagar'))
    expect(input('name').value).toBe('Maia')
    // caret recuou para 2: 24 + 2 × 10.
    expect(caretLeft()).toBe('44px')
  })

  it('backspace com caret no início é no-op (Cenário 5)', () => {
    renderVK()
    typeName('maria')
    tapCaret('name', 0)
    fireEvent.click(vkey('Apagar'))
    expect(input('name').value).toBe('Maria')
    // caret permanece no início: 24 + 0.
    expect(caretLeft()).toBe('24px')
  })

  it('edita o telefone no meio reaplicando a máscara e reposicionando o caret (Cenário 8)', () => {
    renderVK()
    fireEvent.click(input('phone'))
    for (const d of '1198765') fireEvent.click(vkey(d))
    expect(input('phone').value).toBe('(11) 98765')
    tapCaret('phone', 7) // logo após o 4º dígito ('8')
    fireEvent.click(vkey('0'))
    expect(input('phone').value).toBe('(11) 98076-5')
    // caret 8 no valor mascarado: 24 + 8 × 10.
    expect(caretLeft()).toBe('104px')
  })

  it('mantém type=email sob VK (sem remap; readOnly dispensa setSelectionRange — HUB-78)', () => {
    renderVK()
    expect(input('email').getAttribute('type')).toBe('email')
    expect(input('email').getAttribute('inputmode')).toBeNull()
    expect(input('phone').getAttribute('type')).toBe('tel')
  })

  it('o CaretOverlay aparece só no campo ativo e acompanha a troca de foco (HUB-78)', () => {
    renderVK()
    expect(caret()).toBeNull() // nenhum campo ativo ainda
    fireEvent.click(input('name'))
    expect(caret()).not.toBeNull()
    expect(caret()!.parentElement!.querySelector('input')!.id).toBe('name')
    fireEvent.click(input('email'))
    // continua existindo um único caret, agora no campo email.
    expect(document.querySelectorAll('[data-testid="vk-caret"]').length).toBe(1)
    expect(caret()!.parentElement!.querySelector('input')!.id).toBe('email')
  })

  it('destaca o campo ativo com borda azul + ring; os demais seguem accent', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    // ativo: borda azul BB + box-shadow (ring) de destaque
    expect(input('name').style.borderColor).toBe('rgb(3, 51, 189)')
    expect(input('name').style.boxShadow).not.toBe('')
    // inativo: borda accent amarela, sem ring
    expect(input('email').style.borderColor).toBe('rgb(252, 252, 48)')
    expect(input('email').style.boxShadow).toBe('')
    // troca o campo ativo → o destaque acompanha
    fireEvent.click(input('email'))
    expect(input('email').style.borderColor).toBe('rgb(3, 51, 189)')
    expect(input('name').style.borderColor).toBe('rgb(252, 252, 48)')
  })

  it('campo ativo com erro mantém a borda vermelha (prioridade do estado de erro)', async () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    acceptConsent()
    await fillCpf() // CPF resolvido habilita o ENVIAR (gate de submit)
    fireEvent.click(input('name')) // ativo, mas vazio e obrigatório
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(input('name').style.borderColor).toBe('rgb(239, 68, 68)')
  })
})

describe('LeadForm — SHIFT e auto-shift (HUB-71)', () => {
  // A tecla SHIFT tem aria-label 'Maiúscula'. Com shift ligado, as teclas de letra exibem
  // a versão maiúscula (o texto da tecla é o accessible name).
  const SHIFT_LABEL = 'Maiúscula'

  it('SHIFT + letra produz maiúscula e não é zerado pelo re-foco do mesmo campo (Cenários 1/2)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    // email não recebe auto-shift → isola o comportamento da tecla SHIFT.
    fireEvent.click(input('email'))
    fireEvent.click(vkey(SHIFT_LABEL)) // liga o shift; o re-foco do caret NÃO pode zerá-lo
    fireEvent.click(vkey('A')) // shift on → a tecla 'a' aparece como 'A'
    expect(input('email').value).toBe('A')
  })

  it('shift é single-shot: a letra seguinte (sem novo SHIFT) sai minúscula (Cenário 3)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('email'))
    fireEvent.click(vkey(SHIFT_LABEL))
    fireEvent.click(vkey('A'))
    fireEvent.click(vkey('b')) // shift consumido → minúscula
    expect(input('email').value).toBe('Ab')
  })

  it('auto-shift: campo name vazio inicia a 1ª letra maiúscula e a 2ª minúscula (Cenários 6/7)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name')) // name vazio → auto-shift arma o shift
    fireEvent.click(vkey('M')) // 1ª letra maiúscula
    fireEvent.click(vkey('a')) // single-shot → minúscula
    expect(input('name').value).toBe('Ma')
  })

  it('auto-shift NÃO dispara em name já preenchido — letra sai minúscula (Cenário 8)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    fireEvent.click(vkey('M'))
    fireEvent.click(vkey('a')) // name = 'Ma'
    fireEvent.click(input('email')) // sai do name
    fireEvent.click(input('name')) // volta ao name JÁ preenchido → sem auto-shift
    fireEvent.click(vkey('r')) // sem shift → minúscula (se houvesse auto-shift, seria 'R')
    expect(input('name').value).toBe('Mar')
  })

  it('trocar de campo reseta o shift (Cenário 9)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name')) // auto-shift liga o shift
    fireEvent.click(input('email')) // troca de campo → reset do shift
    fireEvent.click(vkey('a')) // shift resetado → minúscula
    expect(input('email').value).toBe('a')
  })
})

describe('LeadForm — modo DESLIGADO (default)', () => {
  it('sem config de teclado: inputs não têm readOnly e usam teclado nativo (paridade atual)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(input('name').readOnly).toBe(false)
    expect(input('name').getAttribute('inputmode')).toBeNull()
    // tel mantém inputMode numeric como hoje
    expect(input('phone').getAttribute('inputmode')).toBe('numeric')
    // sem VK, e-mail permanece type="email" (sem remap; HUB-69)
    expect(input('email').getAttribute('type')).toBe('email')
    expect(screen.queryByRole('group', { name: 'Teclado virtual' })).toBeNull()
  })

  it('enabled: false explícito também mantém comportamento nativo', () => {
    render(<LeadForm config={makeConfig(false)} onSubmit={vi.fn()} />)
    expect(input('name').readOnly).toBe(false)
    expect(screen.queryByRole('group', { name: 'Teclado virtual' })).toBeNull()
  })

  it('onChange nativo atualiza valor e aplica a máscara de telefone (regressão)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    fireEvent.change(input('phone'), { target: { value: '11999998888' } })
    expect(input('phone').value).toBe('(11) 99999-8888')
  })
})

describe('LeadForm — validação e submit (comum aos dois modos — Cenários 10 e 11)', () => {
  it('bloqueia submit com obrigatório vazio e exibe mensagem (consentimento marcado)', async () => {
    const onSubmit = vi.fn()
    render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    acceptConsent() // habilita o consentimento
    await fillCpf() // e resolve o CPF; isola a validação dos demais campos
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Nome completo é obrigatório')).toBeDefined()
  })

  it('exibe "E-mail inválido" para formato inválido (independente do checkbox — Cenário 15)', () => {
    const onSubmit = vi.fn()
    const { container } = render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    acceptConsent()
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'invalido' } })
    // Dispara o submit no form para exercitar o validate() em JS.
    // jsdom curto-circuita o caminho click→submit num input type="email" inválido
    // pela constraint validation nativa; o submit direto valida a lógica do produto.
    fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('E-mail inválido')).toBeDefined()
  })

  it('submete quando tudo é válido e consentimento marcado (Cenário 8)', async () => {
    const onSubmit = vi.fn()
    render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    acceptConsent()
    await fillCpf()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    // CPF vai em cpfMeta (2º argumento), nunca no payload genérico.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', email: 'maria@exemplo.com' }),
      { cpf: VALID_CPF_DIGITS, cpfCheckSkipped: false }
    )
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('cpf')
  })

  it('no modo ligado, submit inválido exibe erro, fecha o teclado e ele reabre ao tocar o campo (Cenário 11 / HUB-86 CA7)', async () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    acceptConsent()
    await fillCpf() // habilita o ENVIAR; o erro exercitado é o do campo name vazio
    fireEvent.click(input('name'))
    expect(screen.getByRole('group', { name: 'Teclado virtual' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    // erro exibido; ENVIAR fecha o teclado no mesmo toque (HUB-86 CA7), mesmo inválido
    expect(screen.getByText('Nome completo é obrigatório')).toBeDefined()
    expect(screen.queryByRole('group', { name: 'Teclado virtual' })).toBeNull()
    // segue disponível: tocar o campo reabre o teclado para corrigir
    fireEvent.click(input('name'))
    expect(screen.getByRole('group', { name: 'Teclado virtual' })).toBeDefined()
  })
})

describe('LeadForm — layout BB Seguros (HUB-65)', () => {
  const label = (id: string) =>
    document.querySelector(`label[for="${id}"]`) as HTMLLabelElement

  it('exibe o logo BB Seguros e oculta o título em texto (Cenário 3)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    const logo = screen.getByAltText('BB Seguros') as HTMLImageElement
    expect(logo.getAttribute('src')).toBe('/images/logo_bb.png')
    expect(logo.className).toContain('object-contain')
    expect(screen.queryByText('Preencha seus dados')).toBeNull()
  })

  it('labels em maiúsculas, itálico e fonte BB Titulos (Cenário 4)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    for (const id of ['name', 'email', 'phone']) {
      const el = label(id)
      expect(el.className).toContain('font-bb-titulos')
      expect(el.className).toContain('italic')
      expect(el.className).toContain('uppercase')
    }
  })

  it('inputs pill branco com borda accent amarela (Cenário 5)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    const el = input('name')
    expect(el.className).toContain('rounded-full')
    expect(el.className).toContain('bg-white')
    expect(el.style.borderColor).toBe('rgb(252, 252, 48)')
  })

  it('botão ENVIAR pill amarelo com texto azul e fonte BB (Cenário 6, habilitado)', async () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    acceptConsent()
    await fillCpf() // consentimento + CPF resolvido → fundo accent cheio
    const btn = screen.getByRole('button', { name: 'ENVIAR' })
    expect(btn.className).toContain('rounded-full')
    expect(btn.className).toContain('font-bb-titulos')
    expect(btn.className).toContain('text-[#0333BD]')
    expect((btn as HTMLButtonElement).style.backgroundColor).toBe('rgb(252, 252, 48)')
  })

  it('respeita event.accentColor do config quando presente', () => {
    const cfg = makeConfig(undefined)
    cfg.event.accentColor = '#00FF00'
    render(<LeadForm config={cfg} onSubmit={vi.fn()} />)
    expect(input('name').style.borderColor).toBe('rgb(0, 255, 0)')
  })
})

describe('LeadForm — consentimento LGPD (HUB-67)', () => {
  const withLgpd = (lgpd: NonNullable<GameConfig['lgpd']>): GameConfig => {
    const cfg = makeConfig(undefined)
    return { ...cfg, lgpd }
  }
  const termsLink = () => screen.getByRole('button', { name: /termos de consentimento/ })

  it('checkbox inicia desmarcado e alterna ao clicar (Cenário 2)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(consentCheckbox()).toHaveProperty('checked', false)
    acceptConsent()
    expect(consentCheckbox()).toHaveProperty('checked', true)
    acceptConsent()
    expect(consentCheckbox()).toHaveProperty('checked', false)
  })

  it('ENVIAR inicia desabilitado e habilita com aceite + CPF resolvido (Cenário 6 / HUB-91)', async () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'ENVIAR' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    acceptConsent()
    // Consentimento sozinho não basta: o CPF ainda não resolveu (gate de submit).
    expect(btn.disabled).toBe(true)
    await fillCpf()
    expect(btn.disabled).toBe(false)
  })

  it('link "termos" abre o modal e NÃO marca o checkbox (Cenário 3)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(termsLink())
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(consentCheckbox()).toHaveProperty('checked', false)
  })

  it('modal tem rótulo acessível e exibe o texto templado de buildConsentText (Cenários 5/11)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    fireEvent.click(termsLink())
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(within(dialog).getByText(/você autoriza/i)).toBeDefined()
  })

  it('fecha o modal por Esc preservando o estado do checkbox (Cenário 4)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    acceptConsent()
    fireEvent.click(termsLink())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(consentCheckbox()).toHaveProperty('checked', true)
  })

  it('fecha o modal clicando no backdrop (Cenário 4)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    fireEvent.click(termsLink())
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('modal exibe consentText custom como texto puro, sem injetar HTML (Cenário 11)', () => {
    const cfg = withLgpd({
      consentVersion: '2.0',
      dataController: 'Empresa',
      purposeText: 'para contato',
      retentionMonths: 6,
      consentText: 'Aceito <b>tudo</b> conforme a LGPD.',
    })
    const { container } = render(<LeadForm config={cfg} onSubmit={vi.fn()} />)
    fireEvent.click(termsLink())
    expect(container.querySelector('dialog, [role="dialog"] b')).toBeNull()
    expect(screen.getByText(/Aceito <b>tudo<\/b> conforme a LGPD\./)).toBeDefined()
    expect(screen.queryByText(/você autoriza/i)).toBeNull()
  })

  it('Política de Privacidade in-app acessível pelo modal quando privacyPolicyPath (Cenário 12)', () => {
    const cfg = withLgpd({
      consentVersion: '1.0',
      dataController: 'Empresa',
      purposeText: 'para contato',
      retentionMonths: 12,
      privacyPolicyPath: '/privacy-policy.html',
    })
    const { container } = render(<LeadForm config={cfg} onSubmit={vi.fn()} />)
    fireEvent.click(termsLink())
    fireEvent.click(screen.getByRole('button', { name: /Ler Política de Privacidade/i }))
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('/privacy-policy.html')
    expect(iframe?.getAttribute('sandbox')).toBe('')
  })

  it('gating: submit por Enter sem aceite bloqueia e mostra mensagem; some ao marcar (Cenário 7)', () => {
    const onSubmit = vi.fn()
    const { container } = render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('É necessário aceitar os termos para participar')).toBeDefined()
    acceptConsent()
    expect(screen.queryByText('É necessário aceitar os termos para participar')).toBeNull()
  })
})

describe('LeadForm — dispensar teclado ao tocar fora (HUB-86)', () => {
  const keyboard = () => screen.queryByRole('group', { name: 'Teclado virtual' })
  const logo = () => screen.getByAltText('BB Seguros')
  const termsLink = () => screen.getByRole('button', { name: /termos de consentimento/ })

  it('CA1 — fecha ao tocar em área neutra (logo) com o teclado aberto no layout alpha', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    expect(keyboard()).not.toBeNull()
    fireEvent.click(logo())
    expect(keyboard()).toBeNull()
  })

  it('CA1 — fecha ao tocar em área neutra com o teclado aberto noutro layout (campo e-mail)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('email'))
    expect(keyboard()).not.toBeNull()
    fireEvent.click(logo())
    expect(keyboard()).toBeNull()
  })

  it('CA2 — tocar numa tecla mantém o teclado aberto e insere o caractere', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name')) // name vazio → auto-shift: 1ª maiúscula
    fireEvent.click(vkey('M'))
    expect(input('name').value).toBe('M')
    expect(keyboard()).not.toBeNull()
  })

  it('CA3 — tocar no input do campo B mantém aberto e troca o campo', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    fireEvent.click(input('email'))
    expect(keyboard()).not.toBeNull()
    // o destaque do campo ativo migra para o e-mail (troca de campo preservada)
    expect(input('email').style.borderColor).toBe('rgb(3, 51, 189)')
    expect(input('name').style.borderColor).toBe('rgb(252, 252, 48)')
  })

  it('CA4 — após fechar por toque fora, tocar num campo reabre o teclado', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    fireEvent.click(logo())
    expect(keyboard()).toBeNull()
    fireEvent.click(input('email'))
    expect(keyboard()).not.toBeNull()
  })

  it('CA5 — tocar no link de termos abre o modal e fecha o teclado (toque único)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    expect(keyboard()).not.toBeNull()
    fireEvent.click(termsLink())
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(keyboard()).toBeNull()
  })

  it('CA6 — tocar no checkbox alterna o estado e fecha o teclado (toque único)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    expect(consentCheckbox()).toHaveProperty('checked', false)
    fireEvent.click(consentCheckbox())
    expect(consentCheckbox()).toHaveProperty('checked', true)
    expect(keyboard()).toBeNull()
  })

  it('CA7 — tocar em ENVIAR (form válido) dispara o submit e fecha o teclado (toque único)', async () => {
    const onSubmit = vi.fn()
    render(<LeadForm config={makeConfig(true)} onSubmit={onSubmit} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    acceptConsent()
    await fillCpf()
    fireEvent.click(input('name')) // abre o teclado
    expect(keyboard()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(keyboard()).toBeNull()
  })

  it('CA8 — com VK desabilitado não há teclado e o handler de dispensa é inerte', () => {
    render(<LeadForm config={makeConfig(false)} onSubmit={vi.fn()} />)
    expect(keyboard()).toBeNull()
    fireEvent.click(logo())
    fireEvent.click(input('name'))
    expect(keyboard()).toBeNull()
  })
})

describe('LeadForm — gate de CPF (HUB-91)', () => {
  const FOUND_DATA = {
    name: 'Maria da Silva',
    email: 'maria@email.com',
    phone: '(61) 99999-9999',
  }
  const cpfConfig = (maxParticipations?: number): GameConfig => {
    const cfg = makeConfig(undefined)
    if (maxParticipations !== undefined) cfg.leadForm.maxParticipations = maxParticipations
    return cfg
  }
  const badges = () => screen.queryAllByText('Preenchido automaticamente')

  it('CPF é o primeiro campo do formulário, antes de nome/e-mail/telefone', () => {
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    const fieldInputs = Array.from(document.querySelectorAll('input')).filter(
      (el) => el.type !== 'checkbox'
    )
    expect(fieldInputs[0].id).toBe('cpf')
    expect(fieldInputs.map((el) => el.id)).toEqual(['cpf', 'name', 'email', 'phone'])
  })

  it('CPF inválido (dígito verificador) mostra erro específico e NÃO consulta (Cenário 1)', () => {
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    fireEvent.change(input('cpf'), { target: { value: INVALID_CPF } })
    expect(screen.getByText('CPF inválido. Confira os números digitados.')).toBeDefined()
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('não valida nem consulta enquanto o CPF está incompleto (decisão de design #1)', () => {
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    fireEvent.change(input('cpf'), { target: { value: '111.444' } })
    expect(screen.queryByText('CPF inválido. Confira os números digitados.')).toBeNull()
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('completar 11 dígitos válidos dispara a consulta automática com os dígitos sanitizados', async () => {
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(mockLookup).toHaveBeenCalledWith('e', VALID_CPF_DIGITS)
  })

  it('CPF aplica a máscara 000.000.000-00 pelo teclado numérico e dispara a consulta (VK ligado)', async () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('cpf')) // teclado numérico (dialpad)
    for (const d of VALID_CPF_DIGITS.split('')) fireEvent.click(vkey(d))
    expect(input('cpf').value).toBe(VALID_CPF)
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('e', VALID_CPF_DIGITS))
  })

  it('mostra o spinner e bloqueia o ENVIAR enquanto a consulta está em curso (checking)', async () => {
    let resolveLookup!: (r: CpfLookupResult) => void
    mockLookup.mockReturnValue(new Promise<CpfLookupResult>((res) => (resolveLookup = res)))
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    acceptConsent()
    fireEvent.change(input('cpf'), { target: { value: VALID_CPF } })
    // Em checking: spinner visível e ENVIAR ainda bloqueado mesmo com consentimento + campos.
    expect(screen.getByTestId('cpf-spinner')).toBeDefined()
    expect((screen.getByRole('button', { name: 'ENVIAR' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Verificando CPF')
    await act(async () => resolveLookup({ status: 'not-found' }))
    expect(screen.queryByTestId('cpf-spinner')).toBeNull()
    expect((screen.getByRole('button', { name: 'ENVIAR' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('CPF novo (sem match) libera o formulário sem autopreencher (Cenário 2)', async () => {
    render(<LeadForm config={cpfConfig()} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(badges().length).toBe(0)
    expect(input('name').value).toBe('')
    acceptConsent()
    expect((screen.getByRole('button', { name: 'ENVIAR' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('CPF cadastrado abaixo do limite autopreenche os demais campos com selo (Cenário 3)', async () => {
    mockLookup.mockResolvedValue({ status: 'found', participationCount: 1, lastLeadData: FOUND_DATA })
    render(<LeadForm config={cpfConfig(2)} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(input('name').value).toBe('Maria da Silva')
    expect(input('email').value).toBe('maria@email.com')
    expect(input('phone').value).toBe('(61) 99999-9999')
    expect(badges().length).toBe(3)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe(
      'CPF localizado, dados preenchidos automaticamente'
    )
  })

  it('editar um campo autopreenchido remove o selo só dele (decisão de design #4)', async () => {
    mockLookup.mockResolvedValue({ status: 'found', participationCount: 1, lastLeadData: FOUND_DATA })
    render(<LeadForm config={cpfConfig(2)} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(badges().length).toBe(3)
    fireEvent.change(input('name'), { target: { value: 'Maria da Silva Souza' } })
    expect(badges().length).toBe(2)
  })

  it('autofill NÃO sobrescreve campo já digitado durante a consulta (decisão de design #8)', async () => {
    let resolveLookup!: (r: CpfLookupResult) => void
    mockLookup.mockReturnValue(new Promise<CpfLookupResult>((res) => (resolveLookup = res)))
    render(<LeadForm config={cpfConfig(2)} onSubmit={vi.fn()} />)
    fireEvent.change(input('cpf'), { target: { value: VALID_CPF } })
    // Operador digita o nome ENQUANTO a consulta corre.
    fireEvent.change(input('name'), { target: { value: 'João Digitado' } })
    await act(async () =>
      resolveLookup({ status: 'found', participationCount: 1, lastLeadData: FOUND_DATA })
    )
    // Nome digitado é preservado; e-mail/telefone (vazios) são autopreenchidos.
    expect(input('name').value).toBe('João Digitado')
    expect(input('email').value).toBe('maria@email.com')
    expect(badges().length).toBe(2)
  })

  it('editar o CPF após autopreenchimento limpa os campos e os selos (decisão de design #5)', async () => {
    mockLookup.mockResolvedValue({ status: 'found', participationCount: 1, lastLeadData: FOUND_DATA })
    render(<LeadForm config={cpfConfig(2)} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(input('name').value).toBe('Maria da Silva')
    // Editar o CPF (aqui para um valor incompleto) invalida o autopreenchimento anterior
    // e só dispara nova consulta quando os 11 dígitos válidos forem completados de novo.
    fireEvent.change(input('cpf'), { target: { value: '111.444' } })
    await waitFor(() => expect(input('name').value).toBe(''))
    expect(input('email').value).toBe('')
    expect(badges().length).toBe(0)
  })

  it('limite atingido abre o modal de bloqueio e "Próximo participante" reseta o form (Cenário 4)', async () => {
    mockLookup.mockResolvedValue({ status: 'found', participationCount: 1, lastLeadData: FOUND_DATA })
    render(<LeadForm config={cpfConfig(1)} onSubmit={vi.fn()} />)
    fireEvent.change(input('cpf'), { target: { value: VALID_CPF } })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
    expect(screen.getByText('Você já participou!')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Próximo participante/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(input('cpf').value).toBe('')
    expect(input('name').value).toBe('')
  })

  it('limite 0 (ilimitado) nunca bloqueia, mesmo com muitas participações (Cenário 5)', async () => {
    mockLookup.mockResolvedValue({ status: 'found', participationCount: 5, lastLeadData: FOUND_DATA })
    render(<LeadForm config={cpfConfig(0)} onSubmit={vi.fn()} />)
    await fillCpf()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(input('name').value).toBe('Maria da Silva')
  })

  it('fallback offline trata como novo, libera e marca cpfCheckSkipped no submit (Cenário 6)', async () => {
    const onSubmit = vi.fn()
    mockLookup.mockResolvedValue({ status: 'offline-fallback', reason: 'timeout' })
    render(<LeadForm config={cpfConfig()} onSubmit={onSubmit} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    acceptConsent()
    await fillCpf()
    // Indistinguível de CPF novo: sem erro, sem modal.
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), {
      cpf: VALID_CPF_DIGITS,
      cpfCheckSkipped: true,
    })
  })
})
