import { AppWindow, ChevronDown, Clipboard, Download, FileDown, FilePenLine, FolderOpen, Info, Minus, MoreHorizontal, PanelLeft, Plus, Printer, Save, Search, Settings, Share, Sparkles } from "lucide-react";
import type { SidebarMode, ViewMode } from "../types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../lib/platform";
import { t } from "../lib/i18n";
import type { Locale } from "../types";

interface ToolbarProps {
  fileName: string;
  dirty: boolean;
  busy: boolean;
  viewMode: ViewMode;
  sidebarVisible: boolean;
  sidebarMode: SidebarMode;
  inspectorVisible: boolean;
  zoom: number;
  searchQuery: string;
  locale: Locale;
  onToggleSidebar: () => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleInspector: () => void;
  onZoomChange: (zoom: number) => void;
  onSearchQueryChange: (value: string) => void;
  onSearchOpen: () => void;
  onOpenWith: (application?: string) => void;
  onOpenInLlm: (application: "codex" | "claude" | "chatgpt") => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onShare: () => void;
  onPrint: () => void;
  onExportHtml: () => void;
  onSettings: () => void;
}

export function Toolbar(props: ToolbarProps) {
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key);
  const windowAction = (action: "close" | "minimize" | "toggleMaximize") => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    if (action === "close") void window.close();
    else if (action === "minimize") void window.minimize();
    else void window.toggleMaximize();
  };
  return (
    <header className="native-toolbar" data-tauri-drag-region>
      <div className="window-leading" data-tauri-drag-region>
        <div className="traffic-lights"><button aria-label={tx("close")} onClick={() => windowAction("close")} /><button aria-label="Minimize window" onClick={() => windowAction("minimize")} /><button aria-label="Maximize window" onClick={() => windowAction("toggleMaximize")} /></div>
        <div className="sidebar-control">
          <button className={props.sidebarVisible ? "selected" : ""} title="Toggle Sidebar" onClick={props.onToggleSidebar}><PanelLeft /></button>
          <details>
            <summary aria-label="Choose sidebar mode"><ChevronDown /></summary>
            <div className="menu-popover sidebar-menu">
              <button onClick={() => props.onSidebarModeChange("outline")}>{tx("tableOfContents")}</button>
              <button onClick={() => props.onSidebarModeChange("files")}>{tx("projectNavigator")}</button>
            </div>
          </details>
        </div>
      </div>

      <strong className="native-title">{props.fileName}{props.dirty ? " — Edited" : ""}</strong>

      <div className="native-actions">
        <details className="toolbar-group open-with">
          <summary title="Open With"><AppWindow /><ChevronDown /></summary>
          <div className="menu-popover">
            <b>{tx("openWith")}</b>
            <button onClick={() => props.onOpenWith()}>{tx("systemDefault")}</button>
            <button onClick={() => props.onOpenWith("Visual Studio Code")}>Visual Studio Code</button>
            <button onClick={() => props.onOpenWith("Cursor")}>Cursor</button>
            <button onClick={() => props.onOpenWith("Zed")}>Zed</button>
            <hr />
            <b>Open in LLM</b>
            <button onClick={() => props.onOpenInLlm("codex")}><Sparkles />Codex</button>
            <button onClick={() => props.onOpenInLlm("claude")}><Sparkles />Claude</button>
            <button onClick={() => props.onOpenInLlm("chatgpt")}><Sparkles />ChatGPT</button>
          </div>
        </details>

        <div className="toolbar-group zoom-buttons" aria-label={`Zoom ${props.zoom}%`}>
          <button title="Zoom Out" onClick={() => props.onZoomChange(Math.max(50, props.zoom - 10))}><span>A</span><Minus /></button>
          <button title="Zoom In" onClick={() => props.onZoomChange(Math.min(300, props.zoom + 10))}><span>A</span><Plus /></button>
        </div>

        <div className="toolbar-group document-actions">
          <button className={props.inspectorVisible ? "selected" : ""} title="Get Info" onClick={props.onToggleInspector}><Info /></button>
          <button title="Share Markdown Source" onClick={props.onShare}><Share /></button>
          <button className={props.viewMode === "edit" ? "edit-active" : ""} title="Toggle Edit Mode (Ctrl/⌘ E)" onClick={() => props.onViewModeChange(props.viewMode === "edit" ? "preview" : "edit")}><FilePenLine /></button>
        </div>

        <label className="document-search"><Search /><input value={props.searchQuery} onFocus={props.onSearchOpen} onChange={(event) => props.onSearchQueryChange(event.target.value)} placeholder={tx("search")} /></label>

        <details className="more-menu">
          <summary title="More"><MoreHorizontal /></summary>
          <div className="menu-popover align-right">
            <button onClick={props.onOpen}><FolderOpen />{tx("openFile")}</button>
            <button onClick={props.onOpenFolder}><FolderOpen />{tx("openFolder")}</button>
            <button onClick={props.onSave} disabled={props.busy}><Save />{tx("save")}</button>
            <button onClick={props.onSaveAs}><Download />{tx("saveAs")}</button>
            <hr />
            <button onClick={props.onShare}><Clipboard />{tx("copySource")}</button>
            <button onClick={props.onPrint}><Printer />{tx("print")}</button>
            <button onClick={props.onExportHtml}><FileDown />{tx("exportHtml")}</button>
            <hr />
            <button onClick={props.onSettings}><Settings />{tx("preferences")}…</button>
          </div>
        </details>
      </div>
    </header>
  );
}
