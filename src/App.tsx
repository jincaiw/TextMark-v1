import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { openPath as openExternalPath, openUrl } from '@tauri-apps/plugin-opener'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './App.css'
import type { EditorPaneHandle } from './components/EditorPane'
import { ConflictDialog } from './components/ConflictDialog'
import { DraftRecoveryDialog } from './components/DraftRecoveryDialog'
import { DocumentTabs } from './components/DocumentTabs'
import { ExportDialog } from './components/ExportDialog'
import { FindBar } from './components/FindBar'
import { DocumentTools } from './components/DocumentTools'
import { FormattingToolbar } from './components/FormattingToolbar'
import { Inspector } from './components/Inspector'
import { PreviewPane } from './components/PreviewPane'
import { PanelResizer } from './components/PanelResizer'
import { SettingsDialog } from './components/SettingsDialog'
import { UnsavedCloseDialog } from './components/UnsavedCloseDialog'
import { SettingsWindow } from './components/SettingsWindow'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { ToolbarCustomizer } from './components/ToolbarCustomizer'
import { useDocument } from './hooks/useDocument'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { useUpdater } from './hooks/useUpdater'
import { useMarkdownRenderer } from './hooks/useMarkdownRenderer'
import { useTextmarkDeepLinks } from './hooks/useTextmarkDeepLinks'
import { clampScrollFraction } from './lib/scrollFraction'
import { anchorForOffset, caretForReturnToEditor, lineForAnchor, offsetForLine, type EditorExitCaret } from './lib/readingPosition'
import { createPreviewHydrationGate, type PreviewHydrationGate } from './lib/previewHydration'
import { resolveAlwaysOnTopTransition } from './lib/alwaysOnTop'
import { t } from './lib/i18n'
import { externalMenuUrl } from './lib/menuCommands'
import {
  clearRecentFiles,
  detectPlatform,
  detectRuntime,
  discoverApplications,
  isMacos,
  isTauri,
  installCli,
  openDocumentWindow,
  openSettingsWindow,
  printCurrentWindow,
  openInApplication,
  readDocument,
  recordRecentFile,
  revealInFileManager,
  refreshMenu,
  saveExportFile,
  setDefaultHandler,
  shareSourceNatively,
  shouldUseDedicatedSettingsWindow,
  tempExportPath,
  writeExportBytes,
} from './lib/platform'
import { partitionDroppedPaths } from './lib/documentPresentation'
import { editMarkdownTable } from './lib/table'
import { setTaskChecked } from './lib/task'
import { configureCrashReporting, crashReportingAvailable } from './lib/telemetry'
import { applyUpstreamDocumentTokens } from './lib/designTokens'
import { applyThemeColors, THEME_PRESETS } from './lib/theme'
import { shareMarkdownSource } from './lib/share'
import { pdfCapability } from './lib/pdfCapability'
import type { EditorSessionState, ExternalApplication, FormatCommand, InspectorMode, SearchMode, SidebarMode, ViewMode } from './types'

const EditorPane = lazy(() => import('./components/EditorPane').then((module) => ({ default: module.EditorPane })))
import { nextZoomStep as nextZoom } from './constants'
function DocumentApp() {
  const {
    settings,
    setLocale,
    setTheme,
    setContentWidth,
    setZoom,
    setEditorFontSize,
    setLineHeight,
    setPagePaddingHorizontal,
    setDocumentFont,
    patch,
  } = useSettings()
  const documents = useDocument(settings.locale, {
    autoSaveIntervalMinutes: settings.autoSaveIntervalMinutes,
    openDocumentsInTabs: settings.openDocumentsInTabs,
  })
  const updater = useUpdater(settings.updateChannel, settings.autoCheckUpdates, (lastUpdateCheckAt) => patch({ lastUpdateCheckAt }))
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [sidebarVisible, setSidebarVisible] = useState(() => localStorage.getItem('textmark.sidebarVisible') !== 'false')
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    () => (localStorage.getItem('textmark.sidebarMode') as SidebarMode) || 'outline',
  )
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Math.min(400, Math.max(230, Number(localStorage.getItem('textmark.sidebarWidth')) || 240)),
  )
  // Inspector 默认关闭，因此只有显式存过 'true' 才恢复——与 sidebarVisible 的「默认开」相反。
  const [inspectorVisible, setInspectorVisible] = useState(() => localStorage.getItem('textmark.inspectorVisible') === 'true')
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(
    () => (localStorage.getItem('textmark.inspectorMode') as InspectorMode) || 'document',
  )
  const [inspectorWidth, setInspectorWidth] = useState(() =>
    Math.min(500, Math.max(270, Number(localStorage.getItem('textmark.inspectorWidth')) || 270)),
  )
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [pendingFormat, setPendingFormat] = useState<FormatCommand | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPane, setSettingsPane] = useState<'general' | 'appearance' | 'privacy' | 'about'>('general')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const alwaysOnTop = settings.alwaysOnTop
  // Ref keeps the keydown/menu closures reading the live value without adding
  // alwaysOnTop to every effect dependency list.
  const alwaysOnTopRef = useRef(alwaysOnTop)
  const alwaysOnTopSuspendedRef = useRef(false)
  const nativeAlwaysOnTopRef = useRef<boolean | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [defaultHandlerPrompt, setDefaultHandlerPrompt] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [pendingScrollFraction, setPendingScrollFraction] = useState<number | null>(null)
  const [pendingEditorLine, setPendingEditorLine] = useState<number | null>(null)
  const [pendingEditorCursor, setPendingEditorCursor] = useState<{ line: number; column: number } | null>(null)
  const [pendingEditorSelection, setPendingEditorSelection] = useState<EditorSessionState['selection'] | null>(null)
  const [pendingPreviewLine, setPendingPreviewLine] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [searchCount, setSearchCount] = useState(0)
  const [matchCase, setMatchCase] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('contains')
  const [notice, setNotice] = useState<string | null>(null)
  const [applications, setApplications] = useState<ExternalApplication[]>([])
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const editorState = documents.document.editorState
  const editorRef = useRef<EditorPaneHandle>(null)
  const allowCloseRef = useRef(false)
  const [closeGuard, setCloseGuard] = useState<{ dirty: number; canSaveAll: boolean } | null>(null)
  const [tabCloseGuard, setTabCloseGuard] = useState<{ id: string; canSave: boolean } | null>(null)
  const [navigationGuard, setNavigationGuard] = useState<{ direction: -1 | 1; canSave: boolean } | null>(null)
  const invalidDeepLinkTimerRef = useRef(0)
  const documentsRef = useRef(documents)
  documentsRef.current = documents
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  // The caret belongs to the editor, which is unmounted on every mode switch.
  // Remembering it on the way out is what lets an output action put it back.
  const editorExitRef = useRef<EditorExitCaret | null>(null)
  const editorExitSelectionRef = useRef<EditorSessionState['selection'] | null>(null)
  const rendered = useMarkdownRenderer(documents.document.contents, settings.locale)
  useEffect(() => {
    localStorage.setItem('textmark.sidebarVisible', String(sidebarVisible))
    localStorage.setItem('textmark.sidebarMode', sidebarMode)
    localStorage.setItem('textmark.sidebarWidth', String(sidebarWidth))
    localStorage.setItem('textmark.inspectorVisible', String(inspectorVisible))
    localStorage.setItem('textmark.inspectorMode', inspectorMode)
    localStorage.setItem('textmark.inspectorWidth', String(inspectorWidth))
  }, [inspectorMode, inspectorVisible, inspectorWidth, sidebarMode, sidebarVisible, sidebarWidth])
  useTextmarkDeepLinks(documents.openPath, () => {
    setNotice(
      settings.locale === 'zh-CN'
        ? '无法打开此 TextMark 链接。请使用 textmark://file/<绝对路径>。'
        : 'This TextMark link is invalid. Use textmark://file/<absolute path>.',
    )
    window.clearTimeout(invalidDeepLinkTimerRef.current)
    invalidDeepLinkTimerRef.current = window.setTimeout(() => setNotice(null), 4_000)
  })
  const previewHydrationRef = useRef<PreviewHydrationGate | null>(null)
  previewHydrationRef.current ??= createPreviewHydrationGate()
  const stats = useMemo(
    () => ({
      words: documents.document.contents.trim().split(/\s+/u).filter(Boolean).length,
      characters: documents.document.contents.length,
      lines: documents.document.contents.split(/\r?\n/).length,
      headings: rendered.outline.length,
      links: (documents.document.contents.match(/(?<!!)\[[^\]]*]\([^)]+\)/g) ?? []).length,
      images: (documents.document.contents.match(/!\[[^\]]*]\([^)]+\)/g) ?? []).length,
    }),
    [documents.document.contents, rendered.outline.length],
  )
  const resolvedTheme = useTheme(settings.theme)
  const previewRenderKey = `${documents.document.id}:${documents.document.path ?? documents.document.name}:${rendered.html}`

  const waitForPreviewHydration = () => previewHydrationRef.current!.wait(previewRenderKey)
  const markPreviewHydrated = (key: string) => previewHydrationRef.current!.report(key)
  // The pane is only on screen in preview mode, and a render key repeats across
  // the edit/preview round trip. Invalidating on both edges of that switch is
  // what keeps an edit-mode export from capturing a preview that has not drawn
  // its diagrams yet (see lib/previewHydration).
  useEffect(() => {
    const gate = previewHydrationRef.current!
    if (viewMode === 'preview') gate.markMounted()
    else gate.markUnmounted()
  }, [viewMode])

  useEffect(() => {
    void configureCrashReporting(settings.crashReports)
  }, [settings.crashReports])
  useEffect(() => {
    applyUpstreamDocumentTokens(document.documentElement, settings.documentFont, {
      lineHeight: settings.lineHeight,
      pagePaddingHorizontal: settings.pagePaddingHorizontal,
    })
  }, [settings.documentFont, settings.lineHeight, settings.pagePaddingHorizontal])
  useEffect(() => {
    applyThemeColors(document.documentElement, settings.themePreset, resolvedTheme, settings.themeColors)
  }, [resolvedTheme, settings.themeColors, settings.themePreset])
  useEffect(() => {
    alwaysOnTopRef.current = alwaysOnTop
  }, [alwaysOnTop])
  useEffect(() => {
    if (!isTauri()) return
    const windowHandle = getCurrentWindow()
    let disposed = false
    const synchronize = async () => {
      const transition = resolveAlwaysOnTopTransition(
        alwaysOnTopRef.current,
        await windowHandle.isFullscreen(),
        alwaysOnTopSuspendedRef.current,
      )
      if (disposed) return
      const stateChanged =
        transition.suspended !== alwaysOnTopSuspendedRef.current || transition.nativePinned !== nativeAlwaysOnTopRef.current
      alwaysOnTopSuspendedRef.current = transition.suspended
      if (!stateChanged) return
      nativeAlwaysOnTopRef.current = transition.nativePinned
      await windowHandle.setAlwaysOnTop(transition.nativePinned)
    }
    void synchronize()
    let unlisten: (() => void) | undefined
    void windowHandle
      .onResized(() => void synchronize())
      .then((stop) => {
        if (disposed) stop()
        else unlisten = stop
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [alwaysOnTop])
  useEffect(() => {
    if (!isTauri()) return
    void refreshMenu({
      locale: settings.locale,
      appearance: settings.theme,
      contentWidth: settings.contentWidth,
      sidebarMode,
      sidebarVisible,
      alwaysOnTop,
    })
  }, [settings.locale, settings.theme, settings.contentWidth, sidebarMode, sidebarVisible, alwaysOnTop])
  useEffect(() => {
    if (!isTauri() || !documents.document.path) return
    void recordRecentFile(documents.document.path).then(() =>
      refreshMenu({
        locale: settings.locale,
        appearance: settings.theme,
        contentWidth: settings.contentWidth,
        sidebarMode,
        sidebarVisible,
        alwaysOnTop,
      }),
    )
  }, [documents.document.path])
  useEffect(() => {
    void discoverApplications().then(setApplications)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.platform = detectPlatform()
    document.documentElement.dataset.runtime = detectRuntime()
  }, [])
  useEffect(() => {
    document.documentElement.lang = settings.locale
    const title = documents.document.name + (documents.isDirty ? ` — ${t(settings.locale, 'edited')}` : '')
    document.title = title
    if (isTauri()) void getCurrentWindow().setTitle(title)
  }, [documents.document.name, documents.isDirty, settings.locale])
  useEffect(() => {
    // When a tab changes while the editor is visible, restore that session's
    // saved editor position. Do not key this effect on viewMode: entering edit
    // from preview already staged a live preview anchor in switchViewMode, and
    // replaying editorState here would overwrite the reader's newer position.
    if (viewModeRef.current !== 'edit') return
    const saved = documents.document.editorState
    if (saved) {
      setPendingEditorLine(saved.topLine)
      setPendingScrollFraction(saved.scrollFraction)
      setPendingEditorSelection(saved.selection)
      setPendingEditorCursor(saved.selection.head)
    } else {
      setPendingEditorLine(null)
      setPendingScrollFraction(0)
      setPendingEditorSelection(null)
      setPendingEditorCursor(null)
    }
  }, [documents.activeId])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 1800)
  }
  const toggleAlwaysOnTop = () => {
    patch({ alwaysOnTop: !alwaysOnTopRef.current })
  }
  const previewFraction = () => {
    const pane = document.querySelector<HTMLElement>('.preview-pane')
    if (!pane || pane.scrollHeight <= pane.clientHeight) return 0
    return clampScrollFraction(pane.scrollTop / (pane.scrollHeight - pane.clientHeight))
  }
  // Reading position of the preview expressed as a source line. Heading anchors
  // survive the layout difference between the two surfaces, so this lands the
  // editor on the text the reader was actually looking at.
  /** Heading positions of the live preview, in source lines and pixels. */
  const previewAnchors = () => {
    const pane = document.querySelector<HTMLElement>('.preview-pane')
    if (!pane) return []
    const paneTop = pane.getBoundingClientRect().top
    return rendered.outline.flatMap((item) => {
      const element = document.getElementById(item.id)
      if (!element) return []
      return [{ line: item.line, top: element.getBoundingClientRect().top - paneTop + pane.scrollTop }]
    })
  }
  const previewSourceLine = () => {
    const pane = document.querySelector<HTMLElement>('.preview-pane')
    const anchors = previewAnchors()
    if (!pane || !anchors.length) return null
    return lineForAnchor(
      anchors.map((anchor) => anchor.line),
      anchorForOffset(
        anchors.map((anchor) => anchor.top),
        pane.scrollTop,
      ),
    )
  }
  // Hand the reading position between the preview and the editor on mode
  // switches (upstream restores the exact scroll anchor across the crossfade).
  const switchViewMode = (mode: ViewMode) => {
    // The guard must read the live mode, not the render-time snapshot: a single
    // flow (export, print) switches away and back again from the same closure,
    // so comparing against a captured `viewMode` made the return trip a no-op
    // and left the user stranded in the mode the flow had switched to.
    if (mode === viewModeRef.current) return
    if (mode === 'edit') {
      const anchorLine = previewSourceLine()
      setPendingEditorLine(anchorLine)
      setPendingScrollFraction(previewFraction())
      setPendingEditorCursor(caretForReturnToEditor(anchorLine, editorExitRef.current))
      setPendingEditorSelection(anchorLine != null && editorExitRef.current?.topLine === anchorLine ? editorExitSelectionRef.current : null)
    } else {
      const currentEditorState = editorRef.current?.getState() ?? editorState
      editorExitRef.current = {
        topLine: currentEditorState?.topLine ?? editorRef.current?.getTopLine() ?? null,
        line: currentEditorState?.selection.head.line ?? cursorRef.current.line,
        column: currentEditorState?.selection.head.column ?? cursorRef.current.column,
      }
      editorExitSelectionRef.current = currentEditorState?.selection ?? null
      setPendingEditorLine(null)
      setPendingEditorCursor(null)
      setPendingPreviewLine(editorRef.current?.getTopLine() ?? null)
      setPendingScrollFraction(editorRef.current?.getScrollFraction() ?? 0)
    }
    setViewMode(mode)
  }
  const createNewDocument = () => {
    documents.newDocument()
    setPendingScrollFraction(0)
    setViewMode('edit')
  }
  // The editor is mounted through Suspense, so it cannot consume the pending
  // position in the same commit as the mode switch. Clearing these on the next
  // tick (as this used to) discarded them across that boundary: every return to
  // the editor opened at the top of the document instead of the source line the
  // reader had left. The editor reports back when it has applied them.
  const clearPendingEditorPosition = () => {
    setPendingEditorLine(null)
    setPendingEditorCursor(null)
    setPendingEditorSelection(null)
    setPendingScrollFraction(null)
  }
  // Returning to the preview has to wait for the pane to be laid out and for
  // async images/diagrams to settle. A single next-frame restore can be
  // overwritten by Mermaid or a decoded image changing the anchor offsets.
  useEffect(() => {
    if (viewMode !== 'preview' || pendingPreviewLine == null) return
    let cancelled = false
    let frame = 0
    void previewHydrationRef.current!.wait(previewRenderKey).then(() => {
      if (cancelled) return
      frame = requestAnimationFrame(() => {
        if (cancelled) return
        const pane = document.querySelector<HTMLElement>('.preview-pane')
        const anchors = previewAnchors()
        if (pane && anchors.length) {
          const offset = offsetForLine(
            { lines: anchors.map((anchor) => anchor.line), offsets: anchors.map((anchor) => anchor.top) },
            pendingPreviewLine,
          )
          if (offset != null) pane.scrollTop = offset
        }
        setPendingPreviewLine(null)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [pendingPreviewLine, previewRenderKey, viewMode])
  const installCliAction = () => {
    void installCli().then((result) => {
      if (result.ok)
        flash(
          settings.locale === 'zh-CN'
            ? `命令行工具已安装到 ${result.detail ?? ''}`
            : `Command-line tools installed to ${result.detail ?? ''}`,
        )
      else flash(settings.locale === 'zh-CN' ? '安装命令行工具失败。' : 'Could not install the command-line tools.')
    })
  }
  const openSettings = (pane: 'general' | 'appearance' | 'privacy' | 'about' = 'general') => {
    setSettingsPane(pane)
    // Use the already-loaded document WebView on Windows. On some WebView2
    // runtimes a freshly-created secondary settings window can show only a
    // blank surface, making Settings and menu commands appear broken.
    // The dedicated window currently has no pane-routing contract. Keep a
    // direct appearance request in this WebView rather than opening General.
    if (pane !== 'appearance' && shouldUseDedicatedSettingsWindow()) {
      void openSettingsWindow().catch(() => setSettingsOpen(true))
      return
    }
    setSettingsOpen(true)
  }
  const resolveDefaultHandler = (choice: boolean) => {
    localStorage.setItem('textmark.defaultHandlerPrompted', '1')
    setDefaultHandlerPrompt(false)
    if (!choice) return
    void setDefaultHandler().then((result) => {
      flash(
        result.ok
          ? settings.locale === 'zh-CN'
            ? '已设为默认 Markdown 打开方式。'
            : 'Set as the default Markdown handler.'
          : settings.locale === 'zh-CN'
            ? '未能设为默认打开方式。'
            : 'Could not set the default handler.',
      )
    })
  }
  useEffect(() => {
    // Windows and macOS require the user to choose a file handler in the OS
    // settings. Only Linux can safely set the MIME default directly.
    if (isTauri() && detectPlatform() === 'linux' && !localStorage.getItem('textmark.defaultHandlerPrompted')) setDefaultHandlerPrompt(true)
  }, [])
  const copySource = async () => {
    await navigator.clipboard.writeText(documents.document.contents)
    flash(t(settings.locale, 'copied'))
  }
  const shareSource = async () => {
    const outcome = await shareMarkdownSource({
      source: documents.document.contents,
      name: documents.document.name,
      environment: navigator,
      nativeShare:
        isTauri() && isMacos() && !import.meta.env.VITE_WDIO ? () => shareSourceNatively(documents.document.contents) : undefined,
    })
    if (outcome === 'copied') flash(t(settings.locale, 'copied'))
  }
  const openWith = async (application = 'system') => {
    if (!documents.document.path && documents.isDirty) {
      flash(
        settings.locale === 'zh-CN'
          ? '请先保存未命名文稿，再使用外部编辑器打开。'
          : 'Save the untitled document before opening it in another app.',
      )
      return
    }
    if (!documents.document.path || !isTauri()) {
      flash(settings.locale === 'zh-CN' ? '请先保存文件，再使用外部编辑器打开。' : 'Save the file before opening it in another app.')
      return
    }
    if (documents.isDirty) {
      const saved = await documents.saveFile()
      if (!saved) {
        flash(
          settings.locale === 'zh-CN'
            ? '文稿未保存，已取消打开外部编辑器。'
            : 'The document was not saved; opening the external editor was cancelled.',
        )
        return
      }
    }
    try {
      if (application === 'system') await openExternalPath(documents.document.path)
      else await openInApplication(documents.document.path, application)
    } catch {
      flash(settings.locale === 'zh-CN' ? '无法打开所选应用。' : 'The selected application could not be opened.')
    }
  }
  const openFileWith = (path: string, application: string) => {
    if (!isTauri()) return
    if (application === 'system')
      void openExternalPath(path).catch(() =>
        flash(settings.locale === 'zh-CN' ? '无法打开所选应用。' : 'The selected application could not be opened.'),
      )
    else
      void openInApplication(path, application).catch(() =>
        flash(settings.locale === 'zh-CN' ? '无法打开所选应用。' : 'The selected application could not be opened.'),
      )
  }
  const openInLlm = async (application: 'codex' | 'claude' | 'chatgpt') => {
    if (documents.isDirty && documents.document.path) {
      const saved = await documents.saveFile()
      if (!saved) {
        flash(settings.locale === 'zh-CN' ? '文稿未保存，已取消打开 LLM。' : 'The document was not saved; opening the LLM was cancelled.')
        return
      }
    }
    const { buildLlmHandoff } = await import('./lib/llmHandoff')
    const handoff = buildLlmHandoff({
      target: application,
      path: documents.document.path,
      contents: documents.document.contents,
      folder: documents.workspacePath,
      name: documents.document.name,
      locale: settings.locale,
    })
    localStorage.setItem('textmark.lastLlmTarget', application)
    await navigator.clipboard.writeText(handoff.clipboard)
    const url = handoff.url ?? (application === 'chatgpt' ? 'chatgpt://' : `${application}://`)
    try {
      if (isTauri()) await openUrl(url)
      else
        window.open(
          application === 'chatgpt' ? 'https://chatgpt.com' : application === 'claude' ? 'https://claude.ai' : 'https://chatgpt.com/codex',
        )
    } catch {
      /* app not installed; clipboard already holds the content */
    }
    if (handoff.long)
      flash(
        settings.locale === 'zh-CN'
          ? '文档较长，全文已拷贝，请粘贴到对话中。'
          : 'The document is long; its full text was copied for you to paste.',
      )
    else flash(t(settings.locale, 'copied'))
  }
  const waitForNextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  // Output actions render from the live preview pane, so an edit-mode export has
  // to switch to the preview, let it paint, and wait until its diagrams and
  // images have settled in the DOM. The hydration listener is attached *before*
  // the switch: with an already-warm module cache Mermaid can finish inside the
  // paint wait, and a listener installed afterwards would miss the report and
  // stall the export on the timeout instead.
  const beginPreviewOutput = (restoreEditMode: boolean) => {
    if (!restoreEditMode) return waitForPreviewHydration()
    const hydrated = waitForPreviewHydration()
    switchViewMode('preview')
    return Promise.all([waitForNextPaint(), hydrated]).then(() => undefined)
  }
  const exportDocument = async (format: 'html' | 'png') => {
    const restoreEditMode = viewMode === 'edit'
    const previewReady = beginPreviewOutput(restoreEditMode)
    try {
      await previewReady
      const root = document.querySelector<HTMLElement>('.markdown-body')
      if (!root) return
      const exporter = await import('./lib/export')
      if (format === 'html') {
        if (!isTauri()) {
          await exporter.downloadHtml(documents.document.name, root)
          return
        }
        const { name, bytes } = await exporter.buildHtmlExport(documents.document.name, root)
        if (await saveExportFile(name, bytes, 'HTML', ['html'])) flash(t(settings.locale, 'exported'))
      } else {
        if (!isTauri()) {
          await exporter.downloadPng(documents.document.name, root)
          return
        }
        const { name, bytes } = await exporter.buildPngExport(documents.document.name, root)
        if (await saveExportFile(name, bytes, 'PNG', ['png'])) flash(t(settings.locale, 'exported'))
      }
    } catch {
      flash(settings.locale === 'zh-CN' ? '导出失败。' : 'Export failed.')
    } finally {
      if (restoreEditMode) switchViewMode('edit')
    }
  }
  const exportPdf = async () => {
    const restoreEditMode = viewMode === 'edit'
    const previewReady = beginPreviewOutput(restoreEditMode)
    // macOS's print dialog provides the native “Save as PDF” workflow and
    // preserves selectable text/vector diagrams. Keep the byte-export path
    // for browser and non-macOS desktop runtimes; its raster contract is
    // intentionally explicit until a platform-specific vector printer exists.
    try {
      const capability = pdfCapability({ tauri: isTauri(), macos: isMacos(), printAvailable: typeof window.print === 'function' })
      if (capability === 'native-vector') {
        await printDocument(true)
        return
      }
      await previewReady
      const root = document.querySelector<HTMLElement>('.markdown-body')
      if (!root) return
      const exporter = await import('./lib/export')
      if (!isTauri()) {
        await exporter.downloadPdf(documents.document.name, root)
        return
      }
      const { name, bytes } = await exporter.buildPdfExport(documents.document.name, root)
      if (await saveExportFile(name, bytes, 'PDF', ['pdf'])) flash(t(settings.locale, 'exported'))
    } catch {
      flash(settings.locale === 'zh-CN' ? '导出失败。' : 'Export failed.')
    } finally {
      if (restoreEditMode) switchViewMode('edit')
    }
  }
  const printDocument = async (exportingPdf = false) => {
    const restoreEditMode = viewMode === 'edit'
    const previewReady = beginPreviewOutput(restoreEditMode)
    const html = document.documentElement
    const previousPdfMode = html.getAttribute('data-export-pdf')
    if (exportingPdf) html.dataset.exportPdf = '1'
    try {
      // Use Wry's native macOS print dialog first. Its “Save as PDF” path keeps
      // text and vector diagrams selectable instead of flattening the page.
      if (isTauri() && isMacos()) {
        await previewReady
        try {
          await printCurrentWindow()
          return
        } catch {
          // Older WebKit/Wry builds can reject native printing. Preserve the
          // portable PDF-preview fallback for those installations.
        }
        const root = document.querySelector<HTMLElement>('.markdown-body')
        if (!root) return
        try {
          const exporter = await import('./lib/export')
          const { bytes } = await exporter.buildPdfExport(documents.document.name, root)
          const path = await tempExportPath('pdf')
          await writeExportBytes(path, bytes)
          await openExternalPath(path)
          flash(settings.locale === 'zh-CN' ? '已生成打印预览。' : 'Print preview generated.')
        } catch {
          flash(settings.locale === 'zh-CN' ? '打印失败。' : 'Print failed.')
        }
        return
      }
      await previewReady
      window.print()
    } finally {
      if (exportingPdf) {
        if (previousPdfMode === null) html.removeAttribute('data-export-pdf')
        else html.setAttribute('data-export-pdf', previousPdfMode)
      }
      if (restoreEditMode) switchViewMode('edit')
    }
  }
  const menuCommandRef = useRef<(command: string) => void>(() => {})
  menuCommandRef.current = (command: string) => {
    if (command === 'open') void documents.openFile()
    else if (command.startsWith('open-recent:')) void documents.openPath(command.slice('open-recent:'.length))
    else if (command === 'clear-recent')
      void clearRecentFiles().then(() =>
        refreshMenu({
          locale: settings.locale,
          appearance: settings.theme,
          contentWidth: settings.contentWidth,
          sidebarMode,
          sidebarVisible,
          alwaysOnTop,
        }),
      )
    else if (command === 'open-folder') {
      void documents.openFolder()
      setSidebarMode('files')
      setSidebarVisible(true)
    } else if (command === 'new-tab') void documents.openFile(true)
    else if (command === 'new-document') createNewDocument()
    else if (command === 'close-tab') documents.closeSession(documents.activeId)
    else if (command === 'save') void documents.saveFile()
    else if (command === 'save-as') void documents.saveAs()
    else if (command === 'revert') documents.revertDocument()
    else if (command === 'print') printDocument()
    else if (command === 'export') setExportOpen(true)
    else if (command === 'export-pdf') exportPdf()
    else if (command === 'undo') documents.undo()
    else if (command === 'redo') documents.redo()
    else if (command === 'find') setFindOpen(true)
    else if (command === 'find-next') nextMatch(1)
    else if (command === 'find-prev') nextMatch(-1)
    else if (command === 'edit-mode') switchViewMode(viewMode === 'edit' ? 'preview' : 'edit')
    else if (command === 'sidebar') setSidebarVisible((value) => !value)
    else if (command === 'sidebar-hide') setSidebarVisible(false)
    else if (command === 'sidebar-outline') {
      setSidebarMode('outline')
      setSidebarVisible(true)
    } else if (command === 'sidebar-files') {
      setSidebarMode('files')
      setSidebarVisible(true)
    } else if (command === 'show-toolbar') setToolbarVisible((value) => !value)
    else if (command === 'always-on-top') toggleAlwaysOnTop()
    else if (command === 'inspector') setInspectorVisible((value) => !value)
    else if (command === 'appearance-auto') setTheme('system')
    else if (command === 'appearance-light') setTheme('light')
    else if (command === 'appearance-dark') setTheme('dark')
    else if (command === 'width-normal') setContentWidth('normal')
    else if (command === 'width-full') setContentWidth('full')
    else if (command === 'zoom-in') setZoom(nextZoom(settings.zoom, 1))
    else if (command === 'zoom-out') setZoom(nextZoom(settings.zoom, -1))
    else if (command === 'zoom-reset') setZoom(100)
    else if (command === 'preferences') openSettings()
    else if (command === 'about') openSettings('about')
    else if (command === 'check-updates') {
      openSettings()
      void updater.checkNow()
    } else if (command === 'install-cli') installCliAction()
    else if (command === 'crash-reports') patch({ crashReports: !settings.crashReports })
    else if (externalMenuUrl(command)) void openUrl(externalMenuUrl(command)!)
    else if (command === 'help') void openUrl('https://github.com/jincaiw/TextMark-v1#readme')
    else if (command === 'customize-toolbar') setToolbarOpen(true)
    else if (command.startsWith('format-')) format(command.slice('format-'.length) as FormatCommand)
    else if (command === 'go-up') scrollPreviewLine(-1)
    else if (command === 'go-down') scrollPreviewLine(1)
    else if (command === 'go-page-up') scrollPreviewPage(-1)
    else if (command === 'go-page-down') scrollPreviewPage(1)
    else if (command === 'go-prev-item') jumpToHeading(-1)
    else if (command === 'go-next-item') jumpToHeading(1)
    else if (command === 'go-top') scrollPreviewEdge(false)
    else if (command === 'go-bottom') scrollPreviewEdge(true)
  }
  useEffect(() => {
    if (!isTauri()) return
    const subscription = listen<string>('menu-command', (event) => menuCommandRef.current(event.payload))
    return () => {
      void subscription.then((dispose) => dispose())
    }
  }, [])
  const toggleTask = (targetIndex: number, checked: boolean) => {
    const line = rendered.tasks[targetIndex]?.line
    if (!line) return
    const next = setTaskChecked(documents.document.contents, line, checked)
    if (next !== null) documents.applyEdit(next)
  }
  const format = (command: FormatCommand) => {
    setPendingFormat(command)
    switchViewMode('edit')
  }
  const nextMatch = (direction: 1 | -1) =>
    setSearchIndex((current) => (searchCount ? (current + direction + searchCount) % searchCount : 0))
  const replaceCurrent = () => {
    if (viewMode !== 'edit' || !searchQuery) return
    const replaced = editorRef.current?.replace(searchQuery, replacement, { matchCase, mode: searchMode }) ?? 0
    if (replaced) flash(t(settings.locale, 'replacedCount', { count: replaced }))
  }
  const replaceAll = () => {
    if (viewMode !== 'edit' || !searchQuery) return
    const replaced = editorRef.current?.replace(searchQuery, replacement, { matchCase, all: true, mode: searchMode }) ?? 0
    if (replaced) flash(t(settings.locale, 'replacedCount', { count: replaced }))
  }
  const previewScrollTop = () => document.querySelector<HTMLElement>('.preview-pane')?.scrollTop ?? 0
  const previewPane = () => document.querySelector<HTMLElement>('.preview-pane')
  const scrollPreviewLine = (direction: 1 | -1) => previewPane()?.scrollBy({ top: direction * 42, behavior: 'smooth' })
  const scrollPreviewPage = (direction: 1 | -1) => {
    const pane = previewPane()
    if (pane) pane.scrollBy({ top: direction * Math.max(200, (pane.clientHeight ?? 600) - 80), behavior: 'smooth' })
  }
  const scrollPreviewEdge = (end: boolean) => {
    const pane = previewPane()
    if (pane) pane.scrollTo({ top: end ? pane.scrollHeight : 0, behavior: 'smooth' })
  }
  const jumpToHeading = (direction: 1 | -1) => {
    const ids = rendered.outline.map((item) => item.id)
    if (!ids.length) return
    const current = Math.max(
      0,
      ids.findIndex((id) => id === activeHeading),
    )
    const target = direction < 0 ? Math.max(0, current - 1) : Math.min(ids.length - 1, current + 1)
    document.getElementById(ids[target])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveHeading(ids[target])
  }
  // The outline follows the visible surface: the preview scrolls to the heading
  // anchor, the editor jumps to the heading's source line.
  const selectOutline = (id: string) => {
    setActiveHeading(id)
    const item = rendered.outline.find((entry) => entry.id === id)
    if (viewMode === 'edit') {
      if (item?.line) editorRef.current?.revealLine(item.line)
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activateDocumentTab = (id: string) => {
    if (id === documents.activeId) return
    const target = documents.sessions.find((session) => session.id === id)
    if (viewModeRef.current === 'edit') {
      const saved = target?.editorState
      setPendingEditorLine(saved?.topLine ?? null)
      setPendingScrollFraction(saved?.scrollFraction ?? 0)
      setPendingEditorSelection(saved?.selection ?? null)
      setPendingEditorCursor(saved?.selection.head ?? null)
    } else {
      setPendingEditorLine(null)
      setPendingEditorCursor(null)
      setPendingEditorSelection(null)
      setPendingScrollFraction(null)
    }
    editorExitRef.current = null
    editorExitSelectionRef.current = null
    documents.activate(id, previewScrollTop())
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const target = event.target as HTMLElement
      const isTyping = target.matches('input, textarea, select, [contenteditable=true]')
      if (event.key === 'Escape' && findOpen) {
        event.preventDefault()
        setFindOpen(false)
        return
      }
      if (event.key === 'Escape' && defaultHandlerPrompt) {
        event.preventDefault()
        localStorage.setItem('textmark.defaultHandlerPrompted', '1')
        setDefaultHandlerPrompt(false)
        return
      }
      if (event.altKey && !modifier && !event.shiftKey) {
        if (event.key === 'ArrowUp' && viewMode === 'preview') {
          event.preventDefault()
          jumpToHeading(-1)
          return
        }
        if (event.key === 'ArrowDown' && viewMode === 'preview') {
          event.preventDefault()
          jumpToHeading(1)
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          requestNavigation(-1)
          return
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          requestNavigation(1)
          return
        }
      }
      if (!modifier && viewMode === 'preview' && !isTyping) {
        const pane = document.querySelector<HTMLElement>('.preview-pane')
        if (event.key === 'j' || event.key === 'k') {
          event.preventDefault()
          pane?.scrollBy({ top: event.key === 'j' ? 42 : -42, behavior: 'smooth' })
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          pane?.scrollBy({ top: -42, behavior: 'smooth' })
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          pane?.scrollBy({ top: 42, behavior: 'smooth' })
        } else if (event.key === 'PageUp') {
          event.preventDefault()
          pane?.scrollBy({ top: -Math.max(200, (pane.clientHeight ?? 600) - 80), behavior: 'smooth' })
        } else if (event.key === 'PageDown') {
          event.preventDefault()
          pane?.scrollBy({ top: Math.max(200, (pane.clientHeight ?? 600) - 80), behavior: 'smooth' })
        } else if (event.key === ' ') {
          event.preventDefault()
          pane?.scrollBy({ top: (event.shiftKey ? -1 : 1) * Math.max(200, (pane.clientHeight ?? 600) - 80), behavior: 'smooth' })
        }
        return
      }
      if (!modifier) return
      const key = event.key.toLowerCase()
      if (event.altKey && (key === '0' || key === '1' || key === '2' || key === '3')) {
        event.preventDefault()
        format((key === '0' ? 'h0' : `h${key}`) as FormatCommand)
        return
      }
      if (event.ctrlKey && event.metaKey && (key === '1' || key === '2' || key === '3')) {
        event.preventDefault()
        if (key === '1') setSidebarVisible(false)
        else if (key === '2') {
          setSidebarMode('outline')
          setSidebarVisible(true)
        } else {
          setSidebarMode('files')
          setSidebarVisible(true)
        }
        return
      }
      if (event.ctrlKey && event.metaKey && key === 't') {
        event.preventDefault()
        toggleAlwaysOnTop()
        return
      }
      if (key === 's' && event.shiftKey) {
        event.preventDefault()
        void documents.saveAs()
      } else if (key === 's') {
        event.preventDefault()
        void documents.saveFile()
      } else if (key === 'o' && event.shiftKey) {
        event.preventDefault()
        void documents.openFolder()
        setSidebarMode('files')
        setSidebarVisible(true)
      } else if (key === 'o') {
        event.preventDefault()
        void documents.openFile()
      } else if (key === 'e') {
        event.preventDefault()
        switchViewMode(viewMode === 'edit' ? 'preview' : 'edit')
      } else if (key === 'l' && event.shiftKey) {
        event.preventDefault()
        format('taskList')
      } else if (key === 'l') {
        event.preventDefault()
        setSidebarVisible((value) => !value)
      } else if (key === 'n') {
        event.preventDefault()
        createNewDocument()
      } else if (key === 't') {
        event.preventDefault()
        void documents.openFile(true)
      } else if (key === 'w') {
        event.preventDefault()
        documents.closeSession(documents.activeId)
      } else if (key === 'f') {
        event.preventDefault()
        setFindOpen(true)
      } else if (key === 'g') {
        event.preventDefault()
        nextMatch(event.shiftKey ? -1 : 1)
      } else if (key === 'p') {
        event.preventDefault()
        void printDocument()
      } else if (key === '0') {
        event.preventDefault()
        setZoom(100)
      } else if (key === '+' || key === '=') {
        event.preventDefault()
        setZoom(nextZoom(settings.zoom, 1))
      } else if (key === '-') {
        event.preventDefault()
        setZoom(nextZoom(settings.zoom, -1))
      } else if (key === 'z' && viewMode === 'preview') {
        event.preventDefault()
        event.shiftKey ? documents.redo() : documents.undo()
      } else if (key === 'b') {
        event.preventDefault()
        format('bold')
      } else if (key === 'i') {
        event.preventDefault()
        format('italic')
      } else if (key === 'm' && event.shiftKey) {
        event.preventDefault()
        format('code')
      } else if (key === 'x' && event.shiftKey) {
        event.preventDefault()
        format('strikethrough')
      } else if (key === 'k') {
        event.preventDefault()
        format('link')
      } else if (key === '7' && event.shiftKey) {
        event.preventDefault()
        format('bulletList')
      } else if (key === '9' && event.shiftKey) {
        event.preventDefault()
        format('orderedList')
      } else if (key === "'") {
        event.preventDefault()
        format('quote')
      } else if (key === ',') {
        event.preventDefault()
        openSettings()
      } else if (key === '[') {
        event.preventDefault()
        requestNavigation(-1)
      } else if (key === ']') {
        event.preventDefault()
        requestNavigation(1)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [documents, findOpen, defaultHandlerPrompt, searchCount, setZoom, settings.zoom, viewMode, activeHeading, rendered.outline])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (documents.sessions.some((session) => session.dirty)) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [documents.sessions])

  useEffect(() => {
    if (!isTauri()) return
    const windowHandle = getCurrentWindow()
    let disposed = false
    let unlisten: (() => void) | undefined
    void windowHandle
      .onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') return
        const { first, extras } = partitionDroppedPaths(event.payload.paths)
        if (!first) {
          setNotice(settings.locale === 'zh-CN' ? '未检测到可打开的文件或文件夹。' : 'No openable file or folder was dropped.')
          return
        }
        if (extras.length) {
          setNotice(
            settings.locale === 'zh-CN'
              ? `已打开第一个路径，忽略另外 ${extras.length} 个路径。`
              : `Opened the first path and ignored ${extras.length} additional path${extras.length === 1 ? '' : 's'}.`,
          )
        }
        void documentsRef.current.openPath(first)
      })
      .then((stop) => {
        if (disposed) stop()
        else unlisten = stop
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    const windowHandle = getCurrentWindow()
    let disposed = false
    let unlisten: (() => void) | undefined
    void windowHandle
      .onCloseRequested((event) => {
        if (allowCloseRef.current) return
        const dirty = documentsRef.current.sessions.filter((session) => session.dirty)
        if (!dirty.length) {
          event.preventDefault()
          void documentsRef.current.saveSession(false).finally(async () => {
            allowCloseRef.current = true
            void getCurrentWindow().close()
          })
          return
        }
        event.preventDefault()
        setCloseGuard({ dirty: dirty.length, canSaveAll: dirty.every((session) => Boolean(session.path)) })
      })
      .then((stop) => {
        if (disposed) stop()
        else unlisten = stop
      })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])
  const closeWindowNow = () => {
    void documentsRef.current.saveSession(false).finally(async () => {
      allowCloseRef.current = true
      void getCurrentWindow().close()
    })
  }
  const requestClose = () => {
    const dirty = documentsRef.current.sessions.filter((session) => session.dirty)
    if (!dirty.length) {
      closeWindowNow()
      return
    }
    setCloseGuard({ dirty: dirty.length, canSaveAll: dirty.every((session) => Boolean(session.path)) })
  }
  const discardAndClose = () => {
    setCloseGuard(null)
    closeWindowNow()
  }
  const saveAndClose = async () => {
    const dirty = documentsRef.current.sessions.filter((session) => session.dirty)
    for (const session of dirty) {
      if (documentsRef.current.activeId !== session.id) documentsRef.current.activate(session.id)
      // Let React commit the activation before the next save; saveFile works on
      // whichever document is active at the time it runs.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      await documentsRef.current.saveFile()
    }
    if (documentsRef.current.sessions.some((session) => session.dirty)) return
    setCloseGuard(null)
    closeWindowNow()
  }

  const performNavigation = (direction: -1 | 1) =>
    direction === -1 ? documentsRef.current.goBack(previewScrollTop(), true) : documentsRef.current.goForward(previewScrollTop(), true)
  const requestNavigation = (direction: -1 | 1) => {
    const active = documentsRef.current.sessions.find((session) => session.id === documentsRef.current.activeId)
    if (!active?.dirty) {
      void performNavigation(direction)
      return
    }
    setNavigationGuard({ direction, canSave: Boolean(active.path) })
  }
  const discardAndNavigate = () => {
    if (!navigationGuard) return
    void performNavigation(navigationGuard.direction)
    setNavigationGuard(null)
  }
  const saveAndNavigate = async () => {
    if (!navigationGuard?.canSave) return
    const direction = navigationGuard.direction
    await documentsRef.current.saveFile()
    const active = documentsRef.current.sessions.find((session) => session.id === documentsRef.current.activeId)
    if (active?.dirty) return
    if (direction === -1) await documentsRef.current.goBack(previewScrollTop(), true)
    else await documentsRef.current.goForward(previewScrollTop(), true)
    setNavigationGuard(null)
  }
  const requestTabClose = (id: string) => {
    const target = documentsRef.current.sessions.find((session) => session.id === id)
    if (!target?.dirty) {
      documentsRef.current.closeSession(id)
      return
    }
    setTabCloseGuard({ id, canSave: Boolean(target.path) })
  }
  const discardTabAndClose = () => {
    if (!tabCloseGuard) return
    documentsRef.current.closeSession(tabCloseGuard.id, true)
    setTabCloseGuard(null)
  }
  const saveTabAndClose = async () => {
    if (!tabCloseGuard?.canSave) return
    const { id } = tabCloseGuard
    if (documentsRef.current.activeId !== id) documentsRef.current.activate(id)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await documentsRef.current.saveFile()
    const session = documentsRef.current.sessions.find((candidate) => candidate.id === id)
    if (session?.dirty) return
    documentsRef.current.closeSession(id, true)
    setTabCloseGuard(null)
  }

  const chooseThemePreset = (themePreset: keyof typeof THEME_PRESETS) => {
    const flavor = THEME_PRESETS[themePreset].flavor
    patch({ themePreset, theme: flavor, themeColors: {} })
  }
  const chooseSidebarMode = (mode: SidebarMode) => {
    setSidebarMode(mode)
    setSidebarVisible(true)
  }
  return (
    <main className={`app-shell native-shell mode-${viewMode} ${toolbarVisible ? '' : 'toolbar-hidden'}`}>
      <Toolbar
        busy={documents.busy}
        viewMode={viewMode}
        locale={settings.locale}
        items={settings.toolbar}
        displayMode={settings.toolbarDisplay}
        applications={applications}
        defaultOpenTarget={settings.defaultOpenTarget}
        canGoBack={documents.canGoBack}
        canGoForward={documents.canGoForward}
        onBack={() => requestNavigation(-1)}
        onForward={() => requestNavigation(1)}
        sidebarVisible={sidebarVisible}
        sidebarWidth={sidebarWidth}
        sidebarMode={sidebarMode}
        inspectorVisible={inspectorVisible}
        alwaysOnTop={alwaysOnTop}
        zoom={settings.zoom}
        searchQuery={searchQuery}
        onToggleSidebar={() => setSidebarVisible((value) => !value)}
        onSidebarModeChange={chooseSidebarMode}
        onViewModeChange={switchViewMode}
        onToggleInspector={() => setInspectorVisible((value) => !value)}
        onToggleAlwaysOnTop={toggleAlwaysOnTop}
        onZoomChange={setZoom}
        onSearchQueryChange={(value) => {
          setSearchQuery(value)
          setSearchIndex(0)
          setFindOpen(true)
        }}
        onSearchOpen={() => setFindOpen(true)}
        onOpenWith={(application) => void openWith(application)}
        onOpenInLlm={(application) => void openInLlm(application)}
        onOpen={() => void documents.openFile()}
        onOpenFolder={() => {
          void documents.openFolder()
          setSidebarMode('files')
          setSidebarVisible(true)
        }}
        onSave={() => void documents.saveFile()}
        onSaveAs={() => void documents.saveAs()}
        onShare={() => void shareSource()}
        onCopy={() => void copySource()}
        onPrint={() => void printDocument()}
        onExportHtml={() => void exportDocument('html')}
        onExportPng={() => void exportDocument('png')}
        onExportPdf={() => exportPdf()}
        onExport={() => setExportOpen(true)}
        theme={settings.theme}
        themePreset={settings.themePreset}
        onThemeChange={setTheme}
        onThemePresetChange={chooseThemePreset}
        onCustomizeAppearance={() => openSettings('appearance')}
        onSettings={() => openSettings()}
        onCustomizeToolbar={() => setToolbarOpen(true)}
        onClose={requestClose}
      />
      <div className="workspace-stack">
        <DocumentTabs
          sessions={documents.sessions}
          activeId={documents.activeId}
          locale={settings.locale}
          onActivate={activateDocumentTab}
          onClose={requestTabClose}
        />
        <div
          className={`document-shell ${sidebarVisible ? 'with-sidebar' : ''} ${inspectorVisible ? 'with-inspector' : ''}`}
          style={{ '--sidebar-width': `${sidebarWidth}px`, '--inspector-width': `${inspectorWidth}px` } as CSSProperties}
        >
          {sidebarVisible ? (
            <>
              <Sidebar
                locale={settings.locale}
                mode={sidebarMode}
                fileName={documents.document.name}
                documentKey={`${documents.document.id}:${documents.document.path ?? documents.document.name}`}
                files={documents.files}
                workspacePath={documents.workspacePath}
                activePath={documents.document.path}
                outline={rendered.outline}
                activeHeading={activeHeading}
                applications={applications}
                defaultOpenTarget={settings.defaultOpenTarget}
                onOpenFolder={() => void documents.openFolder()}
                onOpenFile={(path) => void documents.openWorkspacePath(path, previewScrollTop())}
                onOpenFileInTab={(path) => void documents.openPath(path, true)}
                onOpenFileInWindow={(path) => void openDocumentWindow(path)}
                onOpenFileWith={openFileWith}
                onRevealFile={(path) => void revealInFileManager(path)}
                onCopyFilePath={(path) => void navigator.clipboard.writeText(path)}
                onCopyFileContents={(path) => void readDocument(path).then((file) => navigator.clipboard.writeText(file.contents))}
                onOutlineSelect={selectOutline}
              />
              <PanelResizer side="sidebar" width={sidebarWidth} min={230} max={400} onWidthChange={setSidebarWidth} />
            </>
          ) : null}
          <div className="document-workspace">
            <DocumentTools>
              {findOpen ? (
                <FindBar
                  locale={settings.locale}
                  query={searchQuery}
                  current={searchIndex}
                  count={searchCount}
                  matchCase={matchCase}
                  mode={searchMode}
                  replacement={replacement}
                  onReplacementChange={setReplacement}
                  onReplace={replaceCurrent}
                  onReplaceAll={replaceAll}
                  onQueryChange={(value) => {
                    setSearchQuery(value)
                    setSearchIndex(0)
                  }}
                  onPrevious={() => nextMatch(-1)}
                  onNext={() => nextMatch(1)}
                  onMatchCaseChange={setMatchCase}
                  onModeChange={setSearchMode}
                  onClose={() => setFindOpen(false)}
                />
              ) : null}
              {viewMode === 'edit' ? <FormattingToolbar locale={settings.locale} onFormat={format} /> : null}
            </DocumentTools>
            {viewMode === 'edit' ? (
              <Suspense fallback={<div className="editor-loading" />}>
                <EditorPane
                  key={`${documents.document.id}:${documents.document.revision ?? 'memory'}`}
                  ref={editorRef}
                  value={documents.document.contents}
                  theme={resolvedTheme}
                  fontSize={settings.editorFontSize}
                  zoom={settings.zoom}
                  contentWidth={settings.contentWidth}
                  initialScrollFraction={pendingEditorLine == null ? (pendingScrollFraction ?? undefined) : undefined}
                  initialLine={pendingEditorLine ?? undefined}
                  // Keep the find field authoritative when it is open; the
                  // editor's initial autofocus must not steal the query focus.
                  initialFocus={!findOpen}
                  initialCursor={pendingEditorCursor}
                  initialSelection={pendingEditorSelection}
                  onInitialPositionApplied={clearPendingEditorPosition}
                  onStateChange={documents.reportEditorState}
                  initialFormat={pendingFormat}
                  onInitialFormatApplied={() => setPendingFormat(null)}
                  onChange={documents.updateContents}
                  onPasteImage={documents.pasteImage}
                  baseDirectory={documents.baseDirectory}
                  workspacePath={documents.workspacePath}
                  onRenameImage={(path) => void documents.renamePastedImage(path)}
                  onCursorChange={(line, column) => setCursor({ line, column })}
                  searchQuery={searchQuery}
                  searchIndex={searchIndex}
                  matchCase={matchCase}
                  searchMode={searchMode}
                  onSearchCount={setSearchCount}
                />
              </Suspense>
            ) : (
              <PreviewPane
                locale={settings.locale}
                rendered={rendered}
                renderKey={previewRenderKey}
                onHydrated={markPreviewHydrated}
                documentKey={`${documents.document.id}:${documents.document.path ?? documents.document.name}`}
                initialScrollTop={documents.document.scrollTop}
                initialScrollFraction={pendingScrollFraction ?? undefined}
                baseDirectory={documents.baseDirectory}
                workspacePath={documents.workspacePath}
                zoom={settings.zoom}
                contentWidth={settings.contentWidth}
                searchQuery={searchQuery}
                searchIndex={searchIndex}
                matchCase={matchCase}
                searchMode={searchMode}
                onSearchCount={setSearchCount}
                onActiveHeading={setActiveHeading}
                onZoomChange={setZoom}
                onOpenRelative={(path) => void documents.openRelative(path, previewScrollTop())}
                onRenameImage={(path) => void documents.renamePastedImage(path)}
                onToggleTask={toggleTask}
                onEditTable={(table, row, column, request) =>
                  documents.applyEdit(editMarkdownTable(documents.document.contents, table, row, column, request))
                }
              />
            )}
            {viewMode === 'edit' ? <div className="editor-status" aria-label={`Line ${cursor.line}, column ${cursor.column}`} /> : null}
          </div>
          {inspectorVisible ? (
            <>
              <PanelResizer side="inspector" width={inspectorWidth} min={270} max={500} onWidthChange={setInspectorWidth} />
              <Inspector
                locale={settings.locale}
                mode={inspectorMode}
                outline={rendered.outline}
                document={documents.document}
                stats={stats}
                frontmatter={rendered.frontmatter}
                onModeChange={(mode) => {
                  setInspectorMode(mode)
                  setInspectorVisible(true)
                }}
                onOutlineSelect={selectOutline}
                onCopyPath={(path) => void navigator.clipboard.writeText(path)}
                onRevealPath={(path) => void revealInFileManager(path)}
                onClose={() => setInspectorVisible(false)}
              />
            </>
          ) : null}
        </div>
      </div>
      {notice || documents.notice ? (
        <div className="toast" role="status">
          {notice ?? documents.notice}
        </div>
      ) : null}
      <ConflictDialog change={documents.externalChange} locale={settings.locale} onResolve={documents.resolveExternal} />
      {documents.pendingDraft ? (
        <DraftRecoveryDialog
          record={documents.pendingDraft.record}
          locale={settings.locale}
          onRestore={documents.restorePendingDraft}
          onDiscard={documents.discardPendingDraft}
        />
      ) : null}
      {closeGuard ? (
        <UnsavedCloseDialog
          locale={settings.locale}
          dirtyCount={closeGuard.dirty}
          canSaveAll={closeGuard.canSaveAll}
          onSave={() => void saveAndClose()}
          onDiscard={discardAndClose}
          onCancel={() => setCloseGuard(null)}
        />
      ) : null}
      {tabCloseGuard ? (
        <UnsavedCloseDialog
          locale={settings.locale}
          dirtyCount={1}
          canSaveAll={tabCloseGuard.canSave}
          onSave={() => void saveTabAndClose()}
          onDiscard={discardTabAndClose}
          onCancel={() => setTabCloseGuard(null)}
        />
      ) : null}
      {navigationGuard ? (
        <UnsavedCloseDialog
          locale={settings.locale}
          dirtyCount={1}
          canSaveAll={navigationGuard.canSave}
          onSave={() => void saveAndNavigate()}
          onDiscard={discardAndNavigate}
          onCancel={() => setNavigationGuard(null)}
        />
      ) : null}
      <ExportDialog
        open={exportOpen}
        locale={settings.locale}
        onExportHtml={() => void exportDocument('html')}
        onExportPng={() => void exportDocument('png')}
        onExportPdf={() => exportPdf()}
        onClose={() => setExportOpen(false)}
      />
      {defaultHandlerPrompt ? (
        <div className="dialog-backdrop">
          <section className="conflict-dialog" role="dialog" aria-modal="true">
            <h2>{settings.locale === 'zh-CN' ? '设为默认 Markdown 打开方式？' : 'Set as the default Markdown handler?'}</h2>
            <p>
              {settings.locale === 'zh-CN'
                ? '将 TextMark 设为 .md 文件的默认打开方式，双击即可直接预览。'
                : 'Make TextMark the default opener for .md files so double-clicking opens a preview.'}
            </p>
            <div>
              <button onClick={() => resolveDefaultHandler(false)}>{settings.locale === 'zh-CN' ? '以后再说' : 'Not Now'}</button>
              <button className="destructive" onClick={() => resolveDefaultHandler(true)}>
                {settings.locale === 'zh-CN' ? '设为默认' : 'Set as Default'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <ToolbarCustomizer
        open={toolbarOpen}
        locale={settings.locale}
        items={settings.toolbar}
        displayMode={settings.toolbarDisplay}
        onChange={(toolbar) => patch({ toolbar })}
        onDisplayModeChange={(toolbarDisplay) => patch({ toolbarDisplay })}
        onClose={() => setToolbarOpen(false)}
      />
      <SettingsDialog
        open={settingsOpen}
        initialPane={settingsPane}
        locale={settings.locale}
        crashReports={settings.crashReports}
        crashReportsAvailable={crashReportingAvailable}
        updateChannel={settings.updateChannel}
        autoCheckUpdates={settings.autoCheckUpdates}
        lastUpdateCheckAt={settings.lastUpdateCheckAt}
        updateStatus={updater.status}
        onCheckUpdate={() => void updater.checkNow()}
        onInstallUpdate={() => void updater.install()}
        theme={settings.theme}
        contentWidth={settings.contentWidth}
        editorFontSize={settings.editorFontSize}
        lineHeight={settings.lineHeight}
        pagePaddingHorizontal={settings.pagePaddingHorizontal}
        documentFont={settings.documentFont}
        themePreset={settings.themePreset}
        themeColors={settings.themeColors}
        autoSaveIntervalMinutes={settings.autoSaveIntervalMinutes}
        openDocumentsInTabs={settings.openDocumentsInTabs}
        alwaysOnTop={settings.alwaysOnTop}
        zoom={settings.zoom}
        applications={applications}
        defaultOpenTarget={settings.defaultOpenTarget}
        onLocaleChange={setLocale}
        onCrashReportsChange={(crashReports) => patch({ crashReports })}
        onUpdateChannelChange={(updateChannel) => patch({ updateChannel })}
        onAutoCheckUpdatesChange={(autoCheckUpdates) => patch({ autoCheckUpdates })}
        onThemeChange={setTheme}
        onContentWidthChange={setContentWidth}
        onEditorFontSizeChange={setEditorFontSize}
        onLineHeightChange={setLineHeight}
        onPagePaddingHorizontalChange={setPagePaddingHorizontal}
        onDocumentFontChange={setDocumentFont}
        onThemePresetChange={chooseThemePreset}
        onThemeColorChange={(scheme, slot, color) =>
          patch({ themeColors: { ...settings.themeColors, [scheme]: { ...settings.themeColors[scheme], [slot]: color.toUpperCase() } } })
        }
        onThemeColorsReset={() => patch({ themeColors: {} })}
        onAutoSaveIntervalChange={(autoSaveIntervalMinutes) => patch({ autoSaveIntervalMinutes })}
        onOpenDocumentsInTabsChange={(openDocumentsInTabs) => patch({ openDocumentsInTabs })}
        onAlwaysOnTopChange={(alwaysOnTop) => patch({ alwaysOnTop })}
        onZoomChange={setZoom}
        onDefaultOpenTargetChange={(defaultOpenTarget) => patch({ defaultOpenTarget })}
        onClose={() => {
          setSettingsOpen(false)
        }}
      />
    </main>
  )
}

export default function App() {
  return new URLSearchParams(window.location.search).has('settings') ? <SettingsWindow /> : <DocumentApp />
}
