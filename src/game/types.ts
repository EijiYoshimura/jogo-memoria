export interface GameConfig {
  event: {
    id: string
    name: string
    logo: string
    primaryColor: string
    backgroundColor: string
  }
  game: {
    pairs: number
    cardImages: string[]
    cardBack: string
    timeLimitSeconds: number
    /**
     * Liga/desliga o timer do jogo (HUB-63). Opcional e retrocompatível.
     * Ausente/`false` (default) ⇒ timer desativado (não renderiza, sem derrota por tempo).
     * `true` ⇒ ativa a contagem regressiva (`timeLimitSeconds`) e a derrota por tempo.
     */
    timerEnabled?: boolean
    autoResetSeconds?: number
  }
  leadForm: {
    title: string
    /**
     * Teclado virtual on-screen (HUB-57). Opcional e retrocompatível.
     * Ausente/`enabled: false` (default) ⇒ teclado nativo do SO (comportamento atual).
     */
    virtualKeyboard?: {
      enabled: boolean
    }
    fields: Array<{
      id: string
      label: string
      type: 'text' | 'email' | 'tel'
      required: boolean
      mask?: string
      /** Override de layout do teclado virtual por campo; ausência cai no `type`. */
      keyboardLayout?: string
    }>
  }
  adminPin: string
  lgpd?: {
    consentVersion: string
    dataController: string
    purposeText: string
    retentionMonths: number
    privacyPolicyUrl?: string
    /**
     * Caminho same-origin para o HTML da política de privacidade exibido
     * in-app via `<iframe>` (ex.: `/privacy-policy.html`, servido de `public/`).
     * Opcional e retrocompatível. Quando presente, o link "Ler Política de
     * Privacidade" abre a tela interna `PrivacyPolicyScreen` em vez de uma nova
     * aba; tem prioridade sobre `privacyPolicyUrl`.
     */
    privacyPolicyPath?: string
    /**
     * Texto jurídico completo do consentimento. Quando presente e não-vazio,
     * substitui os parágrafos templados (autorização + retenção). Texto puro;
     * quebras de linha (`\n`) são preservadas na renderização. Ao alterar este
     * texto, incremente `consentVersion`.
     */
    consentText?: string
  }
}
