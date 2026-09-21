import { describe, expect, it } from 'vitest'
import { pdfCapability } from './pdfCapability'

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
})
