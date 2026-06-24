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
    autoResetSeconds?: number
  }
  leadForm: {
    title: string
    fields: Array<{
      id: string
      label: string
      type: 'text' | 'email' | 'tel'
      required: boolean
      mask?: string
    }>
  }
  adminPin: string
  lgpd?: {
    consentVersion: string
    dataController: string
    purposeText: string
    retentionMonths: number
    privacyPolicyUrl?: string
  }
}
