import { useState } from "react";
import { AppWindow, Check, ChevronDown, ChevronLeft, ChevronRight, Clipboard, Download, FileDown, FilePenLine, FolderOpen, Info, Minus, MoreHorizontal, PanelLeft, Plus, Printer, Save, Search, Settings, Share, Sparkles } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../lib/platform";
import { t } from "../lib/i18n";
import { nextZoomStep } from "../constants";
import type { ExternalApplication, Locale, SidebarMode, ToolbarDisplayMode, ToolbarItem, ViewMode } from "../types";

interface ToolbarProps {
  fileName: string; dirty: boolean; busy: boolean; viewMode: ViewMode; sidebarVisible: boolean; sidebarMode: SidebarMode;
  inspectorVisible: boolean; zoom: number; searchQuery: string; locale: Locale; items: ToolbarItem[]; displayMode: ToolbarDisplayMode;
  applications: ExternalApplication[]; defaultOpenTarget: string;
  canGoBack: boolean; canGoForward: boolean; onBack: () => void; onForward: () => void;
  onToggleSidebar: () => void; onSidebarModeChange: (mode: SidebarMode) => void; onViewModeChange: (mode: ViewMode) => void;
  onToggleInspector: () => void; onZoomChange: (zoom: number) => void; onSearchQueryChange: (value: string) => void; onSearchOpen: () => void;
  onOpenWith: (application?: string) => void; onOpenInLlm: (application: "codex" | "claude" | "chatgpt") => void;
  onOpen: () => void; onOpenFolder: () => void; onSave: () => void; onSaveAs: () => void; onShare: () => void; onCopy: () => void; onPrint: () => void;
  onExportHtml: () => void; onExportPng: () => void; onExportPdf: () => void; onExport: () => void; onSettings: () => void; onCustomizeToolbar: () => void;
}

export function Toolbar(props: ToolbarProps) {
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const windowAction = (action: "close" | "minimize" | "toggleMaximize") => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    if (action === "close") void window.close();
    else if (action === "minimize") void window.minimize();
    else void window.toggleMaximize();
  };

  const editorApps = props.applications.filter((application) => application.kind !== "llm" && application.available);
  const llmApps = props.applications.filter((application) => application.kind === "llm");

  const withLabel = (icon: React.ReactNode, title: Parameters<typeof t>[1]) => <>{icon}{props.displayMode === "iconAndLabel" ? <span className="toolbar-label">{tx(title)}</span> : null}</>;
  const editorButtons = editorApps.map((application) => (
    <button key={application.id} onClick={() => props.onOpenWith(application.id)}>
      <span className="app-badge">{application.name.slice(0, 1).toUpperCase()}</span>
      <span>{application.kind === "system" ? tx("systemDefault") : application.name}</span>
      {application.id === props.defaultOpenTarget ? <Check className="check" /> : null}
    </button>
  ));
  const llmButtons = llmApps.map((application) => (
    <button key={application.id} disabled={!application.available} onClick={() => props.onOpenInLlm(application.id as "codex" | "claude" | "chatgpt")}><Sparkles />{application.name}</button>
  ));
  const emptyAppItem = () => <button disabled className="menu-empty">{tx("noAppsAvailable")}</button>;

  const renderItem = (item: ToolbarItem, index: number) => {
    const key = `${item}-${index}`;
    if (item === "flexibleSpace") return <span key={key} className="toolbar-flexible-space" />;
    if (item === "space") return <span key={key} className="toolbar-space" />;
    if (item === "navigation") return <div key={key} className="history-buttons toolbar-navigation"><button disabled={!props.canGoBack} aria-label="Back" onClick={props.onBack}><ChevronLeft /></button><button disabled={!props.canGoForward} aria-label="Forward" onClick={props.onForward}><ChevronRight /></button></div>;
    if (item === "sidebar") return <div key={key} className="sidebar-control">
      <button className={props.sidebarVisible ? "selected" : ""} title={tx("toggleSidebar")} aria-label={tx("toggleSidebar")} onClick={props.onToggleSidebar}>{withLabel(<PanelLeft />, "sidebar")}</button>
      <details><summary aria-label={tx("chooseSidebar")}><ChevronDown /></summary><div className="menu-popover sidebar-menu">
        <button onClick={() => props.onSidebarModeChange("outline")}>{tx("tableOfContents")}</button>
        <button onClick={() => props.onSidebarModeChange("files")}>{tx("projectNavigator")}</button>
      </div></details>
    </div>;
    if (item === "openActions") return <details key={key} className="toolbar-group open-with">
      <summary title={tx("open")}>{withLabel(<AppWindow />, "open")}<ChevronDown /></summary>
      <div className="menu-popover">
        {llmApps.length === 0 && editorApps.length === 0 ? emptyAppItem() : <>
          {llmApps.length > 0 && <b>{tx("aiApps")}</b>}
          {llmButtons}
          {llmApps.length > 0 && editorApps.length > 0 && <hr />}
          {editorApps.length > 0 && <b>{tx("editors")}</b>}
          {editorButtons}
        </>}
      </div>
    </details>;
    if (item === "openWith") return <details key={key} className="toolbar-group open-with">
      <summary title={tx("openWith")}>{withLabel(<AppWindow />, "openWith")}<ChevronDown /></summary>
      <div className="menu-popover">{editorApps.length ? editorButtons : emptyAppItem()}</div>
    </details>;
    if (item === "openInLlm") return <details key={key} className="toolbar-group open-with">
      <summary title={tx("openInLlm")}>{withLabel(<Sparkles />, "openInLlm")}<ChevronDown /></summary>
      <div className="menu-popover">{llmApps.length ? llmButtons : emptyAppItem()}</div>
    </details>;
    if (item === "zoom") return <div key={key} className="toolbar-group zoom-buttons" aria-label={`${tx("zoom")} ${props.zoom}%`}>
      <button title={tx("zoomOut")} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, -1))}><span>A</span><Minus /></button>
      <button title={tx("zoomIn")} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, 1))}><span>A</span><Plus /></button>
    </div>;
    if (item === "search") return <label key={key} className="document-search" onClick={props.onSearchOpen}><Search /><input value={props.searchQuery} onFocus={props.onSearchOpen} onChange={(event) => props.onSearchQueryChange(event.target.value)} placeholder={tx("search")} /></label>;
    const actions: Partial<Record<ToolbarItem, { title: Parameters<typeof t>[1]; icon: React.ReactNode; active?: boolean; action: () => void }>> = {
      inspector: { title: "getInfo", icon: <Info />, active: props.inspectorVisible, action: props.onToggleInspector },
      share: { title: "shareSource", icon: <Share />, action: props.onShare },
      edit: { title: props.viewMode === "edit" ? "stopEditing" : "toggleEdit", icon: <FilePenLine />, active: props.viewMode === "edit", action: () => props.onViewModeChange(props.viewMode === "edit" ? "preview" : "edit") },
      print: { title: "printItem", icon: <Printer />, action: props.onPrint },
      copy: { title: "copyItem", icon: copiedFlash ? <Check /> : <Clipboard />, action: () => { props.onCopy(); setCopiedFlash(true); window.setTimeout(() => setCopiedFlash(false), 1200); } },
      export: { title: "exportItem", icon: <FileDown />, action: props.onExport },
      exportPdf: { title: "exportPdf", icon: <FileDown />, action: props.onExportPdf },
    };
    const action = actions[item];
    return action ? <button key={key} className={`toolbar-item-button ${props.displayMode === "iconAndLabel" ? "with-label" : ""} ${action.active ? "selected" : ""} ${item === "edit" && action.active ? "edit-active" : ""}`} title={tx(action.title)} aria-label={tx(action.title)} onClick={action.action}>{withLabel(action.icon, action.title)}</button> : null;
  };

  return <header className="native-toolbar" data-tauri-drag-region onClick={(event) => {
    const details = (event.target as HTMLElement).closest(".menu-popover button")?.closest("details");
    if (details) window.setTimeout(() => details.removeAttribute("open"), 0);
  }}>
    <div className="window-leading" data-tauri-drag-region><div className="traffic-lights">
      <button aria-label={tx("close")} onClick={() => windowAction("close")} /><button aria-label={tx("minimize")} onClick={() => windowAction("minimize")} /><button aria-label={tx("maximize")} onClick={() => windowAction("toggleMaximize")} />
    </div></div>
    <strong className="native-title">{props.fileName}{props.dirty ? ` — ${tx("edited")}` : ""}</strong>
    <div className="native-actions">{props.items.map(renderItem)}
      <details className="more-menu"><summary title={tx("more")}><MoreHorizontal /></summary><div className="menu-popover align-right">
        <button onClick={props.onOpen}><FolderOpen />{tx("openFile")}</button><button onClick={props.onOpenFolder}><FolderOpen />{tx("openFolder")}</button>
        <button onClick={props.onSave} disabled={props.busy}><Save />{tx("save")}</button><button onClick={props.onSaveAs}><Download />{tx("saveAs")}</button><hr />
        <button onClick={props.onCopy}><Clipboard />{tx("copySource")}</button><button onClick={props.onPrint}><Printer />{tx("print")}</button><button onClick={props.onExportHtml}><FileDown />{tx("exportHtml")}</button><button onClick={props.onExportPdf}><FileDown />{tx("exportPdf")}</button><button onClick={props.onExportPng}><FileDown />{tx("exportPng")}</button><hr />
        <button onClick={props.onCustomizeToolbar}><Settings />{tx("customizeToolbar")}</button><button onClick={props.onSettings}><Settings />{tx("preferences")}…</button>
      </div></details>
    </div>
  </header>;
}
