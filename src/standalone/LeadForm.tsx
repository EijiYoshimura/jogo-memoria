import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GameConfig } from '../game/types'
import {
  applyKey,
  resolveLayout,
  useVirtualKeyboard,
  VirtualKeyboard,
  type KeyboardKey,
} from '../lead-capture/keyboard'
import { applyPhoneMask } from '../lead-capture/mask/phoneMask'
import { TermsModal } from './TermsModal'

interface LeadFormProps {
  config: GameConfig
  onSubmit: (formData: Record<string, string>) => void
}

const DEFAULT_ACCENT_COLOR = '#FCFC30'
const ERROR_BORDER_COLOR = '#EF4444'
const ACTIVE_BORDER_COLOR = '#0333BD'
const ACTIVE_RING_SHADOW = '0 0 0 4px rgba(3, 51, 189, 0.35)'
const ERROR_RING_SHADOW = '0 0 0 4px rgba(239, 68, 68, 0.35)'
const CONSENT_REQUIRED_MESSAGE = 'É necessário aceitar os termos para participar'
// Campo que recebe auto-shift (1ª letra maiúscula) ao ser ativado vazio (decisão PO 1).
const AUTO_SHIFT_FIELD_ID = 'name'

// Teclas de navegação/controle permitidas sob VK (não mutam o valor do campo).
const NAVIGATION_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
  'Shift',
  'Control',
  'Alt',
  'Meta',
])

/** Esmaece um accent em hex 6 dígitos (40% alpha) para o estado desabilitado do botão. */
function dimmedAccent(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}66` : hex
}

/**
 * Sob VK o input é editável (para o caret aparecer e o toque posicionar), mas a digitação
 * nativa é bloqueada: apenas o teclado virtual muta o valor. Permite navegação/seleção e
 * bloqueia qualquer tecla que insira/remova texto (imprimíveis, Backspace, Delete, Enter).
 */
function blockNativeTextKey(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (NAVIGATION_KEYS.has(e.key)) return
  e.preventDefault()
}

function blockNativeMutation(
  e: React.FormEvent<HTMLInputElement> | React.ClipboardEvent | React.DragEvent
): void {
  e.preventDefault()
}

export function LeadForm({ config, onSubmit }: LeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.leadForm.fields.map((f) => [f.id, '']))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [accepted, setAccepted] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [showTerms, setShowTerms] = useState(false)

  const vkEnabled = config.leadForm.virtualKeyboard?.enabled ?? false
  const accent = config.event.accentColor ?? DEFAULT_ACCENT_COLOR
  const { activeFieldId, isShifted, setActiveField, setShift } = useVirtualKeyboard(vkEnabled)

  // Caret no input controlado: refs por campo + posição-alvo a reaplicar após o re-render.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const pendingCaret = useRef<number | null>(null)

  const activeField = config.leadForm.fields.find((f) => f.id === activeFieldId) ?? null
  const activeLayout = useMemo(
    () => (activeField ? resolveLayout(activeField) : null),
    [activeField]
  )

  // Ativa um campo (compartilhado por onFocus/onClick). Ao ATIVAR (id muda) o campo `name`
  // vazio, arma o shift para a 1ª letra sair maiúscula (auto-shift). A regra de form fica
  // aqui, não vaza para o hook genérico. O guard `isActivating` evita re-armar no re-foco do
  // mesmo campo já ativo (Cenário 8) e no re-foco do reposicionamento de caret (HUB-69).
  function activateField(fieldId: string) {
    const isActivating = fieldId !== activeFieldId
    setActiveField(fieldId)
    if (isActivating && fieldId === AUTO_SHIFT_FIELD_ID && (values[fieldId] ?? '') === '') {
      setShift(true)
    }
  }

  function handleChange(fieldId: string, fieldType: string, hasMask: boolean, raw: string) {
    const value = hasMask && fieldType === 'tel' ? applyPhoneMask(raw) : raw
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: '' }))
    }
  }

  function handleVirtualKey(key: KeyboardKey) {
    if (!activeField) return
    const el = inputRefs.current[activeField.id]
    const current = values[activeField.id] ?? ''
    // Lê o caret no momento da tecla; tocar no campo já posiciona a selectionStart (Cenário 2).
    const caretStart = el?.selectionStart ?? current.length
    const caretEnd = el?.selectionEnd ?? caretStart
    const { nextRaw, nextShift, nextCaret } = applyKey({
      currentValue: current,
      key,
      isShifted,
      fieldType: activeField.type,
      hasMask: !!activeField.mask,
      caretStart,
      caretEnd,
    })
    setShift(nextShift)
    pendingCaret.current = nextCaret
    if ((key.action ?? 'char') !== 'shift') {
      handleChange(activeField.id, activeField.type, !!activeField.mask, nextRaw)
    }
  }

  // Reposiciona o caret após o re-render controlado e re-foca o campo ativo (o clique na
  // tecla "rouba" o foco). useLayoutEffect evita flicker entre o paint e o reposicionamento.
  useLayoutEffect(() => {
    const target = pendingCaret.current
    if (target === null || !activeFieldId) return
    const el = inputRefs.current[activeFieldId]
    if (!el) return
    el.focus()
    el.setSelectionRange(target, target)
    pendingCaret.current = null
  })

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const field of config.leadForm.fields) {
      const value = values[field.id]?.trim() ?? ''
      if (field.required && !value) {
        newErrors[field.id] = `${field.label} é obrigatório`
      } else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.id] = 'E-mail inválido'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleAcceptedChange(next: boolean) {
    setAccepted(next)
    if (next) setConsentError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Gating em dupla camada e independente: validação de campos E consentimento.
    const fieldsOk = validate()
    const consentOk = accepted
    if (!consentOk) setConsentError(CONSENT_REQUIRED_MESSAGE)
    if (!fieldsOk || !consentOk) return
    onSubmit(values)
  }

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden rounded-[2.25rem] border-8 border-white"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div
        className={`flex flex-col items-center w-full px-[8%] py-8 overflow-y-auto ${
          vkEnabled ? 'flex-1' : 'justify-center h-full'
        }`}
      >
        <div
          className={`w-full max-w-lg flex flex-col items-center ${vkEnabled ? 'my-auto' : ''}`}
        >
          <img
            src="/images/logo_bb.png"
            alt="BB Seguros"
            className={`mx-auto object-contain mb-10 ${vkEnabled ? 'w-[55%] mt-2' : 'w-[55%] mt-[9%]'}`}
            draggable={false}
          />
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 w-full"
            autoComplete="off"
          >
            {config.leadForm.fields.map((field) => {
              const hasError = !!errors[field.id]
              const isActive = vkEnabled && activeFieldId === field.id
              const borderColor = hasError
                ? ERROR_BORDER_COLOR
                : isActive
                  ? ACTIVE_BORDER_COLOR
                  : accent
              const boxShadow = isActive
                ? hasError
                  ? ERROR_RING_SHADOW
                  : ACTIVE_RING_SHADOW
                : undefined
              return (
                <div key={field.id} className="flex flex-col gap-2">
                  <label
                    htmlFor={field.id}
                    className="font-bb-titulos italic font-bold uppercase text-white text-2xl"
                  >
                    {field.label}
                    {field.required && <span className="text-[#FFC7C7] ml-1">*</span>}
                  </label>
                  <input
                    id={field.id}
                    ref={(el) => {
                      inputRefs.current[field.id] = el
                    }}
                    type={vkEnabled && field.type === 'email' ? 'text' : field.type}
                    value={values[field.id] ?? ''}
                    onChange={(e) =>
                      handleChange(field.id, field.type, !!field.mask, e.target.value)
                    }
                    autoComplete="off"
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? `${field.id}-error` : undefined}
                    inputMode={
                      vkEnabled ? 'none' : field.type === 'tel' ? 'numeric' : undefined
                    }
                    {...(vkEnabled
                      ? {
                          // Editável (sem readOnly) para o caret/toque funcionarem, mas a
                          // digitação nativa é bloqueada — só o VK muta o valor.
                          onClick: () => activateField(field.id),
                          onFocus: () => activateField(field.id),
                          onKeyDown: blockNativeTextKey,
                          onBeforeInput: blockNativeMutation,
                          onPaste: blockNativeMutation,
                          onDrop: blockNativeMutation,
                        }
                      : {})}
                    className="w-full rounded-full bg-white text-gray-900 border-4 px-5 outline-none font-bb-textos caret-[#0333BD] transition-shadow focus-visible:ring-2 focus-visible:ring-[#0333BD]"
                    style={{
                      minHeight: '56px',
                      fontSize: '20px',
                      borderColor,
                      boxShadow,
                    }}
                  />
                  {hasError && (
                    <span
                      id={`${field.id}-error`}
                      className="text-[#FFC7C7] font-bb-textos text-base"
                    >
                      {errors[field.id]}
                    </span>
                  )}
                </div>
              )
            })}
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={accepted}
                  onChange={(e) => handleAcceptedChange(e.target.checked)}
                  aria-describedby={consentError ? 'consent-error' : undefined}
                  aria-invalid={consentError ? true : undefined}
                />
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[#FCFC30] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0333BD] ${
                    consentError
                      ? 'border-[#FFC7C7]'
                      : 'border-white peer-checked:border-[#FCFC30]'
                  } ${accepted ? 'bg-[#FCFC30]' : 'bg-transparent'}`}
                >
                  {accepted && (
                    <span className="text-[#0333BD] text-lg font-bold leading-none">✓</span>
                  )}
                </span>
                <span className="font-bb-textos text-white text-base leading-snug">
                  Li e aceito os{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowTerms(true)
                    }}
                    className="underline text-[#FCFC30] font-medium"
                  >
                    termos de consentimento
                  </button>{' '}
                  e a Política de Privacidade.
                </span>
              </label>
              {consentError && (
                <span
                  id="consent-error"
                  aria-live="polite"
                  className="text-[#FFC7C7] font-bb-textos text-base"
                >
                  {consentError}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!accepted}
              aria-disabled={!accepted}
              className="mt-8 mx-auto w-[38%] rounded-full border-4 border-white text-[#0333BD] font-bb-titulos font-extrabold uppercase text-xl min-h-[56px] px-6 transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:text-[#0333BD]/50"
              style={{ backgroundColor: accepted ? accent : dimmedAccent(accent) }}
            >
              ENVIAR
            </button>
          </form>
        </div>
      </div>
      {vkEnabled && activeLayout && (
        <VirtualKeyboard
          layout={activeLayout}
          isShifted={isShifted}
          onKey={handleVirtualKey}
          visible={!!activeFieldId}
        />
      )}
      {showTerms && <TermsModal config={config} onClose={() => setShowTerms(false)} />}
    </div>
  )
}
