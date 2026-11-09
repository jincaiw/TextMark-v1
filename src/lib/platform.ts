import { invoke } from '@tauri-apps/api/core'
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  primaryMonitor,
  PhysicalPosition,
  PhysicalSize,
  type Monitor,
} from '@tauri-apps/api/window'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { AppError, AppSettings, ExternalApplication, FileNode, OpenPathRequest, StartupRequest, TextDocument } from '../types'

export interface SavedPastedImage {
  relativePath: string
}

export interface RenamedPastedImage {
  relativePath: string
  document: TextDocument
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export const isTauri = () => Boolean(window.__TAURI_INTERNALS__)

export const isMacos = () => typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent)

export type Platform = 'windows' | 'linux' | 'macos'

/** Resolves the host OS once; drives the CSS `[data-platform]` adapter. */
export function detectPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase()
  if (agent.includes('windows')) return 'windows'
  if (agent.includes('linux')) return 'linux'
  return 'macos'
}

/** Resolves the runtime; drives the CSS `[data-runtime]` adapter. */
export function detectRuntime(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser'
}

/**
 * WebView2 can create the secondary Settings WebView before its app asset is
 * ready on some Windows installations. Keep Settings in the already-loaded
 * document WebView there, which also means native menu commands never depend
 * on creating another window. macOS and Linux retain the dedicated window.
 */
export function shouldUseDedicatedSettingsWindow(
  platform: Platform = detectPlatform(),
  native = isTauri(),
  webdriver = Boolean(import.meta.env.VITE_WDIO),
): boolean {
  return native && platform !== 'windows' && !webdriver
}

export async function tempExportPath(extension: string): Promise<string> {
  if (!isTauri()) return ''
  return invoke<string>('temp_export_path', { extension })
}

export function errorCode(error: unknown): AppError['code'] | null {
  if (typeof error === 'object' && error && 'code' in error) return (error as AppError).code
  try {
    const parsed = JSON.parse(String(error)) as Partial<AppError>
    return parsed.code ?? null
  } catch {
    return null
  }
}

export function parentDirectory(path: string | null): string | null {
  if (!path) return null
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : null
}

export function resolveSiblingPath(baseDirectory: string, relativePath: string): string {
  const separator = baseDirectory.includes('\\') ? '\\' : '/'
  const normalizedRelative = relativePath.split(/[?#]/)[0].replace(/\//g, separator)
  const prefix = baseDirectory.endsWith(separator) ? baseDirectory : `${baseDirectory}${separator}`
  const parts = `${prefix}${normalizedRelative}`.split(/[\\/]+/)
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part && part !== '.') resolved.push(part)
  }
  const drive = /^[A-Za-z]:/.test(resolved[0] ?? '') ? '' : separator
  return `${drive}${resolved.join(separator)}`
}

export async function readDocument(path: string): Promise<TextDocument> {
  return invoke<TextDocument>('read_text_file', { path })
}

export async function readStartupRequest(): Promise<StartupRequest> {
  if (!isTauri()) return { paths: [], newWindow: false }
  return invoke<StartupRequest>('startup_request')
}

export async function resolveOpenPath(path: string): Promise<OpenPathRequest> {
  return invoke<OpenPathRequest>('resolve_open_path', { path })
}

export async function writeDocument(path: string, contents: string, expectedRevision?: string, force = false): Promise<TextDocument> {
  return invoke<TextDocument>('write_text_file', { path, contents, expectedRevision, force })
}

export async function savePastedImage(documentPath: string, bytes: Uint8Array): Promise<SavedPastedImage> {
  return invoke<SavedPastedImage>('save_pasted_image', { documentPath, bytes: Array.from(bytes) })
}

export async function renamePastedImage(
  documentPath: string,
  relativePath: string,
  name: string,
  contents: string,
  expectedRevision?: string,
): Promise<RenamedPastedImage> {
  return invoke<RenamedPastedImage>('rename_pasted_image', { documentPath, relativePath, name, contents, expectedRevision })
}

export async function scanFolder(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('list_directory', { path })
}

/** The upstream navigator's createItem: an empty "Untitled.md", or a
 * "New Folder", under a unique name in `directory`. */
export async function createDirectoryEntry(directory: string, isDirectory: boolean, contents?: string): Promise<FileNode> {
  return invoke<FileNode>('create_directory_entry', { directory, isDirectory, contents: contents ?? null })
}

/** Lets the reader pick files anywhere on disk and copies them into the
 * navigator's folder (upstream "Add Files to…"). Returns the imported rows;
 * empty outside Tauri or when the picker is cancelled. */
export async function pickAndImportFiles(directory: string): Promise<FileNode[]> {
  if (!isTauri()) return []
  const selected = await open({ multiple: true })
  if (!selected) return []
  const paths = Array.isArray(selected) ? selected : [selected]
  if (!paths.length) return []
  return invoke<FileNode[]>('import_files', { directory, paths })
}

/** Renames a navigator entry in place; a file without an extension keeps
 * `.md` (the upstream renamedURL rule). */
export async function renameDirectoryEntry(path: string, newName: string): Promise<FileNode> {
  return invoke<FileNode>('rename_directory_entry', { path, newName })
}

export async function loadLocalAsset(baseDir: string, relativePath: string, workspaceRoot?: string | null): Promise<string> {
  return invoke<string>('read_local_asset', { baseDir, relativePath, workspaceRoot: workspaceRoot ?? null })
}

export async function refreshMenu(state: {
  locale: string
  appearance: string
  contentWidth: string
  sidebarMode: string
  sidebarVisible: boolean
  toolbarVisible: boolean
  alwaysOnTop: boolean
  /** True when View ▸ Hide Tab Bar has hidden the document tab strip. */
  tabsHidden?: boolean
  sessionCount: number
  /** True while the document is being edited rather than previewed. */
  editable: boolean
  /** True when the document differs from what is on disk. */
  dirty: boolean
}): Promise<void> {
  if (!isTauri()) return
  await invoke('refresh_menu', {
    request: {
      locale: state.locale,
      appearance: state.appearance,
      contentWidth: state.contentWidth,
      sidebarMode: state.sidebarMode,
      sidebarVisible: state.sidebarVisible,
      toolbarVisible: state.toolbarVisible,
      alwaysOnTop: state.alwaysOnTop,
      tabsHidden: state.tabsHidden ?? false,
      sessionCount: state.sessionCount,
      editable: state.editable,
      dirty: state.dirty,
    },
  })
}

export async function recordRecentFile(path: string): Promise<void> {
  if (!isTauri()) return
  await invoke('record_recent_file', { path })
}

export async function clearRecentFiles(): Promise<void> {
  if (!isTauri()) return
  await invoke('clear_recent_files')
}

export async function listRecentFiles(): Promise<string[]> {
  if (!isTauri()) return []
  try {
    return await invoke<string[]>('list_recent_files')
  } catch (error) {
    console.error('list_recent_files failed', error)
    return []
  }
}

export async function writeExportBytes(path: string, bytes: Uint8Array): Promise<void> {
  await invoke('save_export_bytes', { path, bytes: Array.from(bytes) })
}

export async function saveExportFile(defaultName: string, bytes: Uint8Array, filterName: string, extensions: string[]): Promise<boolean> {
  if (!isTauri()) return false
  const selected = await save({ defaultPath: defaultName, filters: [{ name: filterName, extensions }] })
  if (typeof selected !== 'string') return false
  await writeExportBytes(selected, bytes)
  return true
}

export async function discoverApplications(): Promise<ExternalApplication[]> {
  if (!isTauri())
    return [
      { id: 'system', name: 'System Default', kind: 'system', available: true, macApp: null },
      { id: 'codex', name: 'Codex', kind: 'llm', available: true, macApp: null },
      { id: 'claude', name: 'Claude', kind: 'llm', available: true, macApp: null },
      { id: 'chatgpt', name: 'ChatGPT', kind: 'llm', available: true, macApp: null },
    ]
  return invoke<ExternalApplication[]>('discover_applications')
}

export async function shareSourceNatively(source: string, path?: string | null): Promise<void> {
  if (!isTauri()) throw new Error('Native sharing is unavailable')
  await invoke('share_source', { source, path: path ?? null })
}

/** Plain-text clipboard contents for Edit ▸ Paste and Match Style. Returns
 * null outside Tauri or when the pasteboard holds no text. */
export async function readClipboardText(): Promise<string | null> {
  if (!isTauri()) return null
  return invoke<string | null>('read_clipboard_text')
}

/** The Finder icon for a path as a PNG data URL, `size` points across (16 by
 * default). Empty string outside Tauri, for missing paths, or when rendering
 * fails — callers fall back to their generic glyph. */
export async function fileIconDataUrl(path: string, size = 16): Promise<string> {
  if (!isTauri()) return ''
  return invoke<string>('file_icon_data_url', { path, size })
}

/** One SF Symbol to rasterise, sized the way AppKit sizes a toolbar symbol:
 * a point size plus an NSFont.Weight (0 regular, 0.23 semibold). */
export interface SfSymbolSpec {
  name: string
  points: number
  weight: number
}

/** A rasterised symbol: its PNG data URL and the point size AppKit drew it at,
 * so the mask box never rescales the glyph. */
export interface SfSymbolImage {
  url: string
  width: number
  height: number
}

/** Rasterises SF Symbols through AppKit. The reference's titlebar glyphs are
 * system symbols, so the system draws them here too rather than approximating
 * their outlines. Empty entries outside macOS or Tauri, where the hand-drawn
 * fallbacks stay in place. */
export async function sfSymbolImages(specs: SfSymbolSpec[]): Promise<SfSymbolImage[]> {
  if (specs.length === 0) return []
  if (!isTauri() || !isMacos()) return specs.map(() => ({ url: '', width: 0, height: 0 }))
  return invoke<SfSymbolImage[]>('sf_symbol_data_urls', { requests: specs })
}

export async function loadNativeSettings(): Promise<unknown | null> {
  if (!isTauri()) return null
  return invoke<unknown | null>('load_settings')
}

export interface SessionWindowGeometry {
  x: number
  y: number
  width: number
  height: number
  monitor?: {
    name: string | null
    position: { x: number; y: number }
    workArea: { x: number; y: number; width: number; height: number }
    scaleFactor: number
  } | null
}

export interface SessionWindowSnapshot {
  windowId: string
  documents: string[]
  activeIndex: number
  workspacePath: string | null
  geometry?: SessionWindowGeometry | null
}

export interface SessionManifest {
  version: 1
  updatedAt: number
  windows: SessionWindowSnapshot[]
}

export async function loadSessionManifest(): Promise<SessionManifest | null> {
  if (!isTauri()) return null
  return invoke<SessionManifest | null>('load_session_manifest')
}

export async function saveSessionSnapshot(snapshot: SessionWindowSnapshot): Promise<void> {
  if (!isTauri()) return
  await invoke('save_session_snapshot', { snapshot })
}

export async function drainPendingOpenPaths(): Promise<OpenPathRequest[]> {
  if (!isTauri()) return []
  return invoke<OpenPathRequest[]>('drain_pending_open_paths')
}

export async function currentWindowId(): Promise<string> {
  if (!isTauri()) return 'browser'
  return getCurrentWindow().label
}

function monitorSnapshot(monitor: Monitor | null): NonNullable<SessionWindowGeometry['monitor']> | null {
  if (!monitor) return null
  return {
    name: monitor.name,
    position: { x: monitor.position.x, y: monitor.position.y },
    workArea: {
      x: monitor.workArea.position.x,
      y: monitor.workArea.position.y,
      width: monitor.workArea.size.width,
      height: monitor.workArea.size.height,
    },
    scaleFactor: monitor.scaleFactor,
  }
}

function monitorMatchesSnapshot(monitor: Monitor, snapshot: NonNullable<SessionWindowGeometry['monitor']>): boolean {
  const samePosition = monitor.position.x === snapshot.position.x && monitor.position.y === snapshot.position.y
  const sameName = snapshot.name !== null && monitor.name === snapshot.name
  return samePosition && (sameName || monitor.workArea.position.x === snapshot.workArea.x)
}

export function clampSessionGeometry(
  geometry: SessionWindowGeometry,
  workArea: { x: number; y: number; width: number; height: number },
): SessionWindowGeometry {
  const width = Math.min(Math.max(geometry.width, 640), workArea.width)
  const height = Math.min(Math.max(geometry.height, 480), workArea.height)
  const x = Math.min(Math.max(geometry.x, workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(Math.max(geometry.y, workArea.y), workArea.y + workArea.height - height)
  return { ...geometry, x, y, width, height }
}

export async function currentWindowGeometry(): Promise<SessionWindowGeometry | null> {
  if (!isTauri()) return null
  const window = getCurrentWindow()
  try {
    const [position, size, monitor] = await Promise.all([window.outerPosition(), window.innerSize(), currentMonitor()])
    return { x: position.x, y: position.y, width: size.width, height: size.height, monitor: monitorSnapshot(monitor) }
  } catch {
    // A just-created secondary window can briefly reject geometry queries while
    // its native surface is attaching. Session persistence must not be lost
    // merely because geometry is temporarily unavailable.
    return null
  }
}

export async function restoreWindowGeometry(geometry: SessionWindowGeometry | null | undefined): Promise<void> {
  if (!isTauri() || !geometry) return
  const window = getCurrentWindow()
  const monitors = await availableMonitors()
  const savedMonitor = geometry.monitor
  const target = savedMonitor
    ? (monitors.find((monitor) => monitorMatchesSnapshot(monitor, savedMonitor)) ?? (await primaryMonitor()))
    : null
  const fallback = target ?? (await currentMonitor())
  if (!fallback) return
  const workArea = {
    x: fallback.workArea.position.x,
    y: fallback.workArea.position.y,
    width: fallback.workArea.size.width,
    height: fallback.workArea.size.height,
  }
  const safeGeometry = clampSessionGeometry(geometry, workArea)
  await window.setSize(new PhysicalSize(safeGeometry.width, safeGeometry.height))
  await window.setPosition(new PhysicalPosition(safeGeometry.x, safeGeometry.y))
}

export async function openSessionWindow(snapshot: SessionWindowSnapshot): Promise<void> {
  if (!isTauri()) return
  await invoke('open_session_window', { snapshot })
}

export async function removeSessionWindow(windowId: string): Promise<void> {
  if (!isTauri()) return
  await invoke('remove_session_window', { windowId })
}

export async function removeCurrentWindowSession(): Promise<void> {
  if (!isTauri()) return
  await invoke('remove_current_window_session')
}

export async function saveNativeSettings(settings: AppSettings): Promise<void> {
  if (!isTauri()) return
  await invoke('save_settings', { settings })
}

export async function watchPaths(paths: string[]): Promise<void> {
  if (!isTauri()) return
  await invoke('watch_paths', { paths })
}

export async function openInApplication(path: string, applicationId: string): Promise<void> {
  if (!isTauri()) return
  await invoke('open_external_application', { path, applicationId })
}

export async function revealInFileManager(path: string): Promise<void> {
  if (!isTauri()) return
  await invoke('show_in_file_manager', { path })
}

export async function openDocumentWindow(path: string): Promise<void> {
  if (!isTauri()) return
  await invoke('open_document_window', { path })
}

export async function openSettingsWindow(): Promise<void> {
  if (!isTauri()) return
  await invoke('open_settings_window')
}

export async function printCurrentWindow(): Promise<void> {
  if (!isTauri()) return
  await invoke('print_current_window')
}

export async function installCli(): Promise<{ ok: boolean; detail: string | null }> {
  if (!isTauri()) return { ok: false, detail: null }
  return invoke<{ ok: boolean; detail: string | null }>('install_cli')
}

// Custom app-link approvals, mirroring the upstream ExternalLinkPolicy: http,
// https and mailto are always open, dangerous schemes are always blocked, and
// every other scheme asks once per document surface until approved per scheme.
// The approval key carries a generation so Reset App Link Approvals can rotate
// the namespace — an old approval can never be silently restored.

const LINK_SCHEME_GENERATION_KEY = 'textmark.linkSchemeGeneration'

const BLOCKED_LINK_SCHEMES = new Set(['javascript', 'vbscript', 'data', 'file', 'about', 'blob', 'filesystem'])
const OPEN_LINK_SCHEMES = new Set(['http', 'https', 'mailto'])

const readGeneration = (storage: Pick<Storage, 'getItem'> = localStorage) => {
  try {
    return storage.getItem(LINK_SCHEME_GENERATION_KEY) ?? 'initial'
  } catch {
    return 'initial'
  }
}

export type LinkDecision = 'blocked' | 'open' | 'confirm'

export function linkDecision(url: string, storage: Pick<Storage, 'getItem'> = localStorage): LinkDecision {
  let scheme: string | null = null
  try {
    scheme = new URL(url).protocol.replace(/:$/, '').toLowerCase() || null
  } catch {
    return 'blocked'
  }
  if (!scheme || BLOCKED_LINK_SCHEMES.has(scheme)) return 'blocked'
  if (OPEN_LINK_SCHEMES.has(scheme)) return 'open'
  try {
    return storage.getItem(`${LINK_SCHEME_GENERATION_KEY}.${readGeneration(storage)}.${scheme}`) === 'true' ? 'open' : 'confirm'
  } catch {
    return 'confirm'
  }
}

export function rememberLinkScheme(url: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  let scheme = ''
  try {
    scheme = new URL(url).protocol.replace(/:$/, '').toLowerCase()
  } catch {
    return
  }
  if (!scheme) return
  try {
    storage.setItem(`${LINK_SCHEME_GENERATION_KEY}.${readGeneration(storage)}.${scheme}`, 'true')
  } catch {
    /* quota or private-mode failures leave the decision session-local */
  }
}

export function resetLinkApprovals(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  try {
    // Rotate the namespace rather than clearing keys: a writer holding an old
    // key cannot restore an approval, as upstream notes.
    storage.setItem(LINK_SCHEME_GENERATION_KEY, crypto.randomUUID())
  } catch {
    /* storage unavailable; approvals stay as-is */
  }
}

export async function setDefaultHandler(): Promise<{ ok: boolean; detail: string | null }> {
  if (!isTauri()) return { ok: false, detail: null }
  return invoke<{ ok: boolean; detail: string | null }>('set_default_handler')
}
