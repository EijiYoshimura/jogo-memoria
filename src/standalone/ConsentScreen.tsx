import type { GameConfig } from '../game/types'

const DEFAULT_PURPOSE_TEXT = 'para entrar em contato sobre as novidades do evento'
const DEFAULT_RETENTION_MONTHS = 12
const DEFAULT_CONSENT_VERSION = 'default'

interface ConsentScreenProps {
  config: GameConfig
  onAccept: () => void
  onDecline: () => void
}

export function ConsentScreen({ config, onAccept, onDecline }: ConsentScreenProps) {
  const { event, lgpd } = config

  const dataController = lgpd?.dataController ?? event.name
  const purposeText = lgpd?.purposeText ?? DEFAULT_PURPOSE_TEXT
  const retentionMonths = lgpd?.retentionMonths ?? DEFAULT_RETENTION_MONTHS
  const privacyPolicyUrl = lgpd?.privacyPolicyUrl

  const buttonBaseStyle: React.CSSProperties = {
    minHeight: '64px',
    width: '100%',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: `2px solid ${event.primaryColor}`,
    transition: 'opacity 0.2s',
  }

  const acceptButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: event.primaryColor,
    color: '#ffffff',
  }

  const declineButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    color: event.primaryColor,
  }

  return (
    <div
      style={{ backgroundColor: event.backgroundColor }}
      className="w-full min-h-screen flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <img
          src={event.logo}
          alt={`Logo ${event.name}`}
          className="max-h-24 object-contain"
        />

        <h1 className="text-white text-2xl font-bold text-center">{event.name}</h1>

        <div className="bg-white bg-opacity-10 rounded-xl p-6 text-white text-sm leading-relaxed space-y-3">
          <p className="font-semibold text-base">Antes de jogar, precisamos do seu consentimento.</p>
          <p>
            Ao clicar em <strong>Participar e aceitar</strong>, você autoriza{' '}
            <strong>{dataController}</strong> a coletar e tratar seus dados pessoais{' '}
            {purposeText}, de acordo com a LGPD (Lei n.&ordm; 13.709/2018).
          </p>
          <p>
            Seus dados serão armazenados por até{' '}
            <strong>{retentionMonths} {retentionMonths === 1 ? 'mês' : 'meses'}</strong> e poderão ser
            excluídos a qualquer momento mediante solicitação.
          </p>
          {privacyPolicyUrl && (
            <p>
              <a
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: event.primaryColor }}
                className="underline font-medium"
              >
                Ler Política de Privacidade
              </a>
            </p>
          )}
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            style={acceptButtonStyle}
            onClick={onAccept}
            type="button"
            aria-label="Participar e aceitar os termos de consentimento"
          >
            Participar e aceitar
          </button>
          <button
            style={declineButtonStyle}
            onClick={onDecline}
            type="button"
            aria-label="Jogar sem participar da captura de dados"
          >
            Jogar sem participar
          </button>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_CONSENT_VERSION }
