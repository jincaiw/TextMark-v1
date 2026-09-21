import { describe, expect, it } from 'vitest'
import { pdfCapability, pdfExportContract } from './pdfCapability'

describe('PDF capability probe', () => {
  it('prefers native vector printing on macOS Tauri', () => {
    expect(pdfCapability({ tauri: true, macos: true, printAvailable: true })).toBe('native-vector')
  })

  it('uses browser vector printing outside Tauri', () => {
    expect(pdfCapability({ tauri: false, macos: false, printAvailable: true })).toBe('browser-vector')
  })

  it('keeps raster export as an explicit fallback', () => {
    expect(pdfCapability({ tauri: true, macos: false, printAvailable: true })).toBe('raster-fallback')
    expect(pdfCapability({ tauri: true, macos: true, printAvailable: false })).toBe('raster-fallback')
  })

  it('exposes selectable-text guarantees only for print-backed paths', () => {
    expect(pdfExportContract({ tauri: true, macos: true, printAvailable: true })).toEqual({
      capability: 'native-vector',
      text: 'selectable-text',
      vectorGraphics: true,
    })
    expect(pdfExportContract({ tauri: false, macos: false, printAvailable: true })).toEqual({
      capability: 'browser-vector',
      text: 'selectable-text',
      vectorGraphics: true,
    })
    expect(pdfExportContract({ tauri: true, macos: false, printAvailable: true })).toEqual({
      capability: 'raster-fallback',
      text: 'rasterized',
      vectorGraphics: false,
    })
  })
})
