import { useMemo, useState } from 'react'
import type { GameConfig } from '../game/types'
import {
  applyKey,
  resolveLayout,
  useVirtualKeyboard,
  VirtualKeyboard,
  type KeyboardKey,
} from '../lead-capture/keyboard'

interface LeadFormProps {
  config: GameConfig
  onSubmit: (formData: Record<string, string>) => void
}

const DEFAULT_ACCENT_COLOR = '#FCFC30'
const ERROR_BORDER_COLOR = '#EF4444'

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function LeadForm({ config, onSubmit }: LeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.leadForm.fields.map((f) => [f.id, '']))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const vkEnabled = config.leadForm.virtualKeyboard?.enabled ?? false
  const accent = config.event.accentColor ?? DEFAULT_ACCENT_COLOR
  const { activeFieldId, isShifted, setActiveField, setShift } = useVirtualKeyboard(vkEnabled)

  const activeField = config.leadForm.fields.find((f) => f.id === activeFieldId) ?? null
  const activeLayout = useMemo(
    () => (activeField ? resolveLayout(activeField) : null),
    [activeField]
  )

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
    const { nextRaw, nextShift } = applyKey({
      currentValue: current,
      key,
      isShifted,
      fieldType: activeField.type,
      hasMask: !!activeField.mask,
    })
    setShift(nextShift)
    if ((key.action ?? 'char') !== 'shift') {
      handleChange(activeField.id, activeField.type, !!activeField.mask, nextRaw)
    }
  }

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) {
      onSubmit(values)
    }
  }

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden rounded-[2.25rem] border-8 border-white"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div
        className={`flex flex-col items-center w-full px-[8%] py-8 overflow-y-auto ${
          vkEnabled ? 'flex-1 justify-start' : 'justify-center h-full'
        }`}
      >
        <div className="w-full max-w-lg flex flex-col items-center">
          <img
            src="/images/logo_bb.png"
            alt="BB Seguros"
            className={`mx-auto object-contain mb-10 ${vkEnabled ? 'w-[30%] mt-2' : 'w-[42%] mt-[9%]'}`}
            draggable={false}
          />
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 w-full"
            autoComplete="off"
          >
            {config.leadForm.fields.map((field) => {
              const hasError = !!errors[field.id]
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
                    type={field.type}
                    value={values[field.id] ?? ''}
                    onChange={(e) =>
                      handleChange(field.id, field.type, !!field.mask, e.target.value)
                    }
                    autoComplete="off"
                    readOnly={vkEnabled}
                    aria-readonly={vkEnabled || undefined}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? `${field.id}-error` : undefined}
                    inputMode={
                      vkEnabled ? 'none' : field.type === 'tel' ? 'numeric' : undefined
                    }
                    {...(vkEnabled
                      ? {
                          onClick: () => setActiveField(field.id),
                          onFocus: () => setActiveField(field.id),
                        }
                      : {})}
                    className="w-full rounded-full bg-white text-gray-900 border-4 px-5 outline-none font-bb-textos focus:ring-2 focus:ring-[#0333BD]"
                    style={{
                      minHeight: '56px',
                      fontSize: '20px',
                      borderColor: hasError ? ERROR_BORDER_COLOR : accent,
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
            <button
              type="submit"
              className="mt-8 mx-auto w-[38%] rounded-full border-4 border-white text-[#0333BD] font-bb-titulos font-extrabold uppercase text-xl min-h-[56px] px-6 transition-opacity active:opacity-80"
              style={{ backgroundColor: accent }}
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
    </div>
  )
}
