const BACK_BUTTON_MIN_SIZE = '44px'

interface PrivacyPolicyScreenProps {
  /** Caminho same-origin do HTML da política (ex.: `/privacy-policy.html`). */
  privacyPolicyPath: string
  /** Cor primária do evento, aplicada ao botão "Voltar". */
  primaryColor: string
  /** Cor de fundo do evento, aplicada ao cabeçalho e à moldura. */
  backgroundColor: string
  /** Fecha a tela e retorna à tela de consentimento. */
  onBack: () => void
}

/**
 * Tela full-screen que exibe o HTML da política de privacidade via `<iframe>`
 * sandbox (sem scripts/forms/popups), mantendo o usuário dentro do app (totem).
 * O conteúdo é same-origin; nunca usamos `dangerouslySetInnerHTML`.
 */
export function PrivacyPolicyScreen({
  privacyPolicyPath,
  primaryColor,
  backgroundColor,
  onBack,
}: PrivacyPolicyScreenProps) {
  const backButtonStyle: React.CSSProperties = {
    minHeight: BACK_BUTTON_MIN_SIZE,
    minWidth: BACK_BUTTON_MIN_SIZE,
    padding: '0 1.25rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: `2px solid ${primaryColor}`,
    backgroundColor: primaryColor,
    color: '#ffffff',
  }

  return (
    <div
      style={{ backgroundColor }}
      className="fixed inset-0 z-50 flex flex-col"
    >
      <header
        style={{ backgroundColor }}
        className="flex items-center gap-4 p-4 border-b border-white border-opacity-20"
      >
        <button
          type="button"
          onClick={onBack}
          style={backButtonStyle}
          aria-label="Voltar para a tela de consentimento"
        >
          ← Voltar
        </button>
        <h1 className="text-white text-xl font-bold">Política de Privacidade</h1>
      </header>

      <iframe
        src={privacyPolicyPath}
        title="Política de Privacidade"
        sandbox=""
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  )
}
