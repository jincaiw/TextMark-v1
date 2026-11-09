import { describe, expect, it } from 'vitest'
import { normalizeThemeColors, resolvedThemePalette, THEME_PRESETS } from './theme'

describe('upstream theme preset parity', () => {
  it('ships the upstream nine-preset gallery in gallery order', () => {
    expect(Object.values(THEME_PRESETS).map((preset) => preset.name)).toEqual([
      'Original',
      'Quiet',
      'Paper',
      'Bold',
      'Calm',
      'Focus',
      'Graphite',
      'Dusk',
      'Midnight',
    ])
  })

  it('keeps custom colors valid, scheme-specific, and normalized', () => {
    const colors = normalizeThemeColors({ light: { linkColor: '#de4a4f', textColor: 'red' }, dark: { windowBackground: '#1e1e1e' } })
    expect(colors).toEqual({ light: { linkColor: '#DE4A4F' }, dark: { windowBackground: '#1E1E1E' } })
    expect(resolvedThemePalette('normal', 'light', colors).linkColor).toBe('#DE4A4F')
    expect(resolvedThemePalette('normal', 'dark', colors).windowBackground).toBe('#1E1E1E')
  })
})
