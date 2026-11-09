export type ViewMode = 'edit' | 'preview'
export type Locale = 'zh-CN' | 'en'
/** Stored language preference; "system" follows the OS language like the upstream System Default. */
export type LocaleSetting = Locale | 'system'
export type ThemeMode = 'dark' | 'light' | 'system'
export type DocumentFont =
  | 'system'
  | 'athelas'
  | 'avenirNext'
  | 'charter'
  | 'georgia'
  | 'iowan'
  | 'newYork'
  | 'palatino'
  | 'rounded'
  | 'seravek'
  | 'timesNewRoman'
  | 'monospace'
export type ThemePreset = 'normal' | 'quiet' | 'paper' | 'bold' | 'calm' | 'focus' | 'graphite' | 'dusk' | 'midnight'
export type ThemeColorScheme = 'light' | 'dark'
export type ThemeColorSlot = 'windowBackground' | 'editorBackground' | 'codeBlockBackground' | 'textColor' | 'linkColor'
export type ThemeColors = Partial<Record<ThemeColorScheme, Partial<Record<ThemeColorSlot, string>>>>
export type SidebarMode = 'outline' | 'files'
export type InspectorMode = 'document' | 'properties'
export type ContentWidth = 'normal' | 'full'
/** Upstream TextAlignmentSetting: automatic leaves prose at its authored direction. */
export type TextAlignment = 'automatic' | 'left' | 'center' | 'right' | 'justified'

/** Upstream ReaderLayoutSetting. Sliders only apply while customized is on;
 * turning it off restores the tuned defaults without losing slider positions. */
export interface ReaderLayout {
  boldText: boolean
  isCustomized: boolean
  lineSpacing: number
  characterSpacingPercent: number
  wordSpacingPercent: number
  marginsPercent: number
}
export type ToolbarDisplayMode = 'iconOnly' | 'iconAndLabel'
export type SearchMode = 'contains' | 'beginsWith'
export type FormatCommand =
  | 'h0'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'link'
  | 'highlight'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'quote'
  | 'codeBlock'
  | 'horizontalRule'

export interface EditorFormattingState {
  heading: 'h0' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  bold: boolean
  italic: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
  highlight: boolean
  bulletList: boolean
  orderedList: boolean
  taskList: boolean
  quote: boolean
}

export interface TextDocument {
  path: string | null
  name: string
  contents: string
  createdMs?: number | null
  modifiedMs?: number | null
  sizeBytes?: number
  revision?: string
}

export interface OpenPathRequest {
  path: string
  isDirectory: boolean
}

export interface StartupRequest {
  paths: OpenPathRequest[]
  newWindow: boolean
}

export interface DiskChangeEvent {
  kind: 'create' | 'modify' | 'rename' | 'remove' | 'other'
  paths: string[]
}

export type ExternalDocumentChange =
  | { kind: 'modified'; document: TextDocument }
  | { kind: 'renamed'; document: TextDocument; previousPath: string }
  | { kind: 'deleted'; previousPath: string }

export type ExternalChangeResolution = 'reload' | 'overwrite' | 'saveAs' | 'cancel'

export interface AppSettings {
  schemaVersion: 10
  /** Stored language preference; resolved through resolveLocale before display. */
  locale: LocaleSetting
  theme: ThemeMode
  contentWidth: ContentWidth
  zoom: number
  editorFontSize: number
  /** Reading line height for both the preview and the editor. */
  lineHeight: number
  /** Treat Markdown soft line breaks as visible line breaks in reading views. */
  strictLineBreaks: boolean
  /** Horizontal page gutter in px; the reading column keeps its own width. */
  pagePaddingHorizontal: number
  documentFont: DocumentFont
  themePreset: ThemePreset
  themeColors: ThemeColors
  /** 0 disables automatic saving; -30 represents the 30-second option. */
  autoSaveIntervalMinutes: number
  /** Prefer document tabs for ordinary open requests. Explicit tab requests always win. */
  openDocumentsInTabs: boolean
  /** A reading preference shared by every TextMark document window. */
  alwaysOnTop: boolean
  toolbar: ToolbarItem[]
  toolbarDisplay: ToolbarDisplayMode
  defaultOpenTarget: string
  crashReports: boolean
  /** Anonymous daily-usage ping, mirroring the upstream privacy toggle. */
  sharesUsageAnalytics: boolean
  /** Markdown relative links open a separate window instead of the current one. */
  openMarkdownLinksInNewWindows: boolean
  /** The General-page support card stays hidden once the reader dismisses it. */
  supportCardDismissed: boolean
  /** Prose alignment applied to rendered preview blocks; automatic injects no CSS. */
  textAlignment: TextAlignment
  /** Reading face weights and spacing, gated the Apple Books way behind Customize. */
  readerLayout: ReaderLayout
  /** The outline highlights the section under the pointer instead of the scroll position. */
  outlineFollowsPointer: boolean
  /** Namespace for approved custom app-link schemes; rotating it invalidates every approval. */
  appLinkGeneration: string
  updateChannel: 'stable' | 'beta'
  autoCheckUpdates: boolean
  autoDownloadUpdates: boolean
  lastUpdateCheckAt: number | null
}

export interface SourcePosition {
  line: number
  column: number
}

export interface EditorSelectionState {
  anchor: SourcePosition
  head: SourcePosition
}

export interface EditorSessionState {
  selection: EditorSelectionState
  topLine: number | null
  scrollFraction: number
}

export interface DocumentSession extends TextDocument {
  id: string
  savedContents: string
  diskContents: string
  dirty: boolean
  scrollTop: number
  editorState?: EditorSessionState
  history: NavigationEntry[]
  historyIndex: number
}

export interface NavigationEntry {
  path: string | null
  anchor?: string
  scrollTop: number
}

export interface AppError {
  code:
    | 'invalid_document'
    | 'not_found'
    | 'io'
    | 'read_only'
    | 'save_conflict'
    | 'asset_outside_workspace'
    | 'asset_unsupported'
    | 'asset_too_large'
    | 'invalid_path'
  detail?: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children: FileNode[]
}

export interface OutlineItem {
  id: string
  text: string
  level: number
  /** Source line of the heading (1-based). Lets the outline jump to the exact
   * Markdown line when the editor is showing instead of the preview. */
  line: number
}

export interface RenderedMarkdown {
  html: string
  outline: OutlineItem[]
  hasMermaid: boolean
  hasMath: boolean
  frontmatter: FrontmatterEntry[]
  sourceMap: SourceRange[]
  tables: TableSourceMap[]
  tasks: TaskSourceMap[]
  optionalRenderers: Array<'highlight' | 'katex' | 'mermaid'>
  direction: 'auto' | 'ltr' | 'rtl'
}

export type RenderResult = RenderedMarkdown

export interface SourceRange {
  kind: 'heading' | 'paragraph' | 'code' | 'table' | 'task' | 'footnote'
  start: number
  end: number
  line: number
}

export interface TableSourceMap {
  index: number
  startLine: number
  endLine: number
  rows: number
  columns: number
  cells: TableCellSource[]
}

export interface TableCellSource {
  row: number
  column: number
  markdown: string
}

export interface TaskSourceMap {
  index: number
  line: number
  checked: boolean
}

export interface FrontmatterEntry {
  key: string
  value: string
  items?: string[]
}

export interface DocumentStats {
  words: number
  characters: number
  lines: number
  headings: number
  links: number
  images: number
}

export type ToolbarItem =
  | 'navigation'
  | 'sidebar'
  | 'openActions'
  | 'openWith'
  | 'openInLlm'
  | 'zoom'
  | 'themesAndSettings'
  | 'documentActions'
  | 'inspector'
  | 'alwaysOnTop'
  | 'share'
  | 'edit'
  | 'search'
  | 'documentSearch'
  | 'print'
  | 'copy'
  | 'export'
  | 'exportPdf'
  | 'flexibleSpace'
  | 'space'
export type TableEdit =
  | 'setCell'
  | 'addRowBefore'
  | 'addRowAfter'
  | 'duplicateRow'
  | 'deleteRow'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'duplicateColumn'
  | 'deleteColumn'

export interface TableEditRequest {
  edit: TableEdit
  value?: string
}

export interface ExternalApplication {
  id: string
  name: string
  kind: 'editor' | 'llm' | 'system'
  available: boolean
  /** macOS bundle name ("Visual Studio Code.app") used to load the app's
   * real Finder icon; null elsewhere or for the system target. */
  macApp?: string | null
}
