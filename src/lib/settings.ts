import type { AppSettings, ToolbarItem } from '../types'

export const SETTINGS_KEYS = ['textmark.settings.v3', 'textmark.settings.v2', 'textmark.settings.v1'] as const
export const TOOLBAR_ITEMS = new Set<ToolbarItem>([
  'navigation',
  'sidebar',
  'openActions',
  'openWith',
  'openInLlm',
  'zoom',
  'inspector',
  'share',
  'edit',
  'search',
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
  schemaVersion: 4,
  locale: 'zh-CN',
  theme: 'system',
  contentWidth: 'normal',
  zoom: 100,
  editorFontSize: 15,
  toolbar: DEFAULT_TOOLBAR,
  toolbarDisplay: 'iconOnly',
  defaultOpenTarget: 'system',
  crashReports: false,
  updateChannel: 'stable',
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
  const toolbar =
    stored.schemaVersion === 4 ? rawToolbar : rawToolbar.map((item) => (item === 'openWith' ? ('openActions' as ToolbarItem) : item))
  return {
    schemaVersion: 4,
    locale: valid(stored.locale, ['zh-CN', 'en'], 'zh-CN'),
    theme: valid(stored.theme, ['system', 'light', 'dark'], 'system'),
    contentWidth: valid(stored.contentWidth, ['normal', 'full'], 'normal'),
    zoom: Number.isFinite(stored.zoom) ? Math.min(300, Math.max(50, Number(stored.zoom))) : 100,
    editorFontSize: Number.isFinite(stored.editorFontSize) ? Math.min(24, Math.max(12, Number(stored.editorFontSize))) : 15,
    toolbar: toolbar.length ? toolbar : DEFAULT_TOOLBAR,
    toolbarDisplay: valid(stored.toolbarDisplay, ['iconOnly', 'iconAndLabel'], 'iconOnly'),
    defaultOpenTarget: typeof stored.defaultOpenTarget === 'string' ? stored.defaultOpenTarget : 'system',
    crashReports: stored.crashReports === true,
    updateChannel: valid(stored.updateChannel, ['stable', 'beta'], 'stable'),
  }
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
