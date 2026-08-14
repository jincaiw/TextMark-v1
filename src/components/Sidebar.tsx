import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, ListTree } from "lucide-react";
import type { ExternalApplication, FileNode, OutlineItem, SidebarMode } from "../types";
import { t } from "../lib/i18n";
import type { Locale } from "../types";

interface TreeNodeProps { node: FileNode; activePath: string | null; depth: number; onOpenFile: (path: string) => void; onContextMenu: (event: React.MouseEvent, node: FileNode) => void; }

function TreeNode({ node, activePath, depth, onOpenFile, onContextMenu }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (node.isDirectory) {
    return (
      <div>
        <button className="tree-row" style={{ paddingLeft: 12 + depth * 16 }} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown /> : <ChevronRight />}{expanded ? <FolderOpen /> : <Folder />}<span>{node.name}</span>
        </button>
        {expanded ? node.children.map((child) => <TreeNode key={child.path} node={child} activePath={activePath} depth={depth + 1} onOpenFile={onOpenFile} onContextMenu={onContextMenu} />) : null}
      </div>
    );
  }
  return <button className={`tree-row file ${activePath === node.path ? "active" : ""}`} style={{ paddingLeft: 31 + depth * 16 }} onClick={() => onOpenFile(node.path)} onContextMenu={(event) => onContextMenu(event, node)} title={node.path}><FileText /><span>{node.name}</span></button>;
}

interface SidebarProps {
  mode: SidebarMode;
  fileName: string;
  files: FileNode[];
  workspacePath: string | null;
  activePath: string | null;
  outline: OutlineItem[];
  activeHeading: string | null;
  applications: ExternalApplication[];
  defaultOpenTarget: string;
  onModeChange: (mode: SidebarMode) => void;
  onOpenFolder: () => void;
  onOpenFile: (path: string) => void;
  onOpenFileInTab: (path: string) => void;
  onOpenFileInWindow: (path: string) => void;
  onOpenFileWith: (path: string, application: string) => void;
  onRevealFile: (path: string) => void;
  onCopyFilePath: (path: string) => void;
  onCopyFileContents: (path: string) => void;
  onOutlineSelect: (id: string) => void;
  locale: Locale;
}

export function Sidebar(props: SidebarProps) {
  const workspaceName = props.workspacePath?.split(/[\\/]/).pop();
  const [context, setContext] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const contextMenu = (event: React.MouseEvent, node: FileNode) => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY, node }); };
  const editors = props.applications.filter((application) => application.kind !== "llm" && application.available);
  const closeContext = () => setContext(null);
  const run = (action: () => void) => { action(); closeContext(); };
  return (
    <aside className="native-sidebar">
      <div className="sidebar-section-title">
        <strong>{props.mode === "outline" ? props.fileName : (workspaceName ?? t(props.locale, "project"))}</strong>
        <button title={props.mode === "outline" ? t(props.locale, "projectNavigator") : t(props.locale, "tableOfContents")} onClick={() => props.onModeChange(props.mode === "outline" ? "files" : "outline")}>
          {props.mode === "outline" ? <Folder /> : <ListTree />}
        </button>
      </div>
      {props.mode === "outline" ? (
        <nav className="native-outline" aria-label={t(props.locale, "tableOfContents")}>
          {props.outline.length ? props.outline.map((item) => (
            <button key={item.id} className={`outline-level-${item.level} ${props.activeHeading === item.id ? "active" : ""}`} aria-current={props.activeHeading === item.id ? "location" : undefined} style={{ paddingLeft: 18 + (item.level - 1) * 18 }} onClick={() => props.onOutlineSelect(item.id)}>{item.level > 1 ? <ChevronRight /> : null}<span>{item.text}</span></button>
          )) : <p>{t(props.locale, "noHeadings")}</p>}
        </nav>
      ) : (
        <div className="native-file-tree">
          {props.files.length ? props.files.map((node) => <TreeNode key={node.path} node={node} activePath={props.activePath} depth={0} onOpenFile={props.onOpenFile} onContextMenu={contextMenu} />) : (
            <div className="sidebar-empty"><FolderOpen /><p>{t(props.locale, "openFolder")}</p><button onClick={props.onOpenFolder}>{t(props.locale, "openFolder")}</button></div>
          )}
        </div>
      )}
      {context ? <div className="project-context-menu" role="menu" style={{ left: context.x, top: context.y }} onMouseLeave={closeContext}>
        <button role="menuitem" onClick={() => run(() => props.onOpenFile(context.node.path))}>{t(props.locale, "openFile")}</button>
        <button role="menuitem" onClick={() => run(() => props.onOpenFileInTab(context.node.path))}>{t(props.locale, "openInNewTab")}</button>
        <button role="menuitem" onClick={() => run(() => props.onOpenFileInWindow(context.node.path))}>{t(props.locale, "openInNewWindow")}</button>
        <hr />
        <button role="menuitem" disabled={!editors.length} onClick={() => run(() => props.onOpenFileWith(context.node.path, props.defaultOpenTarget === "system" ? "system" : (editors.some((e) => e.id === props.defaultOpenTarget) ? props.defaultOpenTarget : "system")))}>{t(props.locale, "openWithExternalEditor")}</button>
        <div className="context-submenu">
          <button role="menuitem">{t(props.locale, "openAs")}<ChevronRight /></button>
          <div className="context-submenu-panel">
            {editors.length ? editors.map((application) => (
              <button key={application.id} role="menuitem" onClick={() => run(() => props.onOpenFileWith(context.node.path, application.id))}>{application.kind === "system" ? t(props.locale, "systemDefault") : application.name}</button>
            )) : <button role="menuitem" disabled>{t(props.locale, "noEditorsAvailable")}</button>}
          </div>
        </div>
        <hr />
        <button role="menuitem" onClick={() => run(() => props.onRevealFile(context.node.path))}>{t(props.locale, "showInFileManager")}</button>
        <button role="menuitem" onClick={() => run(() => props.onCopyFilePath(context.node.path))}>{t(props.locale, "copyPath")}</button>
        <button role="menuitem" onClick={() => run(() => props.onCopyFileContents(context.node.path))}>{t(props.locale, "copyContents")}</button>
      </div> : null}
    </aside>
  );
}
