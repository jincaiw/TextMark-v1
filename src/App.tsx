import { lazy, startTransition, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { openPath as openExternalPath, openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./App.css";
import type { EditorPaneHandle } from "./components/EditorPane";
import { ConflictDialog } from "./components/ConflictDialog";
import { DocumentTabs } from "./components/DocumentTabs";
import { FindBar } from "./components/FindBar";
import { FormattingToolbar } from "./components/FormattingToolbar";
import { Inspector } from "./components/Inspector";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { ToolbarCustomizer } from "./components/ToolbarCustomizer";
import { useDocument } from "./hooks/useDocument";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";
import { useUpdater } from "./hooks/useUpdater";
import { t } from "./lib/i18n";
import { discoverApplications, isTauri, setNativeMenuLocale } from "./lib/platform";
import { editMarkdownTable } from "./lib/table";
import type { ExternalApplication, FormatCommand, RenderedMarkdown, SearchMode, SidebarMode, ViewMode } from "./types";

const EditorPane = lazy(() => import("./components/EditorPane").then((module) => ({ default: module.EditorPane })));
const ZOOM_STOPS = [50, 67, 75, 80, 90, 100, 110, 125, 133, 150, 175, 200, 250, 300];
const nextZoom = (current: number, direction: 1 | -1) => direction > 0 ? ZOOM_STOPS.find((value) => value > current) ?? 300 : [...ZOOM_STOPS].reverse().find((value) => value < current) ?? 50;
const EMPTY_RENDER: RenderedMarkdown = { html: "", outline: [], hasMermaid: false, hasMath: false, frontmatter: [], sourceMap: [], tables: [], tasks: [] };

function App() {
  const { settings, setLocale, setTheme, setContentWidth, setZoom, setEditorFontSize, patch } = useSettings();
  const documents = useDocument(settings.locale);
  const { theme, setTheme: setDocumentTheme } = useTheme();
  const updater = useUpdater(settings.updateChannel);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("outline");
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchCount, setSearchCount] = useState(0);
  const [matchCase, setMatchCase] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("contains");
  const [notice, setNotice] = useState<string | null>(null);
  const [applications, setApplications] = useState<ExternalApplication[]>([]);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const editorRef = useRef<EditorPaneHandle>(null);
  const deferredMarkdown = useDeferredValue(documents.document.contents);
  const [rendered, setRendered] = useState<RenderedMarkdown>(EMPTY_RENDER);
  const renderSequence = useRef(0);
  const stats = useMemo(() => ({
    words: documents.document.contents.trim().split(/\s+/u).filter(Boolean).length,
    characters: documents.document.contents.length,
    lines: documents.document.contents.split(/\r?\n/).length,
    headings: rendered.outline.length,
    links: (documents.document.contents.match(/(?<!!)\[[^\]]*]\([^)]+\)/g) ?? []).length,
    images: (documents.document.contents.match(/!\[[^\]]*]\([^)]+\)/g) ?? []).length,
  }), [documents.document.contents, rendered.outline.length]);
  const resolvedTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  useEffect(() => { setDocumentTheme(settings.theme); }, [settings.theme, setDocumentTheme]);
  useEffect(() => { void setNativeMenuLocale(settings.locale); }, [settings.locale]);
  useEffect(() => { void discoverApplications().then(setApplications); }, []);
  useEffect(() => {
    const id = ++renderSequence.current;
    if (typeof Worker === "undefined") {
      let cancelled = false;
      void import("./lib/markdown").then(({ renderMarkdown }) => {
        if (!cancelled && id === renderSequence.current) startTransition(() => setRendered(renderMarkdown(deferredMarkdown)));
      });
      return () => { cancelled = true; };
    }
    const worker = new Worker(new URL("./workers/render.worker.ts", import.meta.url), { type: "module", name: "textmark-renderer" });
    worker.addEventListener("message", (event: MessageEvent<{ id: number; result?: RenderedMarkdown; error?: string }>) => {
      if (event.data.id !== renderSequence.current || !event.data.result) return;
      void import("./lib/sanitize").then(({ sanitizeRenderedMarkdown }) => {
        if (event.data.id === renderSequence.current) startTransition(() => setRendered(sanitizeRenderedMarkdown(event.data.result!)));
      });
    });
    worker.addEventListener("error", () => {
      void import("./lib/markdown").then(({ renderMarkdown }) => {
        if (id === renderSequence.current) startTransition(() => setRendered(renderMarkdown(deferredMarkdown)));
      });
    }, { once: true });
    worker.postMessage({ id, source: deferredMarkdown });
    return () => worker.terminate();
  }, [deferredMarkdown]);
  useEffect(() => {
    const agent = navigator.userAgent.toLowerCase();
    document.documentElement.dataset.platform = agent.includes("windows") ? "windows" : agent.includes("linux") ? "linux" : "macos";
  }, []);
  useEffect(() => {
    document.documentElement.lang = settings.locale;
    document.title = "TextMark";
    if (isTauri()) void getCurrentWindow().setTitle("TextMark");
  }, [documents.document.name, documents.isDirty, settings.locale]);
  useEffect(() => { if (viewMode === "edit") window.setTimeout(() => editorRef.current?.focus(), 0); }, [viewMode]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 1800); };
  const copySource = async () => { await navigator.clipboard.writeText(documents.document.contents); flash(t(settings.locale, "copied")); };
  const openWith = async (application?: string) => {
    if (!documents.document.path || !isTauri()) { flash(settings.locale === "zh-CN" ? "请先保存文件，再使用外部编辑器打开。" : "Save the file before opening it in another app."); return; }
    try { await openExternalPath(documents.document.path, application); if (application) patch({ defaultOpenTarget: application }); }
    catch { flash(settings.locale === "zh-CN" ? "无法打开所选应用。" : "The selected application could not be opened."); }
  };
  const openInLlm = async (application: "codex" | "claude" | "chatgpt") => {
    await navigator.clipboard.writeText(`${settings.locale === "zh-CN" ? "请审阅此 Markdown 文档" : "Please review this Markdown document"}:\n\n${documents.document.contents}`);
    const scheme = application === "chatgpt" ? "chatgpt://" : `${application}://`;
    try { if (isTauri()) await openUrl(scheme); else window.open(application === "chatgpt" ? "https://chatgpt.com" : application === "claude" ? "https://claude.ai" : "https://chatgpt.com/codex"); }
    catch { flash(t(settings.locale, "copied")); }
  };
  const exportDocument = async (format: "html" | "png") => {
    const root = document.querySelector<HTMLElement>(".markdown-body");
    if (!root) return;
    const exporter = await import("./lib/export");
    if (format === "html") exporter.downloadHtml(documents.document.name, root);
    else await exporter.downloadPng(documents.document.name, root);
  };
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void listen<string>("menu-command", (event) => {
      const command = event.payload;
      if (command === "open") void documents.openFile();
      else if (command === "open-folder") { void documents.openFolder(); setSidebarMode("files"); setSidebarVisible(true); }
      else if (command === "save") void documents.saveFile();
      else if (command === "save-as") void documents.saveAs();
      else if (command === "print") window.print();
      else if (command === "export") void exportDocument("html");
      else if (command === "undo") documents.undo();
      else if (command === "redo") documents.redo();
      else if (command === "find") setFindOpen(true);
      else if (command === "edit-mode") setViewMode((mode) => mode === "edit" ? "preview" : "edit");
      else if (command === "sidebar") setSidebarVisible((value) => !value);
      else if (command === "inspector") setInspectorVisible((value) => !value);
      else if (command === "zoom-in") setZoom(nextZoom(settings.zoom, 1));
      else if (command === "zoom-out") setZoom(nextZoom(settings.zoom, -1));
      else if (command === "zoom-reset") setZoom(100);
      else if (command === "customize-toolbar") setToolbarOpen(true);
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [documents, setZoom, settings.zoom]);
  const toggleTask = (targetIndex: number, checked: boolean) => {
    let index = -1;
    documents.applyEdit(documents.document.contents.replace(/^(\s*[-+*]\s+\[)([ xX])(\])/gm, (match, before: string, _state: string, after: string) => {
      index += 1;
      return index === targetIndex ? `${before}${checked ? "x" : " "}${after}` : match;
    }));
  };
  const format = (command: FormatCommand) => { setViewMode("edit"); window.setTimeout(() => editorRef.current?.format(command), 0); };
  const nextMatch = (direction: 1 | -1) => setSearchIndex((current) => searchCount ? (current + direction + searchCount) % searchCount : 0);
  const previewScrollTop = () => document.querySelector<HTMLElement>(".preview-pane")?.scrollTop ?? 0;

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement;
      const isTyping = target.matches("input, textarea, select, [contenteditable=true]");
      if (event.key === "Escape" && findOpen) { event.preventDefault(); setFindOpen(false); return; }
      if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); void documents.goBack(previewScrollTop()); return; }
      if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); void documents.goForward(previewScrollTop()); return; }
      if (!modifier && viewMode === "preview" && !isTyping) {
        const pane = document.querySelector<HTMLElement>(".preview-pane");
        if (event.key === "j" || event.key === "k") { event.preventDefault(); pane?.scrollBy({ top: event.key === "j" ? 42 : -42, behavior: "smooth" }); }
        else if (event.key === " ") { event.preventDefault(); pane?.scrollBy({ top: (event.shiftKey ? -1 : 1) * Math.max(200, (pane.clientHeight ?? 600) - 80), behavior: "smooth" }); }
        return;
      }
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "s") { event.preventDefault(); void documents.saveFile(); }
      else if (key === "o" && event.shiftKey) { event.preventDefault(); void documents.openFolder(); setSidebarMode("files"); setSidebarVisible(true); }
      else if (key === "o") { event.preventDefault(); void documents.openFile(); }
      else if (key === "e") { event.preventDefault(); setViewMode((mode) => mode === "edit" ? "preview" : "edit"); }
      else if (key === "l") { event.preventDefault(); setSidebarVisible((value) => !value); }
      else if (key === "f") { event.preventDefault(); setFindOpen(true); }
      else if (key === "g") { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1); }
      else if (key === "p") { event.preventDefault(); window.print(); }
      else if (key === "0") { event.preventDefault(); setZoom(100); }
      else if (key === "+" || key === "=") { event.preventDefault(); setZoom(nextZoom(settings.zoom, 1)); }
      else if (key === "-") { event.preventDefault(); setZoom(nextZoom(settings.zoom, -1)); }
      else if (key === "z" && viewMode === "preview") { event.preventDefault(); event.shiftKey ? documents.redo() : documents.undo(); }
      else if (key === "b") { event.preventDefault(); format("bold"); }
      else if (key === "i") { event.preventDefault(); format("italic"); }
      else if (key === "k") { event.preventDefault(); format("link"); }
      else if (key === "[") { event.preventDefault(); void documents.goBack(previewScrollTop()); }
      else if (key === "]") { event.preventDefault(); void documents.goForward(previewScrollTop()); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [documents, findOpen, searchCount, setZoom, settings.zoom, viewMode]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (documents.sessions.some((session) => session.dirty)) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [documents.sessions]);

  const chooseSidebarMode = (mode: SidebarMode) => { setSidebarMode(mode); setSidebarVisible(true); };
  return <main className={`app-shell native-shell mode-${viewMode}`}>
    <Toolbar fileName={documents.document.name} dirty={documents.isDirty} busy={documents.busy} viewMode={viewMode} locale={settings.locale} items={settings.toolbar} applications={applications}
      canGoBack={documents.canGoBack} canGoForward={documents.canGoForward} onBack={() => void documents.goBack(previewScrollTop())} onForward={() => void documents.goForward(previewScrollTop())}
      sidebarVisible={sidebarVisible} sidebarMode={sidebarMode} inspectorVisible={inspectorVisible} zoom={settings.zoom} searchQuery={searchQuery}
      onToggleSidebar={() => setSidebarVisible((value) => !value)} onSidebarModeChange={chooseSidebarMode} onViewModeChange={setViewMode}
      onToggleInspector={() => setInspectorVisible((value) => !value)} onZoomChange={setZoom}
      onSearchQueryChange={(value) => { setSearchQuery(value); setSearchIndex(0); setFindOpen(true); }} onSearchOpen={() => setFindOpen(true)}
      onOpenWith={(application) => void openWith(application)} onOpenInLlm={(application) => void openInLlm(application)}
      onOpen={() => void documents.openFile()} onOpenFolder={() => { void documents.openFolder(); setSidebarMode("files"); setSidebarVisible(true); }}
      onSave={() => void documents.saveFile()} onSaveAs={() => void documents.saveAs()} onShare={() => void copySource()} onPrint={() => window.print()}
      onExportHtml={() => void exportDocument("html")} onExportPng={() => void exportDocument("png")} onSettings={() => setSettingsOpen(true)} onCustomizeToolbar={() => setToolbarOpen(true)} />
    {viewMode === "edit" ? <FormattingToolbar locale={settings.locale} onFormat={format} /> : null}
    {findOpen ? <FindBar locale={settings.locale} query={searchQuery} current={searchIndex} count={searchCount} matchCase={matchCase} mode={searchMode}
      onQueryChange={(value) => { setSearchQuery(value); setSearchIndex(0); }} onPrevious={() => nextMatch(-1)} onNext={() => nextMatch(1)}
      onMatchCaseChange={setMatchCase} onModeChange={setSearchMode} onClose={() => setFindOpen(false)} /> : null}
    <div className="workspace-stack">
      <DocumentTabs sessions={documents.sessions} activeId={documents.activeId} locale={settings.locale} onActivate={(id) => documents.activate(id, previewScrollTop())} onClose={documents.closeSession} />
      <div className={`document-shell ${sidebarVisible ? "with-sidebar" : ""} ${inspectorVisible ? "with-inspector" : ""}`}>
        {sidebarVisible ? <Sidebar locale={settings.locale} mode={sidebarMode} fileName={documents.document.name} files={documents.files} workspacePath={documents.workspacePath} activePath={documents.document.path} outline={rendered.outline} onModeChange={chooseSidebarMode} onOpenFolder={() => void documents.openFolder()} onOpenFile={(path) => void documents.openPath(path)} onOutlineSelect={(id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} /> : null}
        <div className="document-workspace">
          {viewMode === "edit" ? <Suspense fallback={<div className="editor-loading" />}><EditorPane ref={editorRef} value={documents.document.contents} theme={resolvedTheme} fontSize={settings.editorFontSize} zoom={settings.zoom} contentWidth={settings.contentWidth} onChange={documents.updateContents} onCursorChange={(line, column) => setCursor({ line, column })} /></Suspense>
            : <PreviewPane locale={settings.locale} rendered={rendered} documentKey={`${documents.document.id}:${documents.document.path ?? documents.document.name}`} initialScrollTop={documents.document.scrollTop} baseDirectory={documents.baseDirectory} workspacePath={documents.workspacePath} zoom={settings.zoom} contentWidth={settings.contentWidth} searchQuery={searchQuery} searchIndex={searchIndex} matchCase={matchCase} searchMode={searchMode} onSearchCount={setSearchCount} onOpenRelative={(path) => void documents.openRelative(path, previewScrollTop())} onToggleTask={toggleTask} onEditTable={(table, row, column, request) => documents.applyEdit(editMarkdownTable(documents.document.contents, table, row, column, request))} />}
          {viewMode === "edit" ? <div className="editor-status" aria-label={`Line ${cursor.line}, column ${cursor.column}`} /> : null}
        </div>
        {inspectorVisible ? <Inspector locale={settings.locale} document={documents.document} stats={stats} frontmatter={rendered.frontmatter} onClose={() => setInspectorVisible(false)} /> : null}
      </div>
    </div>
    {notice || documents.notice ? <div className="toast" role="status">{notice ?? documents.notice}</div> : null}
    <ConflictDialog open={Boolean(documents.externalChange)} locale={settings.locale} onResolve={documents.resolveExternal} />
    <ToolbarCustomizer open={toolbarOpen} locale={settings.locale} items={settings.toolbar} onChange={(toolbar) => patch({ toolbar })} onClose={() => setToolbarOpen(false)} />
    <SettingsDialog open={settingsOpen} locale={settings.locale} crashReports={settings.crashReports} crashReportsAvailable={Boolean(import.meta.env.VITE_SENTRY_DSN)} updateChannel={settings.updateChannel}
      updateStatus={updater.status} onCheckUpdate={() => void updater.checkNow()} onInstallUpdate={() => void updater.install()}
      theme={theme} contentWidth={settings.contentWidth} editorFontSize={settings.editorFontSize} onLocaleChange={setLocale}
      onCrashReportsChange={(crashReports) => patch({ crashReports })} onUpdateChannelChange={(updateChannel) => patch({ updateChannel })}
      onThemeChange={setTheme} onContentWidthChange={setContentWidth} onEditorFontSizeChange={setEditorFontSize} onClose={() => setSettingsOpen(false)} />
  </main>;
}

export default App;
