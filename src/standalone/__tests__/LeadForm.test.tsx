import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LeadForm } from '../LeadForm'
import type { GameConfig } from '../../game/types'

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
    adminPin: '1234',
  }
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement
const vkey = (name: string) =>
  within(screen.getByRole('group', { name: 'Teclado virtual' })).getByRole('button', { name })
const consentCheckbox = () => screen.getByRole('checkbox')
const acceptConsent = () => fireEvent.click(consentCheckbox())

describe('LeadForm — modo LIGADO (virtualKeyboard.enabled: true)', () => {
  it('suprime o teclado nativo: inputs com readOnly e inputMode none (proxy do Cenário 1)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    for (const id of ['name', 'email', 'phone']) {
      expect(input(id).readOnly).toBe(true)
      expect(input(id).getAttribute('inputmode')).toBe('none')
    }
  })

  it('não renderiza o teclado até um campo ser focado; renderiza ao focar (Cenário 2)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Teclado virtual' })).toBeNull()
    fireEvent.click(input('name'))
    expect(screen.getByRole('group', { name: 'Teclado virtual' })).toBeDefined()
  })

  it('digita pelo teclado virtual atualizando o campo ativo', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    fireEvent.click(vkey('j'))
    fireEvent.click(vkey('o'))
    expect(input('name').value).toBe('jo')
  })

  it('troca o layout pelo tipo do campo e preserva valores (Cenários 5 e 8)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    fireEvent.click(input('name'))
    fireEvent.click(vkey('a'))
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
    expect(input('name').value).toBe('a')
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

describe('LeadForm — modo DESLIGADO (default)', () => {
  it('sem config de teclado: inputs não têm readOnly e usam teclado nativo (paridade atual)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(input('name').readOnly).toBe(false)
    expect(input('name').getAttribute('inputmode')).toBeNull()
    // tel mantém inputMode numeric como hoje
    expect(input('phone').getAttribute('inputmode')).toBe('numeric')
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
  it('bloqueia submit com obrigatório vazio e exibe mensagem (consentimento marcado)', () => {
    const onSubmit = vi.fn()
    render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    acceptConsent() // habilita o ENVIAR; isola a validação de campos
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

  it('submete quando tudo é válido e consentimento marcado (Cenário 8)', () => {
    const onSubmit = vi.fn()
    render(<LeadForm config={makeConfig(undefined)} onSubmit={onSubmit} />)
    fireEvent.change(input('name'), { target: { value: 'Maria' } })
    fireEvent.change(input('email'), { target: { value: 'maria@exemplo.com' } })
    acceptConsent()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', email: 'maria@exemplo.com' })
    )
  })

  it('no modo ligado, submit inválido mantém o teclado virtual disponível (Cenário 11)', () => {
    render(<LeadForm config={makeConfig(true)} onSubmit={vi.fn()} />)
    acceptConsent()
    fireEvent.click(input('name'))
    expect(screen.getByRole('group', { name: 'Teclado virtual' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }))
    // erro exibido e teclado preservado
    expect(screen.getByText('Nome completo é obrigatório')).toBeDefined()
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

  it('botão ENVIAR pill amarelo com texto azul e fonte BB (Cenário 6, habilitado)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    acceptConsent() // habilitado → fundo accent cheio
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
  const termsLink = () => screen.getByRole('button', { name: 'termos de consentimento' })

  it('checkbox inicia desmarcado e alterna ao clicar (Cenário 2)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    expect(consentCheckbox()).toHaveProperty('checked', false)
    acceptConsent()
    expect(consentCheckbox()).toHaveProperty('checked', true)
    acceptConsent()
    expect(consentCheckbox()).toHaveProperty('checked', false)
  })

  it('ENVIAR inicia desabilitado e habilita ao marcar o aceite (Cenário 6)', () => {
    render(<LeadForm config={makeConfig(undefined)} onSubmit={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'ENVIAR' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    acceptConsent()
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
