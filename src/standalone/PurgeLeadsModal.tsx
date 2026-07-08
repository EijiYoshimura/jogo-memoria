// Modal de confirmação da Limpeza de Leads (HUB-153, épico HUB-150, ADR-015). Fluxo de 5
// estados: (A) Confirmação → (B) Processando → (C) Erro de export (nada apagado) / (D)
// Sucesso / (E) Erro parcial (export ok, exclusão falhou). Puramente apresentacional e
// controlado por `phase` — toda orquestração de rede (listAdminLeads/buildLeadsCsv/download/
// purgeAdminLeads/deleteLeadsForEvent) vive em `AdminPanel.tsx`. Reaproveita `useModalA11y`
// (foco/trap/Esc/scroll-lock), mesmo padrão de `CpfLimitModal`/`TermsModal` (HUB-91).
//
// O código de confirmação é uma barreira de USABILIDADE (evita clique acidental do operador
// legítimo), não um controle de segurança — quem já possui o segredo do Admin controla o
// DOM/JS e pode contornar qualquer gate client-side (ver spec técnica, "Segurança").

import { useEffect, useRef, useState } from 'react'
import { useModalA11y } from './hooks/useModalA11y'

export type PurgePhase =
  | 'confirm'
  | 'exporting'
  | 'deleting'
  | 'export-error'
  | 'success'
  | 'partial-error'

interface PurgeLeadsModalProps {
  eventName: string
  eventId: string
  phase: PurgePhase
  purgedCount: number | null
  /** Detalhe técnico opcional (ex.: "Sem conexão.") exibido sob a mensagem fixa de erro. */
  errorDetail: string | null
  onConfirm: () => void
  onRetryExport: () => void
  onRetryDelete: () => void
  onClose: () => void
}

const HEADING_ID = 'purge-leads-heading'
const CODE_LENGTH = 6
const NO_OP = () => {}
/** Fases com operação de rede em curso — sem Cancelar/Esc/backdrop (Design, estado B). */
const PROCESSING_PHASES: ReadonlySet<PurgePhase> = new Set(['exporting', 'deleting'])

/**
 * Código de confirmação aleatório (6 caracteres alfanuméricos maiúsculos), garantidamente
 * diferente de qualquer valor já visível em tela/config (nome/id do evento) — comparação
 * case-insensitive, trim.
 */
function generateConfirmationCode(forbidden: ReadonlyArray<string>): string {
  const normalizedForbidden = forbidden.map((value) => value.trim().toUpperCase())
  let code: string
  do {
    code = crypto.randomUUID().replace(/-/g, '').slice(0, CODE_LENGTH).toUpperCase()
  } while (normalizedForbidden.includes(code))
  return code
}

export function PurgeLeadsModal({
  eventName,
  eventId,
  phase,
  purgedCount,
  errorDetail,
  onConfirm,
  onRetryExport,
  onRetryDelete,
  onClose,
}: PurgeLeadsModalProps) {
  const [confirmationCode] = useState(() => generateConfirmationCode([eventName, eventId]))
  const [confirmationInput, setConfirmationInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const canDismiss = !PROCESSING_PHASES.has(phase)

  const { cardRef, onKeyDown } = useModalA11y({
    onEscape: canDismiss ? onClose : NO_OP,
    initialFocusRef: inputRef,
  })

  // Move o foco ao heading do novo estado a cada transição (o componente não desmonta entre
  // estados). Na abertura inicial (fase 'confirm'), `headingRef` ainda não foi atribuído por
  // nenhum elemento — o foco inicial vai para o campo de texto via `useModalA11y` acima.
  useEffect(() => {
    headingRef.current?.focus()
  }, [phase])

  const matches = confirmationInput.trim().toUpperCase() === confirmationCode

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={canDismiss ? onClose : undefined}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 rounded-2xl p-8 w-full max-w-lg flex flex-col gap-5 outline-none"
      >
        {phase === 'confirm' && (
          <ConfirmStep
            eventName={eventName}
            eventId={eventId}
            confirmationCode={confirmationCode}
            confirmationInput={confirmationInput}
            onInputChange={setConfirmationInput}
            inputRef={inputRef}
            matches={matches}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        )}
        {PROCESSING_PHASES.has(phase) && (
          <ProcessingStep phase={phase as 'exporting' | 'deleting'} headingRef={headingRef} />
        )}
        {phase === 'export-error' && (
          <ExportErrorStep
            headingRef={headingRef}
            errorDetail={errorDetail}
            onClose={onClose}
            onRetry={onRetryExport}
          />
        )}
        {phase === 'success' && (
          <SuccessStep
            eventName={eventName}
            purgedCount={purgedCount ?? 0}
            headingRef={headingRef}
            onClose={onClose}
          />
        )}
        {phase === 'partial-error' && (
          <PartialErrorStep
            headingRef={headingRef}
            errorDetail={errorDetail}
            onClose={onClose}
            onRetry={onRetryDelete}
          />
        )}
      </div>
    </div>
  )
}

const dangerButtonClasses =
  'flex-1 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xl font-bold rounded-xl py-4 transition-colors disabled:opacity-40'
const secondaryButtonClasses =
  'flex-1 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xl font-bold rounded-xl py-4 transition-colors'
const bannerWarningClasses =
  'bg-yellow-900 border border-yellow-500 rounded-xl p-4 text-yellow-200 text-sm'

interface ConfirmStepProps {
  eventName: string
  eventId: string
  confirmationCode: string
  confirmationInput: string
  onInputChange: (value: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  matches: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmStep({
  eventName,
  eventId,
  confirmationCode,
  confirmationInput,
  onInputChange,
  inputRef,
  matches,
  onConfirm,
  onClose,
}: ConfirmStepProps) {
  return (
    <>
      <h2 id={HEADING_ID} className="text-white text-2xl font-bold">
        Limpeza de Leads — {eventName}
      </h2>
      <p className="text-gray-400 text-sm -mt-3">
        Evento: {eventName} (ID: {eventId})
      </p>

      <p
        role="alert"
        aria-live="assertive"
        className="bg-red-900 border border-red-500 rounded-xl p-4 text-red-200 text-sm"
      >
        Esta ação é <strong>irreversível</strong>: todos os leads do evento &ldquo;{eventName}&rdquo; serão
        apagados definitivamente e não podem ser recuperados depois de concluída.
      </p>

      <p className={bannerWarningClasses}>
        A trilha de auditoria desta operação registra apenas o dispositivo e a sessão — não identifica um
        usuário nomeado (acesso por segredo compartilhado do painel).
      </p>

      <p className={bannerWarningClasses}>
        Antes de confirmar, use &ldquo;Forçar Sync&rdquo; em todos os totens deste evento. Leads pendentes em
        outro dispositivo não são apagados por esta operação e podem sincronizar depois, reintroduzindo dados
        que você acreditava apagados.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="purge-confirmation-input" className="text-gray-300 text-sm">
          Para confirmar, digite o código abaixo exatamente como exibido:
        </label>
        <p
          id="purge-confirmation-code"
          className="text-white text-2xl font-mono font-bold tracking-widest text-center bg-gray-800 rounded-xl py-3"
        >
          {confirmationCode}
        </p>
        <input
          id="purge-confirmation-input"
          ref={inputRef}
          type="text"
          value={confirmationInput}
          aria-describedby="purge-confirmation-code"
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter não submete: exige clique explícito no botão (ação física separada
            // da digitação, decisão deliberada da spec de design).
            if (e.key === 'Enter') e.preventDefault()
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full bg-gray-800 text-white text-center text-xl rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="flex gap-4">
        <button type="button" className={secondaryButtonClasses} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!matches}
          className={dangerButtonClasses}
          onClick={onConfirm}
        >
          Apagar leads deste evento
        </button>
      </div>
    </>
  )
}

interface ProcessingStepProps {
  phase: 'exporting' | 'deleting'
  headingRef: React.RefObject<HTMLHeadingElement | null>
}

function ProcessingStep({ phase, headingRef }: ProcessingStepProps) {
  return (
    <>
      <h2
        ref={headingRef}
        id={HEADING_ID}
        tabIndex={-1}
        className="text-white text-2xl font-bold outline-none"
      >
        Processando...
      </h2>
      <ul aria-live="polite" className="flex flex-col gap-2 text-lg">
        <li className={phase === 'exporting' ? 'text-white font-bold' : 'text-green-400'}>
          {phase === 'exporting' ? '1. Exportando dados do evento...' : '✓ 1. Dados do evento exportados'}
        </li>
        <li className={phase === 'deleting' ? 'text-white font-bold' : 'text-gray-500'}>
          2. Excluindo os leads...
        </li>
      </ul>
    </>
  )
}

interface ExportErrorStepProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  errorDetail: string | null
  onClose: () => void
  onRetry: () => void
}

function ExportErrorStep({ headingRef, errorDetail, onClose, onRetry }: ExportErrorStepProps) {
  return (
    <>
      <h2
        ref={headingRef}
        id={HEADING_ID}
        tabIndex={-1}
        className="text-white text-2xl font-bold outline-none"
      >
        Não foi possível exportar
      </h2>
      <p
        role="status"
        aria-live="polite"
        className="bg-red-900 border border-red-500 rounded-xl p-4 text-red-200 text-sm"
      >
        A exportação falhou, então nada foi apagado — está tudo como antes.
      </p>
      {errorDetail && <p className="text-gray-400 text-xs">Detalhe: {errorDetail}</p>}
      <div className="flex gap-4">
        <button type="button" className={secondaryButtonClasses} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={dangerButtonClasses} onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </>
  )
}

interface SuccessStepProps {
  eventName: string
  purgedCount: number
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onClose: () => void
}

function SuccessStep({ eventName, purgedCount, headingRef, onClose }: SuccessStepProps) {
  return (
    <>
      <h2
        ref={headingRef}
        id={HEADING_ID}
        tabIndex={-1}
        className="text-white text-2xl font-bold outline-none"
      >
        Leads apagados
      </h2>
      <p role="status" aria-live="polite" className="bg-gray-800 rounded-xl p-4 text-green-400 text-lg">
        O CSV do evento {eventName} foi exportado e {purgedCount} leads foram apagados.
      </p>
      <button
        type="button"
        className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xl font-bold rounded-xl py-4 transition-colors"
        onClick={onClose}
      >
        Fechar
      </button>
    </>
  )
}

interface PartialErrorStepProps {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  errorDetail: string | null
  onClose: () => void
  onRetry: () => void
}

function PartialErrorStep({ headingRef, errorDetail, onClose, onRetry }: PartialErrorStepProps) {
  return (
    <>
      <h2
        ref={headingRef}
        id={HEADING_ID}
        tabIndex={-1}
        className="text-white text-2xl font-bold outline-none"
      >
        Exclusão não concluída
      </h2>
      <p role="status" aria-live="polite" className={bannerWarningClasses}>
        O arquivo CSV já foi salvo — nada foi perdido. Mas não foi possível concluir a exclusão.
      </p>
      {errorDetail && <p className="text-gray-400 text-xs">Detalhe: {errorDetail}</p>}
      <div className="flex gap-4">
        <button type="button" className={secondaryButtonClasses} onClick={onClose}>
          Fechar
        </button>
        <button type="button" className={dangerButtonClasses} onClick={onRetry}>
          Tentar excluir novamente
        </button>
      </div>
    </>
  )
}
