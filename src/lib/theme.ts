import type { ThemeColorScheme, ThemeColorSlot, ThemeColors, ThemePreset } from '../types'

export interface ThemePalette {
  windowBackground: string
  editorBackground: string
  codeBlockBackground: string
  textColor: string
  linkColor: string
}

export interface ThemePresetDefinition {
  name: string
  flavor: 'system' | 'light' | 'dark'
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

/** The upstream built-in gallery, in its order — three rows of three: the
 * Apple Books set (Original, Quiet, Paper / Bold, Calm, Focus) first, then
 * the remaining dark themes. Original leads: it is the default theme, and
 * applying it clears overrides instead of pinning a palette. Quiet, Paper,
 * Bold, and Focus are sampled from Apple Books' theme cards; the entries
 * marked "Bear" are sampled from Bear's themes. */
export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  normal: {
    name: 'Original',
    flavor: 'system',
    light: palette('#FFFFFF', '#F5F5F7', '#000000', '#0066CC'),
    dark: palette('#1C1C1C', '#2A2828', '#F5F5F7', '#2997FF'),
  },
  quiet: {
    name: 'Quiet',
    flavor: 'dark',
    light: palette('#4A4A4D', '#59595D', '#EBEBF4', '#99B7C4'),
    dark: palette('#4A4A4D', '#59595D', '#EBEBF4', '#99B7C4'),
  },
  paper: {
    name: 'Paper',
    flavor: 'light',
    light: palette('#EEEDED', '#E3E1E1', '#262626', '#DE4A4F'),
    dark: palette('#EEEDED', '#E3E1E1', '#262626', '#DE4A4F'),
  },
  bold: {
    name: 'Bold',
    flavor: 'light',
    light: palette('#FFFFFF', '#F2F2F2', '#1C1C1E', '#007AFF'),
    dark: palette('#FFFFFF', '#F2F2F2', '#1C1C1E', '#007AFF'),
  },
  calm: {
    name: 'Calm',
    flavor: 'light',
    light: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
    dark: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
  },
  focus: {
    name: 'Focus',
    flavor: 'light',
    light: palette('#FFFCF5', '#F5F1E4', '#14120B', '#A0630F'),
    dark: palette('#FFFCF5', '#F5F1E4', '#14120B', '#A0630F'),
  },
  graphite: {
    name: 'Graphite',
    flavor: 'dark',
    light: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
    dark: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
  },
  dusk: {
    name: 'Dusk',
    flavor: 'dark',
    light: palette('#0C3742', '#103E49', '#C3CFCC', '#299385'),
    dark: palette('#0C3742', '#103E49', '#C3CFCC', '#299385'),
  },
  midnight: {
    name: 'Midnight',
    flavor: 'dark',
    light: palette('#363846', '#313343', '#FFFFFF', '#8BE9FD'),
    dark: palette('#363846', '#313343', '#FFFFFF', '#8BE9FD'),
  },
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

/**
 * Fixed palettes must keep matching native chrome, so a light or dark preset
 * pins the appearance picker; Original (flavor "system") follows the user's
 * choice, mirroring the upstream requiredAppearance semantics.
 */
export function isAppearanceLocked(preset: ThemePreset): boolean {
  return THEME_PRESETS[preset].flavor !== 'system'
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
