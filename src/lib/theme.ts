import type { ThemeColorScheme, ThemeColorSlot, ThemeColors, ThemePreset } from '../types'

export interface ThemePalette {
  windowBackground: string
  editorBackground: string
  codeBlockBackground: string
  textColor: string
  linkColor: string
}

export type ThemeFlavor = 'system' | 'light' | 'dark'

export interface ThemePresetDefinition {
  name: string
  flavor: ThemeFlavor
  /** The reading face the preset applies; a theme is a whole reading look. */
  font: 'system' | 'charter' | 'georgia' | 'newYork'
  /** Whether the preset reads in a heavier body weight. */
  boldText: boolean
  light: ThemePalette
  dark: ThemePalette
}

const palette = (windowBackground: string, codeBlockBackground: string, textColor: string, linkColor: string): ThemePalette => ({
  windowBackground,
  editorBackground: windowBackground,
  codeBlockBackground,
  textColor,
  linkColor,
})

/** The nine upstream presets (ThemePreset.builtIn), in gallery order — three
 * rows of three: the Apple Books set (Original, Quiet, Paper / Bold, Calm,
 * Focus) first, then the remaining dark themes. Original leads as the default.
 * Quiet/Paper/Bold/Calm/Focus are Apple Books samples; Graphite/Dusk/Midnight
 * sample Bear themes. Fixed-flavor presets pin the app appearance; Original
 * tracks the system. */
export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  original: {
    name: 'Original',
    flavor: 'system',
    font: 'system',
    boldText: false,
    light: palette('#FFFFFF', '#F5F5F7', '#000000', '#0066CC'),
    dark: palette('#1C1C1C', '#2A2828', '#F5F5F7', '#2997FF'),
  },
  quiet: {
    name: 'Quiet',
    flavor: 'dark',
    font: 'system',
    boldText: false,
    light: palette('#4A4A4D', '#59595D', '#EBEBF4', '#99B7C4'),
    dark: palette('#4A4A4D', '#59595D', '#EBEBF4', '#99B7C4'),
  },
  paper: {
    name: 'Paper',
    flavor: 'light',
    font: 'charter',
    boldText: false,
    light: palette('#EEEDED', '#E3E1E1', '#262626', '#DE4A4F'),
    dark: palette('#EEEDED', '#E3E1E1', '#262626', '#DE4A4F'),
  },
  bold: {
    name: 'Bold',
    flavor: 'light',
    font: 'system',
    boldText: true,
    light: palette('#FFFFFF', '#F2F2F2', '#1C1C1E', '#007AFF'),
    dark: palette('#FFFFFF', '#F2F2F2', '#1C1C1E', '#007AFF'),
  },
  calm: {
    name: 'Calm',
    flavor: 'light',
    font: 'georgia',
    boldText: false,
    light: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
    dark: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
  },
  focus: {
    name: 'Focus',
    flavor: 'light',
    font: 'newYork',
    boldText: false,
    light: palette('#FFFCF5', '#F5F1E4', '#14120B', '#A0630F'),
    dark: palette('#FFFCF5', '#F5F1E4', '#14120B', '#A0630F'),
  },
  graphite: {
    name: 'Graphite',
    flavor: 'dark',
    font: 'system',
    boldText: false,
    light: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
    dark: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
  },
  dusk: {
    name: 'Dusk',
    flavor: 'dark',
    font: 'system',
    boldText: false,
    light: palette('#0C3742', '#103E49', '#C3CFCC', '#299385'),
    dark: palette('#0C3742', '#103E49', '#C3CFCC', '#299385'),
  },
  midnight: {
    name: 'Midnight',
    flavor: 'dark',
    font: 'system',
    boldText: false,
    light: palette('#363846', '#313343', '#FFFFFF', '#8BE9FD'),
    dark: palette('#363846', '#313343', '#FFFFFF', '#8BE9FD'),
  },
}

/** Legacy TextMark presets (pre-alignment) mapped onto their successors so a
 * stored profile from an earlier release resolves to the same look. */
const LEGACY_PRESET_MIGRATION: Record<string, ThemePreset> = {
  normal: 'original',
  charcoal: 'quiet',
  redGraphite: 'paper',
  darkGraphite: 'graphite',
  solarizedLight: 'calm',
  solarizedDark: 'dusk',
  dracula: 'midnight',
}

export function migrateThemePreset(value: unknown): ThemePreset | null {
  if (typeof value !== 'string') return null
  if (value in THEME_PRESETS) return value as ThemePreset
  return LEGACY_PRESET_MIGRATION[value] ?? null
}

export const THEME_COLOR_SLOTS: ThemeColorSlot[] = ['windowBackground', 'editorBackground', 'codeBlockBackground', 'textColor', 'linkColor']
export const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function normalizeThemeColors(value: unknown): ThemeColors {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const result: ThemeColors = {}
  for (const scheme of ['light', 'dark'] as const) {
    const candidate = raw[scheme]
    if (!candidate || typeof candidate !== 'object') continue
    const colors: Partial<Record<ThemeColorSlot, string>> = {}
    for (const slot of THEME_COLOR_SLOTS) {
      const color = (candidate as Record<string, unknown>)[slot]
      if (typeof color === 'string' && HEX_COLOR.test(color)) colors[slot] = color.toUpperCase()
    }
    if (Object.keys(colors).length) result[scheme] = colors
  }
  return result
}

export function resolvedThemePalette(preset: ThemePreset, scheme: ThemeColorScheme, overrides: ThemeColors = {}): ThemePalette {
  return { ...THEME_PRESETS[preset][scheme], ...overrides[scheme] }
}

export function applyThemeColors(root: HTMLElement, preset: ThemePreset, scheme: ThemeColorScheme, overrides: ThemeColors = {}) {
  const colors = resolvedThemePalette(preset, scheme, overrides)
  root.style.setProperty('--window', colors.windowBackground)
  root.style.setProperty('--chrome', colors.windowBackground)
  root.style.setProperty('--sidebar', colors.windowBackground)
  root.style.setProperty('--surface', colors.editorBackground)
  root.style.setProperty('--text', colors.textColor)
  root.style.setProperty('--document-text', colors.textColor)
  root.style.setProperty('--document-secondary', `color-mix(in srgb, ${colors.textColor} 64%, ${colors.windowBackground})`)
  root.style.setProperty('--accent', colors.linkColor)
  root.style.setProperty('--document-link', colors.linkColor)
  root.style.setProperty('--document-fill', colors.codeBlockBackground)
  root.style.setProperty('--document-grid', `color-mix(in srgb, ${colors.textColor} 20%, ${colors.windowBackground})`)
}
