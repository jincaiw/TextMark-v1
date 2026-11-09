import type { AppSettings, DocumentFont, LocaleSetting, ReaderLayout, ToolbarItem } from '../types'
import { normalizeThemeColors } from './theme'
import { READER_LAYOUT_DEFAULTS, READER_LAYOUT_RANGES, UPSTREAM_DOCUMENT_TOKENS } from './designTokens'

export const SETTINGS_KEYS = [
  'textmark.settings.v10',
  'textmark.settings.v9',
  'textmark.settings.v8',
  'textmark.settings.v7',
  'textmark.settings.v6',
  'textmark.settings.v5',
  'textmark.settings.v3',
  'textmark.settings.v2',
  'textmark.settings.v1',
] as const

/** Reading typography bounds. The upstream defaults (1.6 / 40px) stay inside
 * these ranges so an unmodified profile is byte-identical to the reference. */
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.4, step: 0.02 } as const
export const PAGE_PADDING_RANGE = { min: 0, max: 96, step: 4 } as const

/** The line height every profile carried before this build adopted the
 * upstream 1.6. The reading slider is the only thing that writes this field,
 * so a stored 1.52 is the old default rather than a reading choice: a profile
 * that still has it follows the upstream rhythm instead of pinning the old
 * one. Any other stored value is kept exactly as the reader set it. */
const LEGACY_DEFAULT_LINE_HEIGHT = 1.52
const migrateLegacyLineHeight = (value: number) => (value === LEGACY_DEFAULT_LINE_HEIGHT ? UPSTREAM_DOCUMENT_TOKENS.lineHeight : value)
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
// tracking separator and optional document-search item are intentionally omitted.
export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'openActions',
  'space',
  'themesAndSettings',
  'space',
  'inspector',
  'share',
  'edit',
  'search',
]

// Schema v9 toolbar before grouping copy and export in the Share popover.
const V9_DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'documentSearch',
  'openActions',
  'space',
  'themesAndSettings',
  'space',
  'copy',
  'inspector',
  'share',
  'export',
  'edit',
  'search',
]

// Schema v9's shipped default included the optional document-search action.
const V10_PRIOR_DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'documentSearch',
  'openActions',
  'space',
  'themesAndSettings',
  'space',
  'inspector',
  'share',
  'edit',
  'search',
]

// Schema v8 toolbar before adding upstream's default document-search, copy,
// and export actions.
const V8_DEFAULT_TOOLBAR: ToolbarItem[] = [
  'sidebar',
  'navigation',
  'flexibleSpace',
  'openActions',
  'space',
  'themesAndSettings',
  'space',
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

// v0.10.12 default before matching Markdown Preview 0.0.62's separator
// between the appearance and inspector controls.
const V7_DEFAULT_TOOLBAR: ToolbarItem[] = [
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
  schemaVersion: 10,
  locale: 'zh-CN',
  theme: 'system',
  contentWidth: 'normal',
  zoom: 100,
  editorFontSize: 15,
  lineHeight: UPSTREAM_DOCUMENT_TOKENS.lineHeight,
  strictLineBreaks: false,
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
  sharesUsageAnalytics: false,
  openMarkdownLinksInNewWindows: false,
  supportCardDismissed: false,
  textAlignment: 'automatic',
  readerLayout: { ...READER_LAYOUT_DEFAULTS },
  outlineFollowsPointer: false,
  appLinkGeneration: 'initial',
  updateChannel: 'stable',
  autoCheckUpdates: true,
  autoDownloadUpdates: false,
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
  const usesPriorDefault =
    matchesToolbar(V5_DEFAULT_TOOLBAR) ||
    matchesToolbar(LEGACY_COMBINED_DEFAULT_TOOLBAR) ||
    matchesToolbar(V7_DEFAULT_TOOLBAR) ||
    matchesToolbar(V8_DEFAULT_TOOLBAR) ||
    matchesToolbar(V9_DEFAULT_TOOLBAR) ||
    matchesToolbar(V10_PRIOR_DEFAULT_TOOLBAR)
  return {
    schemaVersion: 10,
    locale: valid(stored.locale as LocaleSetting, ['zh-CN', 'en', 'system'], 'zh-CN'),
    theme: valid(stored.theme, ['system', 'light', 'dark'], 'system'),
    contentWidth: valid(stored.contentWidth, ['normal', 'full'], 'normal'),
    zoom: Number.isFinite(stored.zoom) ? Math.min(300, Math.max(50, Number(stored.zoom))) : 100,
    editorFontSize: Number.isFinite(stored.editorFontSize) ? Math.min(24, Math.max(12, Number(stored.editorFontSize))) : 15,
    lineHeight: normalizeLineHeight(stored.lineHeight),
    strictLineBreaks: stored.strictLineBreaks === true,
    pagePaddingHorizontal: normalizePagePadding(stored.pagePaddingHorizontal),
    documentFont: normalizeDocumentFont(stored.documentFont),
    themePreset: valid(stored.themePreset, ['normal', 'quiet', 'paper', 'bold', 'calm', 'focus', 'graphite', 'dusk', 'midnight'], 'normal'),
    themeColors: normalizeThemeColors(stored.themeColors),
    autoSaveIntervalMinutes: normalizeAutoSaveInterval(stored.autoSaveIntervalMinutes),
    openDocumentsInTabs: stored.openDocumentsInTabs === true,
    alwaysOnTop: stored.alwaysOnTop === true,
    toolbar: toolbar.length ? (usesPriorDefault ? DEFAULT_TOOLBAR : toolbar) : DEFAULT_TOOLBAR,
    toolbarDisplay: valid(stored.toolbarDisplay, ['iconOnly', 'iconAndLabel'], 'iconOnly'),
    defaultOpenTarget: typeof stored.defaultOpenTarget === 'string' ? stored.defaultOpenTarget : 'system',
    crashReports: stored.crashReports === true,
    sharesUsageAnalytics: stored.sharesUsageAnalytics === true,
    openMarkdownLinksInNewWindows: stored.openMarkdownLinksInNewWindows === true,
    supportCardDismissed: stored.supportCardDismissed === true,
    textAlignment: valid(stored.textAlignment, ['automatic', 'left', 'center', 'right', 'justified'], 'automatic'),
    readerLayout: normalizeReaderLayout(stored.readerLayout),
    outlineFollowsPointer: stored.outlineFollowsPointer === true,
    appLinkGeneration: typeof stored.appLinkGeneration === 'string' && stored.appLinkGeneration ? stored.appLinkGeneration : 'initial',
    updateChannel: valid(stored.updateChannel, ['stable', 'beta'], 'stable'),
    autoCheckUpdates: stored.autoCheckUpdates !== false,
    autoDownloadUpdates: stored.autoDownloadUpdates === true,
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
  if (minutes === -2 || minutes === -30 || minutes === 0) return minutes
  return Math.min(60, Math.max(1, minutes))
}

/** Reading line height is clamped rather than rejected so a profile written by
 * a future build can never make the document unreadable. */
export function normalizeLineHeight(value: unknown): number {
  if (!Number.isFinite(value)) return UPSTREAM_DOCUMENT_TOKENS.lineHeight
  const parsed = Number(value)
  const clamped = Math.min(LINE_HEIGHT_RANGE.max, Math.max(LINE_HEIGHT_RANGE.min, Math.round(parsed * 100) / 100))
  return migrateLegacyLineHeight(clamped)
}

export function normalizePagePadding(value: unknown): number {
  if (!Number.isFinite(value)) return UPSTREAM_DOCUMENT_TOKENS.pagePaddingHorizontal
  const parsed = Math.round(Number(value))
  return Math.min(PAGE_PADDING_RANGE.max, Math.max(PAGE_PADDING_RANGE.min, parsed))
}

const DOCUMENT_FONTS = [
  'system',
  'athelas',
  'avenirNext',
  'charter',
  'georgia',
  'iowan',
  'newYork',
  'palatino',
  'rounded',
  'seravek',
  'timesNewRoman',
  'monospace',
] as const

/** The pre-list "serif" option used the New York stack; a stored value from
 * that era maps onto its named successor, as upstream does. */
export function normalizeDocumentFont(value: unknown): DocumentFont {
  if (value === 'serif') return 'newYork'
  return valid(value, DOCUMENT_FONTS, 'system')
}

/** Reader layout numbers clamp instead of rejecting so a profile written by a
 * future build can never make the reading face unusable. */
export function normalizeReaderLayout(value: unknown): ReaderLayout {
  const stored = typeof value === 'object' && value ? (value as Partial<ReaderLayout>) : {}
  const clamp = (raw: unknown, fallback: number, range: { min: number; max: number }) => {
    if (!Number.isFinite(raw)) return fallback
    const parsed = Number(raw)
    return Math.round(Math.min(range.max, Math.max(range.min, parsed)) * 100) / 100
  }
  return {
    boldText: stored.boldText === true,
    isCustomized: stored.isCustomized === true,
    // A customized profile is the reader's own choice and is kept verbatim;
    // an un-customized one only ever held the old default, so it migrates.
    lineSpacing:
      stored.isCustomized === true
        ? clamp(stored.lineSpacing, READER_LAYOUT_DEFAULTS.lineSpacing, READER_LAYOUT_RANGES.lineSpacing)
        : migrateLegacyLineHeight(clamp(stored.lineSpacing, READER_LAYOUT_DEFAULTS.lineSpacing, READER_LAYOUT_RANGES.lineSpacing)),
    characterSpacingPercent: clamp(stored.characterSpacingPercent, 0, READER_LAYOUT_RANGES.characterSpacingPercent),
    wordSpacingPercent: clamp(stored.wordSpacingPercent, 0, READER_LAYOUT_RANGES.wordSpacingPercent),
    marginsPercent: clamp(stored.marginsPercent, 0, READER_LAYOUT_RANGES.marginsPercent),
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
