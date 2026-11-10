import { describe, expect, it } from 'vitest'
import { migrateThemePreset, normalizeThemeColors, resolvedThemePalette, THEME_PRESETS } from './theme'
import type { ThemePreset } from '../types'

describe('upstream theme preset parity', () => {
  it('ships the nine current named presets in gallery order', () => {
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

  it('gives each preset a whole reading look: flavor, face, and body weight', () => {
    expect(THEME_PRESETS.paper.font).toBe('charter')
    expect(THEME_PRESETS.calm.font).toBe('georgia')
    expect(THEME_PRESETS.focus.font).toBe('newYork')
    expect(THEME_PRESETS.bold.boldText).toBe(true)
    expect(THEME_PRESETS.original.flavor).toBe('system')
    expect(THEME_PRESETS.quiet.flavor).toBe('dark')
  })

  it('migrates the legacy presets onto their successors', () => {
    const legacy: Record<string, ThemePreset> = {
      normal: 'original',
      charcoal: 'quiet',
      redGraphite: 'paper',
      darkGraphite: 'graphite',
      solarizedLight: 'calm',
      solarizedDark: 'dusk',
      dracula: 'midnight',
    }
    for (const [from, to] of Object.entries(legacy)) expect(migrateThemePreset(from)).toBe(to)
    expect(migrateThemePreset('original')).toBe('original')
    expect(migrateThemePreset(42)).toBeNull()
  })

  it('keeps custom colors valid, scheme-specific, and normalized', () => {
    const colors = normalizeThemeColors({ light: { linkColor: '#de4a4f', textColor: 'red' }, dark: { windowBackground: '#1e1e1e' } })
    expect(colors).toEqual({ light: { linkColor: '#DE4A4F' }, dark: { windowBackground: '#1E1E1E' } })
    expect(resolvedThemePalette('original', 'light', colors).linkColor).toBe('#DE4A4F')
    expect(resolvedThemePalette('original', 'dark', colors).windowBackground).toBe('#1E1E1E')
  })
})
