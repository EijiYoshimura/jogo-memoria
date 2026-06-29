import { describe, it, expect } from 'vitest'
import { sanitizeExternalUrl } from '../sanitizeExternalUrl'

describe('sanitizeExternalUrl', () => {
  describe('caminho feliz — esquemas permitidos', () => {
    it('aceita http: e devolve a string original', () => {
      expect(sanitizeExternalUrl('http://example.com/policy')).toBe(
        'http://example.com/policy'
      )
    })

    it('aceita https: e devolve a string original', () => {
      expect(sanitizeExternalUrl('https://example.com/policy')).toBe(
        'https://example.com/policy'
      )
    })

    it('aceita URL relativa e a devolve EXATAMENTE como veio (não resolve contra a base)', () => {
      expect(sanitizeExternalUrl('/policy.html')).toBe('/policy.html')
      expect(sanitizeExternalUrl('./policy.html')).toBe('./policy.html')
      expect(sanitizeExternalUrl('../policy.html')).toBe('../policy.html')
    })

    it('aceita caixa alta no esquema permitido (HTTPS) e devolve a string original', () => {
      expect(sanitizeExternalUrl('HTTPS://example.com')).toBe('HTTPS://example.com')
    })
  })

  describe('rejeição — esquemas perigosos', () => {
    it('rejeita javascript:', () => {
      expect(sanitizeExternalUrl('javascript:alert(1)')).toBeUndefined()
    })

    it('rejeita data:', () => {
      expect(
        sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')
      ).toBeUndefined()
    })

    it('rejeita vbscript:', () => {
      expect(sanitizeExternalUrl('vbscript:msgbox(1)')).toBeUndefined()
    })

    it('rejeita file:', () => {
      expect(sanitizeExternalUrl('file:///etc/passwd')).toBeUndefined()
    })

    it('rejeita javascript: com variação de caixa (JavaScript:)', () => {
      expect(sanitizeExternalUrl('JavaScript:alert(1)')).toBeUndefined()
    })

    it('rejeita javascript: com espaço/controle inicial ( javascript:)', () => {
      expect(sanitizeExternalUrl(' javascript:alert(1)')).toBeUndefined()
      expect(sanitizeExternalUrl('\tjavascript:alert(1)')).toBeUndefined()
    })
  })

  describe('entradas vazias/ausentes', () => {
    it('retorna undefined para undefined', () => {
      expect(sanitizeExternalUrl(undefined)).toBeUndefined()
    })

    it('retorna undefined para string vazia', () => {
      expect(sanitizeExternalUrl('')).toBeUndefined()
    })
  })

  describe('entradas malformadas', () => {
    it('retorna undefined para URL não parseável', () => {
      expect(sanitizeExternalUrl('http://[invalid')).toBeUndefined()
    })
  })
})
