import { describe, it, expect } from 'vitest'
import indexHtml from '../../../index.html?raw'

/**
 * Guards the PWA/iOS meta tags authored in index.html (HUB-80).
 * The <link rel="manifest"> and registerSW script are injected by
 * vite-plugin-pwa at build time, so they are not asserted here — these
 * tests cover only what lives in the source index.html.
 */
describe('index.html PWA meta tags', () => {
  it('declares viewport-fit=cover for safe-area/fullscreen', () => {
    expect(indexHtml).toMatch(/name="viewport"[^>]*viewport-fit=cover/)
  })

  it('sets theme-color to the BB blue', () => {
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#0333BD"/)
  })

  it('enables iOS standalone web-app mode', () => {
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"')
  })

  it('sets the iOS status bar style', () => {
    expect(indexHtml).toContain('name="apple-mobile-web-app-status-bar-style"')
  })

  it('links the apple-touch-icon', () => {
    expect(indexHtml).toMatch(/<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/)
  })
})
