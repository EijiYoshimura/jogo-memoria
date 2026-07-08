import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PurgeLeadsModal, type PurgePhase } from '../PurgeLeadsModal'

afterEach(() => cleanup())

const CODE_ID = 'purge-confirmation-code'
const INPUT_LABEL = /código abaixo exatamente como exibido/i

function readGeneratedCode(): string {
  return screen.getByText((_, el) => el?.id === CODE_ID).textContent ?? ''
}

function baseProps(overrides: Partial<React.ComponentProps<typeof PurgeLeadsModal>> = {}) {
  return {
    eventName: 'Evento Demo',
    eventId: 'evento-demo-2026',
    phase: 'confirm' as PurgePhase,
    purgedCount: null,
    errorDetail: null,
    onConfirm: vi.fn(),
    onRetryExport: vi.fn(),
    onRetryDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('PurgeLeadsModal — estado (A) Confirmação', () => {
  it('exibe o evento afetado, avisos de irreversibilidade/auditoria/sync e o código de confirmação', () => {
    render(<PurgeLeadsModal {...baseProps()} />)

    expect(screen.getAllByText(/Evento Demo/).length).toBeGreaterThan(0)
    expect(screen.getByText(/irreversível/i)).toBeDefined()
    expect(screen.getByText(/não identifica um usuário nomeado/i)).toBeDefined()
    expect(screen.getByText(/Forçar Sync.*em todos os totens/i)).toBeDefined()
    expect(readGeneratedCode()).toMatch(/^[0-9A-F]{6}$/)
  })

  it('o código gerado nunca é igual ao nome/id do evento (regenera em caso de colisão)', () => {
    const spy = vi.spyOn(crypto, 'randomUUID')
    spy
      .mockReturnValueOnce('abcdef00-0000-4000-8000-000000000000')
      .mockReturnValueOnce('123456ab-0000-4000-8000-000000000000')

    render(<PurgeLeadsModal {...baseProps({ eventId: 'abcdef' })} />)

    expect(readGeneratedCode()).toBe('123456')
    spy.mockRestore()
  })

  it('foca automaticamente o campo de texto ao abrir (não o botão destrutivo)', () => {
    render(<PurgeLeadsModal {...baseProps()} />)
    expect(document.activeElement).toBe(screen.getByLabelText(INPUT_LABEL))
  })

  it('botão de confirmação começa desabilitado e só habilita com match exato (case-insensitive/trim)', () => {
    render(<PurgeLeadsModal {...baseProps()} />)
    const code = readGeneratedCode()
    const input = screen.getByLabelText(INPUT_LABEL)
    const confirmButton = screen.getByRole('button', { name: 'Apagar leads deste evento' })

    expect(confirmButton).toHaveProperty('disabled', true)

    fireEvent.change(input, { target: { value: 'texto-errado' } })
    expect(confirmButton).toHaveProperty('disabled', true)

    fireEvent.change(input, { target: { value: `  ${code.toLowerCase()}  ` } })
    expect(confirmButton).toHaveProperty('disabled', false)
  })

  it('Enter no campo de texto não confirma (exige clique explícito no botão)', () => {
    const onConfirm = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ onConfirm })} />)
    const code = readGeneratedCode()
    const input = screen.getByLabelText(INPUT_LABEL)

    fireEvent.change(input, { target: { value: code } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('clicar no botão confirmando com o código correto chama onConfirm', () => {
    const onConfirm = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ onConfirm })} />)
    const code = readGeneratedCode()
    fireEvent.change(screen.getByLabelText(INPUT_LABEL), { target: { value: code } })
    fireEvent.click(screen.getByRole('button', { name: 'Apagar leads deste evento' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('campo de texto tem autoComplete/autoCorrect/autoCapitalize/spellCheck desligados', () => {
    render(<PurgeLeadsModal {...baseProps()} />)
    const input = screen.getByLabelText(INPUT_LABEL)
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('autocorrect')).toBe('off')
    expect(input.getAttribute('autocapitalize')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
  })

  it('Cancelar chama onClose; Esc chama onClose (estado A permite dispensa)', () => {
    const onClose = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ onClose })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    cleanup()
    const onCloseEsc = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ onClose: onCloseEsc })} />)
    fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' })
    expect(onCloseEsc).toHaveBeenCalledTimes(1)
  })

  it('clicar no backdrop chama onClose; clicar no card não', () => {
    const onClose = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ onClose })} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PurgeLeadsModal — estado (B) Processando', () => {
  it('exporting: sem Cancelar/Esc/backdrop; checklist mostra passo 1 em andamento', () => {
    const onClose = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ phase: 'exporting', onClose })} />)

    expect(screen.getByText('1. Exportando dados do evento...')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()

    fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('deleting: marca o passo 1 como concluído e destaca o passo 2', () => {
    render(<PurgeLeadsModal {...baseProps({ phase: 'deleting' })} />)
    expect(screen.getByText('✓ 1. Dados do evento exportados')).toBeDefined()
    expect(screen.getByText('2. Excluindo os leads...')).toBeDefined()
  })

  it('move o foco para o heading ao transicionar de confirm para exporting', () => {
    const { rerender } = render(<PurgeLeadsModal {...baseProps({ phase: 'confirm' })} />)
    rerender(<PurgeLeadsModal {...baseProps({ phase: 'exporting' })} />)
    expect(document.activeElement).toBe(screen.getByText('Processando...'))
  })
})

describe('PurgeLeadsModal — estado (C) Erro de export', () => {
  it('mostra a mensagem exigida e oferece Cancelar/Tentar novamente', () => {
    const onClose = vi.fn()
    const onRetryExport = vi.fn()
    render(<PurgeLeadsModal {...baseProps({ phase: 'export-error', onClose, onRetryExport })} />)

    expect(
      screen.getByText('A exportação falhou, então nada foi apagado — está tudo como antes.')
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetryExport).toHaveBeenCalledTimes(1)
  })

  it('exibe o detalhe técnico do erro quando presente', () => {
    render(
      <PurgeLeadsModal {...baseProps({ phase: 'export-error', errorDetail: 'Sem conexão.' })} />
    )
    expect(screen.getByText('Detalhe: Sem conexão.')).toBeDefined()
  })
})

describe('PurgeLeadsModal — estado (D) Sucesso', () => {
  it('mostra o nome do evento e a contagem vinda do servidor; botão único Fechar', () => {
    const onClose = vi.fn()
    render(
      <PurgeLeadsModal {...baseProps({ phase: 'success', purgedCount: 42, onClose })} />
    )

    expect(
      screen.getByText('O CSV do evento Evento Demo foi exportado e 42 leads foram apagados.')
    ).toBeDefined()
    expect(screen.getAllByRole('button')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PurgeLeadsModal — estado (E) Erro parcial', () => {
  it('mostra a mensagem exigida e oferece Fechar/Tentar excluir novamente', () => {
    const onClose = vi.fn()
    const onRetryDelete = vi.fn()
    render(
      <PurgeLeadsModal {...baseProps({ phase: 'partial-error', onClose, onRetryDelete })} />
    )

    expect(
      screen.getByText('O arquivo CSV já foi salvo — nada foi perdido. Mas não foi possível concluir a exclusão.')
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar excluir novamente' }))
    expect(onRetryDelete).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
