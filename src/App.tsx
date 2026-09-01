import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { openPath as openExternalPath, openUrl } from '@tauri-apps/plugin-opener'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './App.css'
import type { EditorPaneHandle } from './components/EditorPane'
import { ConflictDialog } from './components/ConflictDialog'
import { DocumentTabs } from './components/DocumentTabs'
import { ExportDialog } from './components/ExportDialog'
import { FindBar } from './components/FindBar'
import { FormattingToolbar } from './components/FormattingToolbar'
import { Inspector } from './components/Inspector'
import { PreviewPane } from './components/PreviewPane'
import { SettingsDialog } from './components/SettingsDialog'
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
import { resolveAlwaysOnTopTransition } from './lib/alwaysOnTop'
import { t } from './lib/i18n'
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
import { editMarkdownTable } from './lib/table'
import { setTaskChecked } from './lib/task'
import { configureCrashReporting, crashReportingAvailable } from './lib/telemetry'
import { applyUpstreamDocumentTokens } from './lib/designTokens'
import { applyThemeColors, THEME_PRESETS } from './lib/theme'
import { shareMarkdownSource } from './lib/share'
import type { ExternalApplication, FormatCommand, SearchMode, SidebarMode, ViewMode } from './types'

const EditorPane = lazy(() => import('./components/EditorPane').then((module) => ({ default: module.EditorPane })))
import { nextZoomStep as nextZoom } from './constants'
function DocumentApp() {
  const { settings, setLocale, setTheme, setContentWidth, setZoom, setEditorFontSize, setDocumentFont, patch } = useSettings()
  const documents = useDocument(settings.locale, {
    autoSaveIntervalMinutes: settings.autoSaveIntervalMinutes,
    openDocumentsInTabs: settings.openDocumentsInTabs,
  })
  const updater = useUpdater(settings.updateChannel, settings.autoCheckUpdates, (lastUpdateCheckAt) => patch({ lastUpdateCheckAt }))
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('outline')
  const [inspectorVisible, setInspectorVisible] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [pendingFormat, setPendingFormat] = useState<FormatCommand | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [searchCount, setSearchCount] = useState(0)
  const [matchCase, setMatchCase] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('contains')
  const [notice, setNotice] = useState<string | null>(null)
  const [applications, setApplications] = useState<ExternalApplication[]>([])
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const editorRef = useRef<EditorPaneHandle>(null)
  const invalidDeepLinkTimerRef = useRef(0)
  const rendered = useMarkdownRenderer(documents.document.contents, settings.locale)
  useTextmarkDeepLinks(documents.openPath, () => {
    setNotice(
      settings.locale === 'zh-CN'
        ? '无法打开此 TextMark 链接。请使用 textmark://file/<绝对路径>。'
        : 'This TextMark link is invalid. Use textmark://file/<absolute path>.',
    )
    window.clearTimeout(invalidDeepLinkTimerRef.current)
    invalidDeepLinkTimerRef.current = window.setTimeout(() => setNotice(null), 4_000)
  })
  const hydratedPreviewKeyRef = useRef<string | null>(null)
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

  const waitForPreviewHydration = async () => {
    const key = previewRenderKey
    if (hydratedPreviewKeyRef.current === key) return
    await new Promise<void>((resolve) => {
      const complete = (event: Event) => {
        if ((event as CustomEvent<string>).detail !== key) return
        window.removeEventListener('textmark-preview-hydrated', complete)
        window.clearTimeout(timeout)
        resolve()
      }
      // A timeout avoids trapping a user action when a third-party diagram or
      // a broken image never settles. The export still captures the best
      // available preview in that case.
      const timeout = window.setTimeout(() => {
        window.removeEventListener('textmark-preview-hydrated', complete)
        resolve()
      }, 8_000)
      window.addEventListener('textmark-preview-hydrated', complete)
    })
  }
  const markPreviewHydrated = (key: string) => {
    hydratedPreviewKeyRef.current = key
    window.dispatchEvent(new CustomEvent('textmark-preview-hydrated', { detail: key }))
  }

  useEffect(() => {
    void configureCrashReporting(settings.crashReports)
  }, [settings.crashReports])
  useEffect(() => {
    applyUpstreamDocumentTokens(document.documentElement, settings.documentFont)
  }, [settings.documentFont])
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
    if (viewMode === 'edit') window.setTimeout(() => editorRef.current?.focus(), 0)
  }, [documents.activeId, viewMode])

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
  // Hand the reading position between the preview and the editor on mode
  // switches (upstream restores the exact scroll anchor across the crossfade).
  const switchViewMode = (mode: ViewMode) => {
    if (mode === viewMode) return
    if (mode === 'edit') setPendingScrollFraction(previewFraction())
    else setPendingScrollFraction(editorRef.current?.getScrollFraction() ?? 0)
    setViewMode(mode)
  }
  const createNewDocument = () => {
    documents.newDocument()
    setPendingScrollFraction(0)
    setViewMode('edit')
  }
  useEffect(() => {
    if (pendingScrollFraction != null) setPendingScrollFraction(null)
  }, [pendingScrollFraction])
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
  const openSettings = () => {
    // Use the already-loaded document WebView on Windows. On some WebView2
    // runtimes a freshly-created secondary settings window can show only a
    // blank surface, making Settings and menu commands appear broken.
    if (shouldUseDedicatedSettingsWindow()) {
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
    if (!documents.document.path || !isTauri()) {
      flash(settings.locale === 'zh-CN' ? '请先保存文件，再使用外部编辑器打开。' : 'Save the file before opening it in another app.')
      return
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
  const exportDocument = async (format: 'html' | 'png') => {
    await waitForPreviewHydration()
    const root = document.querySelector<HTMLElement>('.markdown-body')
    if (!root) return
    const exporter = await import('./lib/export')
    try {
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
    }
  }
  const exportPdf = async () => {
    // macOS's print dialog provides the native “Save as PDF” workflow and
    // preserves selectable text/vector diagrams. Keep the byte-export path
    // for browser and non-macOS desktop runtimes.
    if (isTauri() && isMacos()) {
      await printDocument(true)
      return
    }
    await waitForPreviewHydration()
    const root = document.querySelector<HTMLElement>('.markdown-body')
    if (!root) return
    try {
      const exporter = await import('./lib/export')
      if (!isTauri()) {
        await exporter.downloadPdf(documents.document.name, root)
        return
      }
      const { name, bytes } = await exporter.buildPdfExport(documents.document.name, root)
      if (await saveExportFile(name, bytes, 'PDF', ['pdf'])) flash(t(settings.locale, 'exported'))
    } catch {
      flash(settings.locale === 'zh-CN' ? '导出失败。' : 'Export failed.')
    }
  }
  const printDocument = async (exportingPdf = false) => {
    const html = document.documentElement
    const previousPdfMode = html.getAttribute('data-export-pdf')
    if (exportingPdf) html.dataset.exportPdf = '1'
    try {
      // Use Wry's native macOS print dialog first. Its “Save as PDF” path keeps
      // text and vector diagrams selectable instead of flattening the page.
      if (isTauri() && isMacos()) {
        await waitForPreviewHydration()
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
      await waitForPreviewHydration()
      window.print()
    } finally {
      if (exportingPdf) {
        if (previousPdfMode === null) html.removeAttribute('data-export-pdf')
        else html.setAttribute('data-export-pdf', previousPdfMode)
      }
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
    else if (command === 'check-updates') {
      openSettings()
      void updater.checkNow()
    } else if (command === 'install-cli') installCliAction()
    else if (command === 'crash-reports') patch({ crashReports: !settings.crashReports })
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
          void documents.goBack(previewScrollTop())
          return
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          void documents.goForward(previewScrollTop())
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
        void documents.goBack(previewScrollTop())
      } else if (key === ']') {
        event.preventDefault()
        void documents.goForward(previewScrollTop())
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

  const chooseSidebarMode = (mode: SidebarMode) => {
    setSidebarMode(mode)
    setSidebarVisible(true)
  }
  return (
    <main className={`app-shell native-shell mode-${viewMode} ${toolbarVisible ? '' : 'toolbar-hidden'}`}>
      <Toolbar
        fileName={documents.document.name}
        busy={documents.busy}
        viewMode={viewMode}
        locale={settings.locale}
        items={settings.toolbar}
        displayMode={settings.toolbarDisplay}
        applications={applications}
        defaultOpenTarget={settings.defaultOpenTarget}
        canGoBack={documents.canGoBack}
        canGoForward={documents.canGoForward}
        onBack={() => void documents.goBack(previewScrollTop())}
        onForward={() => void documents.goForward(previewScrollTop())}
        sidebarVisible={sidebarVisible}
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
        onSettings={openSettings}
        onCustomizeToolbar={() => setToolbarOpen(true)}
      />
      {findOpen ? (
        <FindBar
          locale={settings.locale}
          query={searchQuery}
          current={searchIndex}
          count={searchCount}
          matchCase={matchCase}
          mode={searchMode}
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
      <div className="workspace-stack">
        <DocumentTabs
          sessions={documents.sessions}
          activeId={documents.activeId}
          locale={settings.locale}
          onActivate={(id) => documents.activate(id, previewScrollTop())}
          onClose={documents.closeSession}
        />
        <div className={`document-shell ${sidebarVisible ? 'with-sidebar' : ''} ${inspectorVisible ? 'with-inspector' : ''}`}>
          {sidebarVisible ? (
            <Sidebar
              locale={settings.locale}
              mode={sidebarMode}
              fileName={documents.document.name}
              files={documents.files}
              workspacePath={documents.workspacePath}
              activePath={documents.document.path}
              outline={rendered.outline}
              activeHeading={activeHeading}
              applications={applications}
              defaultOpenTarget={settings.defaultOpenTarget}
              onModeChange={chooseSidebarMode}
              onOpenFolder={() => void documents.openFolder()}
              onOpenFile={(path) => void documents.openWorkspacePath(path, previewScrollTop())}
              onOpenFileInTab={(path) => void documents.openPath(path, true)}
              onOpenFileInWindow={(path) => void openDocumentWindow(path)}
              onOpenFileWith={openFileWith}
              onRevealFile={(path) => void revealInFileManager(path)}
              onCopyFilePath={(path) => void navigator.clipboard.writeText(path)}
              onCopyFileContents={(path) => void readDocument(path).then((file) => navigator.clipboard.writeText(file.contents))}
              onOutlineSelect={(id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          ) : null}
          <div className="document-workspace">
            {viewMode === 'edit' ? <FormattingToolbar locale={settings.locale} onFormat={format} /> : null}
            {viewMode === 'edit' ? (
              <Suspense fallback={<div className="editor-loading" />}>
                <EditorPane
                  ref={editorRef}
                  value={documents.document.contents}
                  theme={resolvedTheme}
                  fontSize={settings.editorFontSize}
                  zoom={settings.zoom}
                  contentWidth={settings.contentWidth}
                  initialScrollFraction={pendingScrollFraction ?? undefined}
                  initialFormat={pendingFormat}
                  onInitialFormatApplied={() => setPendingFormat(null)}
                  onChange={documents.updateContents}
                  onPasteImage={documents.pasteImage}
                  baseDirectory={documents.baseDirectory}
                  workspacePath={documents.workspacePath}
                  onRenameImage={(path) => void documents.renamePastedImage(path)}
                  onCursorChange={(line, column) => setCursor({ line, column })}
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
            <Inspector
              locale={settings.locale}
              document={documents.document}
              stats={stats}
              frontmatter={rendered.frontmatter}
              onCopyPath={(path) => void navigator.clipboard.writeText(path)}
              onRevealPath={(path) => void revealInFileManager(path)}
              onClose={() => setInspectorVisible(false)}
            />
          ) : null}
        </div>
      </div>
      {notice || documents.notice ? (
        <div className="toast" role="status">
          {notice ?? documents.notice}
        </div>
      ) : null}
      <ConflictDialog change={documents.externalChange} locale={settings.locale} onResolve={documents.resolveExternal} />
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
        onDocumentFontChange={setDocumentFont}
        onThemePresetChange={(themePreset) => {
          const flavor = THEME_PRESETS[themePreset].flavor
          patch({ themePreset, theme: flavor === 'system' ? 'system' : flavor, themeColors: {} })
        }}
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
