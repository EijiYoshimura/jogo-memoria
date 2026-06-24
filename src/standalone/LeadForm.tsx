import { useState } from 'react'
import type { GameConfig } from '../game/types'

interface LeadFormProps {
  config: GameConfig
  onSubmit: (formData: Record<string, string>) => void
}

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

  function handleChange(fieldId: string, fieldType: string, hasMask: boolean, raw: string) {
    const value = hasMask && fieldType === 'tel' ? applyPhoneMask(raw) : raw
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: '' }))
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
      className="flex flex-col items-center justify-center h-full w-full p-8 overflow-y-auto"
      style={{ backgroundColor: config.event.backgroundColor }}
    >
      <div className="w-full max-w-lg">
        <h1
          className="text-3xl font-bold text-center mb-8"
          style={{ color: config.event.primaryColor }}
        >
          {config.leadForm.title}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" autoComplete="off">
          {config.leadForm.fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1">
              <label
                htmlFor={field.id}
                className="text-white font-medium"
                style={{ fontSize: '18px' }}
              >
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                id={field.id}
                type={field.type}
                value={values[field.id] ?? ''}
                onChange={(e) =>
                  handleChange(field.id, field.type, !!field.mask, e.target.value)
                }
                autoComplete="off"
                inputMode={field.type === 'tel' ? 'numeric' : undefined}
                className={`w-full rounded-xl px-4 bg-white text-gray-900 border-2 outline-none focus:border-opacity-100 ${
                  errors[field.id] ? 'border-red-500' : 'border-transparent focus:border-purple-400'
                }`}
                style={{ minHeight: '56px', fontSize: '20px' }}
              />
              {errors[field.id] && (
                <span className="text-red-400 text-base">{errors[field.id]}</span>
              )}
            </div>
          ))}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl font-bold text-white text-xl py-4 transition-opacity active:opacity-80"
            style={{ backgroundColor: config.event.primaryColor, minHeight: '64px' }}
          >
            Jogar
          </button>
        </form>
      </div>
    </div>
  )
}
