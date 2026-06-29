import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GameConfig } from '../game/types'
import {
  applyKey,
  resolveLayout,
  useVirtualKeyboard,
  VirtualKeyboard,
  type KeyboardKey,
} from '../lead-capture/keyboard'
import {
  caretIndexFromOffset,
  clampCaretIndex,
  createCanvasTextMeasurer,
  INPUT_FONT,
  nextVisibleScrollLeft,
  type TextMeasurer,
} from '../lead-capture/keyboard/caret'
import { applyPhoneMask } from '../lead-capture/mask/phoneMask'
import {
  CaretOverlay,
  CONTENT_LEFT_OFFSET_PX,
  INPUT_PADDING_LEFT_PX,
} from './CaretOverlay'
import { TermsModal } from './TermsModal'

interface LeadFormProps {
  config: GameConfig
  onSubmit: (formData: Record<string, string>) => void
  /**
   * Medidor de largura de texto (injetável). Default: canvas na fonte do input.
   * Os testes injetam um medidor determinístico (jsdom não implementa measureText).
   */
  measureText?: TextMeasurer
}

const DEFAULT_ACCENT_COLOR = '#FCFC30'
const ERROR_BORDER_COLOR = '#EF4444'
const ACTIVE_BORDER_COLOR = '#0333BD'
const ACTIVE_RING_SHADOW = '0 0 0 4px rgba(3, 51, 189, 0.35)'
const ERROR_RING_SHADOW = '0 0 0 4px rgba(239, 68, 68, 0.35)'
const CONSENT_REQUIRED_MESSAGE = 'É necessário aceitar os termos para participar'
// Campo que recebe auto-shift (1ª letra maiúscula) ao ser ativado vazio (decisão PO 1).
const AUTO_SHIFT_FIELD_ID = 'name'

/** Esmaece um accent em hex 6 dígitos (40% alpha) para o estado desabilitado do botão. */
function dimmedAccent(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}66` : hex
}

export function LeadForm({ config, onSubmit, measureText }: LeadFormProps) {
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

  // Caret customizado (HUB-78): sob VK os inputs são `readOnly` (suprime o teclado
  // nativo do Android), então o caret nativo some. Todo o estado de caret vive aqui em
  // React: `caretPos` por campo + `caretScrollLeft` do campo ativo. `refocusActive`
  // re-foca o input após o clique numa tecla (que rouba o foco) — só quando há tecla.
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // Container do teclado virtual: o handler de "tocar fora" (HUB-86) usa `contains` para
  // distinguir toques no teclado (mantêm aberto) de toques numa área neutra (fecham).
  const keyboardRef = useRef<HTMLDivElement>(null)
  const refocusActive = useRef(false)
  const [caretPos, setCaretPos] = useState<Record<string, number>>({})
  const [caretScrollLeft, setCaretScrollLeft] = useState(0)
  const measure = useMemo<TextMeasurer>(
    () => measureText ?? createCanvasTextMeasurer(INPUT_FONT),
    [measureText]
  )

  function caretFor(fieldId: string): number {
    const value = values[fieldId] ?? ''
    return clampCaretIndex(caretPos[fieldId] ?? value.length, value.length)
  }

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
    const current = values[activeField.id] ?? ''
    // O caret é estado React (caretPos); default = fim do valor (HUB-78).
    const caretStart = caretFor(activeField.id)
    const { nextRaw, nextShift, nextCaret } = applyKey({
      currentValue: current,
      key,
      isShifted,
      fieldType: activeField.type,
      hasMask: !!activeField.mask,
      caretStart,
      caretEnd: caretStart,
    })
    setShift(nextShift)
    setCaretPos((prev) => ({ ...prev, [activeField.id]: nextCaret }))
    refocusActive.current = true
    if ((key.action ?? 'char') !== 'shift') {
      handleChange(activeField.id, activeField.type, !!activeField.mask, nextRaw)
    }
  }

  // Posiciona o caret por toque: converte o X do ponteiro para coords de conteúdo
  // (descontados borda+padding e somado o scroll) e acha o índice mais próximo pela
  // geometria — robusto no Android, onde o caret nativo do input readOnly não posiciona.
  function handlePointerDown(fieldId: string, e: React.PointerEvent<HTMLInputElement>) {
    const el = e.currentTarget
    const offsetX = e.clientX - el.getBoundingClientRect().left - CONTENT_LEFT_OFFSET_PX + el.scrollLeft
    const value = values[fieldId] ?? ''
    setCaretPos((prev) => ({ ...prev, [fieldId]: caretIndexFromOffset(offsetX, value, measure) }))
  }

  // Após o re-render controlado: re-foca o campo ativo apenas quando uma tecla virtual o
  // desfocou (o clique na tecla rouba o foco) e ajusta o scrollLeft para manter o caret
  // visível em textos longos. useLayoutEffect evita flicker entre paint e reposicionamento.
  useLayoutEffect(() => {
    if (!vkEnabled || !activeFieldId) return
    const el = inputRefs.current[activeFieldId]
    if (!el) return
    if (refocusActive.current) {
      el.focus()
      refocusActive.current = false
    }
    const value = values[activeFieldId] ?? ''
    const pos = clampCaretIndex(caretPos[activeFieldId] ?? value.length, value.length)
    const caretX = CONTENT_LEFT_OFFSET_PX + measure(value.slice(0, pos))
    const nextScroll = nextVisibleScrollLeft(
      caretX,
      el.scrollLeft,
      el.clientWidth,
      INPUT_PADDING_LEFT_PX
    )
    if (el.scrollLeft !== nextScroll) el.scrollLeft = nextScroll
    // Guarda contra re-render em cadeia: só atualiza quando o scroll muda de fato.
    if (caretScrollLeft !== nextScroll) setCaretScrollLeft(nextScroll)
  }, [vkEnabled, activeFieldId, values, caretPos, caretScrollLeft, measure])

  // Dispensa o teclado ao tocar fora dos campos e do teclado (HUB-86). Ligado ao `onClick`
  // do root (fase bubble): o `click` do alvo (ENVIAR/checkbox) roda ANTES de borbular até
  // aqui, então a ação acontece no mesmo toque e só depois fechamos o teclado. NÃO chama
  // preventDefault/stopPropagation. Inerte quando o teclado está desligado ou já fechado.
  function handleRootClick(e: React.MouseEvent) {
    if (!vkEnabled || !activeFieldId) return
    const target = e.target as Node
    // Toque num input de campo (texto/email/tel): a troca de campo segue pelo onClick/onFocus
    // do input — só o checkbox de consentimento é `<input>` mas NÃO está em inputRefs (fecha).
    const inField = Object.values(inputRefs.current).some((el) => el?.contains(target))
    if (inField) return
    // Toque numa tecla/long-press/backspace dentro do teclado: mantém aberto.
    if (keyboardRef.current?.contains(target)) return
    setActiveField(null)
    setShift(false)
  }

  // O link de termos faz `stopPropagation` no próprio click (para o label não alternar o
  // checkbox), então seu click não borbulha ao root. Fechamos o teclado de forma declarativa
  // quando o modal abre: toque único no link abre o modal E dispensa o teclado (CA5).
  useEffect(() => {
    if (showTerms) {
      setActiveField(null)
      setShift(false)
    }
  }, [showTerms, setActiveField, setShift])

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
      onClick={handleRootClick}
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
                  <div className="relative">
                    <input
                      id={field.id}
                      ref={(el) => {
                        inputRefs.current[field.id] = el
                      }}
                      type={field.type}
                      value={values[field.id] ?? ''}
                      onChange={(e) =>
                        handleChange(field.id, field.type, !!field.mask, e.target.value)
                      }
                      autoComplete="off"
                      aria-invalid={hasError || undefined}
                      aria-describedby={hasError ? `${field.id}-error` : undefined}
                      inputMode={
                        vkEnabled ? undefined : field.type === 'tel' ? 'numeric' : undefined
                      }
                      {...(vkEnabled
                        ? {
                            // readOnly suprime o teclado nativo do Android de forma
                            // confiável (HUB-78), mas continua focável: só o teclado virtual
                            // muta o valor. O caret é renderizado pelo CaretOverlay.
                            readOnly: true,
                            onClick: () => activateField(field.id),
                            onFocus: () => activateField(field.id),
                            onPointerDown: (e: React.PointerEvent<HTMLInputElement>) =>
                              handlePointerDown(field.id, e),
                          }
                        : {})}
                      className="w-full rounded-full bg-white text-gray-900 border-4 px-5 outline-none font-bb-textos transition-shadow focus-visible:ring-2 focus-visible:ring-[#0333BD]"
                      style={{
                        minHeight: '56px',
                        fontSize: '20px',
                        borderColor,
                        boxShadow,
                      }}
                    />
                    {isActive && (
                      <CaretOverlay
                        value={values[field.id] ?? ''}
                        caretPos={caretFor(field.id)}
                        measure={measure}
                        scrollLeft={caretScrollLeft}
                      />
                    )}
                  </div>
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
                    termos de consentimento e a Política de Privacidade.
                  </button>{' '}

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
        <div ref={keyboardRef} className="w-full shrink-0">
          <VirtualKeyboard
            layout={activeLayout}
            isShifted={isShifted}
            onKey={handleVirtualKey}
            visible={!!activeFieldId}
          />
        </div>
      )}
      {showTerms && <TermsModal config={config} onClose={() => setShowTerms(false)} />}
    </div>
  )
}
