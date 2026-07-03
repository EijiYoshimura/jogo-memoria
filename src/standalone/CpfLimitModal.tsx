// Modal de bloqueio por limite de participações atingido (HUB-87 §6, Design §3.3).
// Ação única "Próximo participante" (sem X, sem "voltar"): Esc/backdrop disparam a
// MESMA ação do botão (reset do formulário) — não deixam o operador preso nem oferecem
// caminho alternativo de continuar tentando (Design decisão #6, WCAG 2.1.2). Reaproveita
// a acessibilidade do `useModalA11y` (foco/trap/scroll-lock), como o `TermsModal`.

import { useRef } from 'react'
import { useModalA11y } from './hooks/useModalA11y'

interface CpfLimitModalProps {
  /** Cor de destaque do evento (mesmo accent do formulário). */
  accent: string
  /** Reseta o formulário para o próximo participante (ação única do modal). */
  onReset: () => void
}

const TITLE_ID = 'cpf-limit-title'
const BODY_ID = 'cpf-limit-body'
const CTA_TEXT_COLOR = '#0333BD'

export function CpfLimitModal({ accent, onReset }: CpfLimitModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { cardRef, onKeyDown } = useModalA11y({ onEscape: onReset, initialFocusRef: buttonRef })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onReset}
      onKeyDown={onKeyDown}
    >
      {/* Anúncio da abertura ao leitor de tela (mesmo padrão de consentError). */}
      <span role="status" aria-live="polite" className="sr-only">
        Você já participou. Este CPF já atingiu o número máximo de participações deste evento.
      </span>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-[80%] max-w-none flex flex-col items-center text-center gap-6 bg-white rounded-[1.5rem] shadow-2xl outline-none p-8"
      >
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold"
          style={{ backgroundColor: accent, color: CTA_TEXT_COLOR }}
        >
          ✓
        </span>
        <h2 id={TITLE_ID} className="font-bb-titulos font-bold text-[#0333BD] text-2xl">
          Você já participou!
        </h2>
        <p id={BODY_ID} className="font-bb-textos text-gray-800 text-lg leading-relaxed">
          Este CPF já atingiu o número máximo de participações deste evento. Obrigado por
          participar!
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={onReset}
          className="rounded-full border-4 border-white font-bb-titulos font-extrabold uppercase text-2xl min-h-[56px] px-10 transition-opacity active:opacity-80"
          style={{ backgroundColor: accent, color: CTA_TEXT_COLOR }}
        >
          Próximo participante
        </button>
      </div>
    </div>
  )
}
