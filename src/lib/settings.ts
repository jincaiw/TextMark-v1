import type { AppSettings, ToolbarItem } from '../types'
import { normalizeThemeColors } from './theme'
import { UPSTREAM_DOCUMENT_TOKENS } from './designTokens'

export const SETTINGS_KEYS = [
  'textmark.settings.v7',
  'textmark.settings.v6',
  'textmark.settings.v5',
  'textmark.settings.v3',
  'textmark.settings.v2',
  'textmark.settings.v1',
] as const

/** Reading typography bounds. The upstream defaults (1.52 / 40px) stay inside
 * these ranges so an unmodified profile is byte-identical to the reference. */
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.4, step: 0.02 } as const
export const PAGE_PADDING_RANGE = { min: 0, max: 96, step: 4 } as const
export const TOOLBAR_ITEMS = new Set<ToolbarItem>([
  'navigation',
  'sidebar',
  'openActions',
  'openWith',
  'openInLlm',
  'zoom',
  'themesAndSettings',
  'documentActions',
  'inspector',
  'alwaysOnTop',
  'share',
  'edit',
  'search',
  'documentSearch',
  'print',
  'copy',
  'export',
  'exportPdf',
  'flexibleSpace',
  'space',
])

// Upstream (markdown-preview) default toolbar order. The AppKit-only sidebar
// tracking separator is intentionally omitted (native macOS affordance).
export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'openActions',
  'space',
  'themesAndSettings',
  'inspector',
  'share',
  'edit',
  'search',
]

const LEGACY_COMBINED_DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'openActions',
  'space',
  'themesAndSettings',
  'documentActions',
  'search',
]

const V5_DEFAULT_TOOLBAR: ToolbarItem[] = [
  'flexibleSpace',
  'sidebar',
  'navigation',
  'flexibleSpace',
  'openActions',
  'space',
  'zoom',
  'inspector',
  'share',
  'edit',
  'search',
]

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 7,
  locale: 'zh-CN',
  theme: 'system',
  contentWidth: 'normal',
  zoom: 100,
  editorFontSize: 15,
  lineHeight: UPSTREAM_DOCUMENT_TOKENS.lineHeight,
  pagePaddingHorizontal: UPSTREAM_DOCUMENT_TOKENS.pagePaddingHorizontal,
  documentFont: 'system',
  themePreset: 'normal',
  themeColors: {},
  autoSaveIntervalMinutes: 0,
  openDocumentsInTabs: false,
  alwaysOnTop: false,
  toolbar: DEFAULT_TOOLBAR,
  toolbarDisplay: 'iconOnly',
  defaultOpenTarget: 'system',
  crashReports: false,
  updateChannel: 'stable',
  autoCheckUpdates: true,
  lastUpdateCheckAt: null,
}

const valid = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback

export function normalizeSettings(value: unknown): AppSettings {
  const stored = typeof value === 'object' && value ? (value as Partial<AppSettings>) : {}
  const rawToolbar = Array.isArray(stored.toolbar)
    ? stored.toolbar.filter((item): item is ToolbarItem => typeof item === 'string' && TOOLBAR_ITEMS.has(item as ToolbarItem))
    : DEFAULT_TOOLBAR
  // Prior to v4, "openWith" meant the combined Open With + Open in LLM menu; it
  // is now the dedicated "openActions" item. Preserve existing user layouts.
  const storedSchemaVersion = (stored as { schemaVersion?: number }).schemaVersion
  const toolbar =
    typeof storedSchemaVersion === 'number' && storedSchemaVersion >= 4
      ? rawToolbar
      : rawToolbar.map((item) => (item === 'openWith' ? ('openActions' as ToolbarItem) : item))
  const matchesToolbar = (expected: ToolbarItem[]) =>
    rawToolbar.length === expected.length && rawToolbar.every((item, index) => item === expected[index])
  const usesPriorDefault = matchesToolbar(V5_DEFAULT_TOOLBAR) || matchesToolbar(LEGACY_COMBINED_DEFAULT_TOOLBAR)
  return {
    schemaVersion: 7,
    locale: valid(stored.locale, ['zh-CN', 'en'], 'zh-CN'),
    theme: valid(stored.theme, ['system', 'light', 'dark'], 'system'),
    contentWidth: valid(stored.contentWidth, ['normal', 'full'], 'normal'),
    zoom: Number.isFinite(stored.zoom) ? Math.min(300, Math.max(50, Number(stored.zoom))) : 100,
    editorFontSize: Number.isFinite(stored.editorFontSize) ? Math.min(24, Math.max(12, Number(stored.editorFontSize))) : 15,
    lineHeight: normalizeLineHeight(stored.lineHeight),
    pagePaddingHorizontal: normalizePagePadding(stored.pagePaddingHorizontal),
    documentFont: valid(stored.documentFont, ['system', 'serif', 'rounded', 'monospace'], 'system'),
    themePreset: valid(
      stored.themePreset,
      ['normal', 'charcoal', 'redGraphite', 'darkGraphite', 'solarizedLight', 'solarizedDark', 'dracula'],
      'normal',
    ),
    themeColors: normalizeThemeColors(stored.themeColors),
    autoSaveIntervalMinutes: normalizeAutoSaveInterval(stored.autoSaveIntervalMinutes),
    openDocumentsInTabs: stored.openDocumentsInTabs === true,
    alwaysOnTop: stored.alwaysOnTop === true,
    toolbar: toolbar.length ? (usesPriorDefault ? DEFAULT_TOOLBAR : toolbar) : DEFAULT_TOOLBAR,
    toolbarDisplay: valid(stored.toolbarDisplay, ['iconOnly', 'iconAndLabel'], 'iconOnly'),
    defaultOpenTarget: typeof stored.defaultOpenTarget === 'string' ? stored.defaultOpenTarget : 'system',
    crashReports: stored.crashReports === true,
    updateChannel: valid(stored.updateChannel, ['stable', 'beta'], 'stable'),
    autoCheckUpdates: stored.autoCheckUpdates !== false,
    lastUpdateCheckAt: Number.isFinite(stored.lastUpdateCheckAt) ? Number(stored.lastUpdateCheckAt) : null,
  }
}

/**
 * Mirrors the upstream preference while keeping a compact, serializable value:
 * 0 is off, -30 is thirty seconds, and positive values are whole minutes.
 */
export function normalizeAutoSaveInterval(value: unknown): number {
  if (!Number.isFinite(value)) return 0
  const minutes = Math.trunc(Number(value))
  if (minutes === -30 || minutes === 0) return minutes
  return Math.min(60, Math.max(1, minutes))
}

/** Reading line height is clamped rather than rejected so a profile written by
 * a future build can never make the document unreadable. */
export function normalizeLineHeight(value: unknown): number {
  if (!Number.isFinite(value)) return UPSTREAM_DOCUMENT_TOKENS.lineHeight
  const parsed = Number(value)
  return Math.min(LINE_HEIGHT_RANGE.max, Math.max(LINE_HEIGHT_RANGE.min, Math.round(parsed * 100) / 100))
}

export function normalizePagePadding(value: unknown): number {
  if (!Number.isFinite(value)) return UPSTREAM_DOCUMENT_TOKENS.pagePaddingHorizontal
  const parsed = Math.round(Number(value))
  return Math.min(PAGE_PADDING_RANGE.max, Math.max(PAGE_PADDING_RANGE.min, parsed))
}

export function readSettings(storage: Pick<Storage, 'getItem'> = localStorage): AppSettings {
  for (const key of SETTINGS_KEYS) {
    const raw = storage.getItem(key)
    if (!raw) continue
    try {
      return normalizeSettings(JSON.parse(raw))
    } catch {
      return DEFAULT_SETTINGS
    }
  }
  return DEFAULT_SETTINGS
}
