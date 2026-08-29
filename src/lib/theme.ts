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

/** The seven current upstream palettes, expressed as platform-neutral CSS tokens. */
export const THEME_PRESETS: Record<ThemePreset, ThemePresetDefinition> = {
  normal: {
    name: 'Normal',
    flavor: 'system',
    light: palette('#FFFFFF', '#F2F2F2', '#000000', '#007AFF'),
    dark: palette('#1E1E1E', '#2A2828', '#F5F5F7', '#0A84FF'),
  },
  charcoal: {
    name: 'Charcoal',
    flavor: 'dark',
    light: palette('#2E3235', '#3F4347', '#A7A7A6', '#99B7C4'),
    dark: palette('#2E3235', '#3F4347', '#A7A7A6', '#99B7C4'),
  },
  redGraphite: {
    name: 'Red Graphite',
    flavor: 'light',
    light: palette('#FFFFFF', '#F3F5F7', '#434343', '#DE4A4F'),
    dark: palette('#FFFFFF', '#F3F5F7', '#434343', '#DE4A4F'),
  },
  darkGraphite: {
    name: 'Dark Graphite',
    flavor: 'dark',
    light: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
    dark: palette('#1D1E1F', '#2E2F30', '#E0E1E0', '#42A2E6'),
  },
  solarizedLight: {
    name: 'Solarized Light',
    flavor: 'light',
    light: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
    dark: palette('#FDF6E3', '#F6EDDB', '#313D45', '#A0630F'),
  },
  solarizedDark: {
    name: 'Solarized Dark',
    flavor: 'dark',
    light: palette('#0C3742', '#103E49', '#9BA7A4', '#299385'),
    dark: palette('#0C3742', '#103E49', '#9BA7A4', '#299385'),
  },
  dracula: {
    name: 'Dracula',
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
