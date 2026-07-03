// Modal de termos de consentimento (apresentacional). role="dialog" + aria-modal,
// focus-trap, fecha por X/Fechar/overlay/Esc, trava o scroll do body. Renderiza o texto
// de buildConsentText e, quando configurado, a Política de Privacidade (HUB-62) numa
// camada acima (z-[60] > modal z-50 > teclado virtual). Reaproveita PrivacyPolicyScreen.

import { useState } from 'react'
import type { GameConfig } from '../game/types'
import { buildConsentText, getPurposeText } from './lib/lgpd'
import { sanitizeExternalUrl } from './lib/sanitizeExternalUrl'
import { PrivacyPolicyScreen } from './PrivacyPolicyScreen'
import { useModalA11y } from './hooks/useModalA11y'

interface TermsModalProps {
  config: GameConfig
  onClose: () => void
}

const TITLE_ID = 'terms-modal-title'

export function TermsModal({ config, onClose }: TermsModalProps) {
  const [showPolicy, setShowPolicy] = useState(false)
  const { cardRef, onKeyDown } = useModalA11y({ onEscape: onClose })

  const consentText = buildConsentText(config)
  const purposeText = getPurposeText(config)
  const privacyPolicyPath = config.lgpd?.privacyPolicyPath
  const privacyPolicyUrl = sanitizeExternalUrl(config.lgpd?.privacyPolicyUrl)

  if (showPolicy && privacyPolicyPath) {
    return (
      <div className="fixed inset-0 z-[60]">
        <PrivacyPolicyScreen
          privacyPolicyPath={privacyPolicyPath}
          primaryColor={config.event.primaryColor}
          backgroundColor={config.event.backgroundColor}
          onBack={() => setShowPolicy(false)}
        />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-[80%] max-w-none max-h-[80vh] flex flex-col bg-white rounded-[1.5rem] shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <h2
            id={TITLE_ID}
            className="font-bb-titulos font-bold text-[#0333BD] text-xl"
          >
            Termos de uso e política de privacidade
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-11 h-11 flex items-center justify-center text-[#0333BD] text-2xl rounded-full active:bg-black/10"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 font-bb-textos text-gray-800 text-base leading-relaxed">
          <div>
            <h3 className="font-bb-titulos font-bold text-[#0333BD] text-sm">
              Termos de Uso
            </h3>
            <p className="mt-1" style={{ whiteSpace: 'pre-line' }}>
              {consentText}
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-bb-titulos font-bold text-[#0333BD] text-sm">
              Política de Privacidade
            </h3>
            <p className="mt-1" style={{ whiteSpace: 'pre-line' }}>
              {purposeText}
            </p>
          </div>

          {privacyPolicyPath ? (
            <p className="mt-4">
              <button
                type="button"
                onClick={() => setShowPolicy(true)}
                className="underline text-[#0333BD] font-medium min-h-[44px] inline-flex items-center"
              >
                Ler Política de Privacidade
              </button>
            </p>
          ) : (
            privacyPolicyUrl && (
              <p className="mt-4">
                <a
                  href={privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#0333BD] font-medium min-h-[44px] inline-flex items-center"
                >
                  Ler Política de Privacidade
                </a>
              </p>
            )
          )}
        </div>

        <div className="p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[56px] rounded-full bg-[#FCFC30] text-[#0333BD] font-bb-titulos font-extrabold uppercase"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
