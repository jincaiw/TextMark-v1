import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { openPath as openExternalPath, openUrl } from "@tauri-apps/plugin-opener";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./App.css";
import { EditorPane, type EditorPaneHandle } from "./components/EditorPane";
import { FindBar } from "./components/FindBar";
import { FormattingToolbar } from "./components/FormattingToolbar";
import { Inspector } from "./components/Inspector";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { useDocument } from "./hooks/useDocument";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { t } from "./lib/i18n";
import { isTauri } from "./lib/platform";
import { renderMarkdown } from "./lib/markdown";
import { editMarkdownTable } from "./lib/table";
import { downloadHtml } from "./lib/export";
import type { FormatCommand, SidebarMode, ViewMode } from "./types";

function App() {
  const documents = useDocument();
  const { theme, setTheme: setDocumentTheme } = useTheme();
  const { settings, setLocale, setTheme, setContentWidth, setZoom, setEditorFontSize, patch } = useSettings();
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("outline");
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchCount, setSearchCount] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const editorRef = useRef<EditorPaneHandle>(null);
  const deferredMarkdown = useDeferredValue(documents.document.contents);
  const rendered = useMemo(() => renderMarkdown(deferredMarkdown), [deferredMarkdown]);
  const stats = useMemo(() => ({
    words: documents.document.contents.trim().split(/\s+/u).filter(Boolean).length,
    characters: documents.document.contents.length,
    lines: documents.document.contents.split(/\r?\n/).length,
  }), [documents.document.contents]);
  const resolvedTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  useEffect(() => { setDocumentTheme(settings.theme); }, [settings.theme, setDocumentTheme]);
  useEffect(() => { document.documentElement.lang = settings.locale; document.title = `${documents.document.name}${documents.isDirty ? ` — ${t(settings.locale, "edited")}` : ""} — TextMark`; }, [documents.document.name, documents.isDirty, settings.locale]);
  useEffect(() => { if (viewMode === "edit") window.setTimeout(() => editorRef.current?.focus(), 0); }, [viewMode]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 1800); };
  const copySource = async () => { await navigator.clipboard.writeText(documents.document.contents); flash("Markdown source copied"); };
  const openWith = async (application?: string) => {
    if (!documents.document.path || !isTauri()) { flash("Open a saved file to use an external editor"); return; }
    try { await openExternalPath(documents.document.path, application); } catch (error) { flash(String(error)); }
  };
  const openInLlm = async (application: "codex" | "claude" | "chatgpt") => {
    await navigator.clipboard.writeText(`Please review this Markdown document:\n\n${documents.document.contents}`);
    const scheme = application === "chatgpt" ? "chatgpt://" : `${application}://`;
    try { if (isTauri()) await openUrl(scheme); else window.open(application === "chatgpt" ? "https://chatgpt.com" : application === "claude" ? "https://claude.ai" : "https://chatgpt.com/codex"); }
    catch { flash(`Prompt copied. Open ${application} and paste.`); }
  };
  const toggleTask = (targetIndex: number, checked: boolean) => {
    let index = -1;
    documents.updateContents(documents.document.contents.replace(/^(\s*[-+*]\s+\[)([ xX])(\])/gm, (match, before: string, _state: string, after: string) => {
      index += 1;
      return index === targetIndex ? `${before}${checked ? "x" : " "}${after}` : match;
    }));
  };
  const format = (command: FormatCommand) => { setViewMode("edit"); window.setTimeout(() => editorRef.current?.format(command), 0); };
  const nextMatch = (direction: 1 | -1) => setSearchIndex((current) => searchCount ? (current + direction + searchCount) % searchCount : 0);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (event.key === "Escape" && findOpen) { event.preventDefault(); setFindOpen(false); return; }
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "s") { event.preventDefault(); void documents.saveFile(); }
      else if (key === "o" && event.shiftKey) { event.preventDefault(); void documents.openFolder(); setSidebarMode("files"); setSidebarVisible(true); }
      else if (key === "o") { event.preventDefault(); void documents.openFile(); }
      else if (key === "e") { event.preventDefault(); setViewMode((mode) => mode === "edit" ? "preview" : "edit"); }
      else if (key === "f") { event.preventDefault(); setFindOpen(true); }
      else if (key === "g") { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1); }
      else if (key === "p") { event.preventDefault(); window.print(); }
      else if (key === "0") { event.preventDefault(); setZoom(100); }
      else if (key === "+" || key === "=") { event.preventDefault(); setZoom(settings.zoom + 10); }
      else if (key === "-") { event.preventDefault(); setZoom(settings.zoom - 10); }
      else if (key === "b") { event.preventDefault(); format("bold"); }
      else if (key === "i") { event.preventDefault(); format("italic"); }
      else if (key === "k") { event.preventDefault(); format("link"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [documents.openFile, documents.openFolder, documents.saveFile, findOpen, searchCount, setZoom, settings.zoom]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (documents.isDirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [documents.isDirty]);

  const chooseSidebarMode = (mode: SidebarMode) => { setSidebarMode(mode); setSidebarVisible(true); };
  return (
    <main className={`app-shell native-shell mode-${viewMode}`}>
      <Toolbar
        fileName={documents.document.name} dirty={documents.isDirty} busy={documents.busy} viewMode={viewMode} locale={settings.locale}
        sidebarVisible={sidebarVisible} sidebarMode={sidebarMode} inspectorVisible={inspectorVisible} zoom={settings.zoom} searchQuery={searchQuery}
        onToggleSidebar={() => setSidebarVisible((value) => !value)} onSidebarModeChange={chooseSidebarMode} onViewModeChange={setViewMode}
        onToggleInspector={() => setInspectorVisible((value) => !value)} onZoomChange={setZoom}
        onSearchQueryChange={(value) => { setSearchQuery(value); setSearchIndex(0); setFindOpen(true); }} onSearchOpen={() => setFindOpen(true)}
        onOpenWith={(application) => void openWith(application)} onOpenInLlm={(application) => void openInLlm(application)}
        onOpen={() => void documents.openFile()} onOpenFolder={() => { void documents.openFolder(); setSidebarMode("files"); setSidebarVisible(true); }}
        onSave={() => void documents.saveFile()} onSaveAs={() => void documents.saveAs()} onShare={() => void copySource()} onPrint={() => window.print()} onExportHtml={() => downloadHtml(documents.document.name, rendered)} onSettings={() => setSettingsOpen(true)}
      />
      {viewMode === "edit" ? <FormattingToolbar onFormat={format} /> : null}
      {findOpen ? <FindBar query={searchQuery} current={searchIndex} count={searchCount} caseSensitive={caseSensitive} wholeWord={wholeWord} onQueryChange={(value) => { setSearchQuery(value); setSearchIndex(0); }} onPrevious={() => nextMatch(-1)} onNext={() => nextMatch(1)} onCaseSensitiveChange={setCaseSensitive} onWholeWordChange={setWholeWord} onClose={() => setFindOpen(false)} /> : null}
      <div className={`document-shell ${sidebarVisible ? "with-sidebar" : ""} ${inspectorVisible ? "with-inspector" : ""}`}>
        {sidebarVisible ? <Sidebar locale={settings.locale} mode={sidebarMode} fileName={documents.document.name} files={documents.files} workspacePath={documents.workspacePath} activePath={documents.document.path} outline={rendered.outline} onModeChange={chooseSidebarMode} onOpenFolder={() => void documents.openFolder()} onOpenFile={(path) => void documents.openPath(path)} onOutlineSelect={(id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} /> : null}
        <div className="document-workspace">
          {viewMode === "edit" ? <EditorPane ref={editorRef} value={documents.document.contents} theme={resolvedTheme} fontSize={settings.editorFontSize} zoom={settings.zoom} contentWidth={settings.contentWidth} onChange={documents.updateContents} onCursorChange={(line, column) => setCursor({ line, column })} /> : <PreviewPane rendered={rendered} baseDirectory={documents.baseDirectory} zoom={settings.zoom} contentWidth={settings.contentWidth} searchQuery={searchQuery} searchIndex={searchIndex} caseSensitive={caseSensitive} wholeWord={wholeWord} onSearchCount={setSearchCount} onOpenRelative={(path) => void documents.openRelative(path)} onToggleTask={toggleTask} onEditTable={(table, row, column, edit) => documents.updateContents(editMarkdownTable(documents.document.contents, table, row, column, edit))} />}
          {viewMode === "edit" ? <div className="editor-status" aria-label={`Line ${cursor.line}, column ${cursor.column}`} /> : null}
        </div>
        {inspectorVisible ? <Inspector document={documents.document} stats={stats} frontmatter={rendered.frontmatter} onClose={() => setInspectorVisible(false)} /> : null}
      </div>
      {notice || documents.notice ? <div className="toast" role="status">{notice ?? documents.notice}</div> : null}
      <SettingsDialog open={settingsOpen} locale={settings.locale} crashReports={settings.crashReports} theme={theme} contentWidth={settings.contentWidth} editorFontSize={settings.editorFontSize} onLocaleChange={setLocale} onCrashReportsChange={(crashReports) => patch({ crashReports })} onThemeChange={setTheme} onContentWidthChange={setContentWidth} onEditorFontSizeChange={setEditorFontSize} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

export default App;
