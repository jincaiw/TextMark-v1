import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, ListTree } from "lucide-react";
import type { FileNode, OutlineItem, SidebarMode } from "../types";
import { t } from "../lib/i18n";
import type { Locale } from "../types";

interface TreeNodeProps { node: FileNode; activePath: string | null; depth: number; onOpenFile: (path: string) => void; }

function TreeNode({ node, activePath, depth, onOpenFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (node.isDirectory) {
    return (
      <div>
        <button className="tree-row" style={{ paddingLeft: 12 + depth * 16 }} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown /> : <ChevronRight />}{expanded ? <FolderOpen /> : <Folder />}<span>{node.name}</span>
        </button>
        {expanded ? node.children.map((child) => <TreeNode key={child.path} node={child} activePath={activePath} depth={depth + 1} onOpenFile={onOpenFile} />) : null}
      </div>
    );
  }
  return <button className={`tree-row file ${activePath === node.path ? "active" : ""}`} style={{ paddingLeft: 31 + depth * 16 }} onClick={() => onOpenFile(node.path)} title={node.path}><FileText /><span>{node.name}</span></button>;
}

interface SidebarProps {
  mode: SidebarMode;
  fileName: string;
  files: FileNode[];
  workspacePath: string | null;
  activePath: string | null;
  outline: OutlineItem[];
  onModeChange: (mode: SidebarMode) => void;
  onOpenFolder: () => void;
  onOpenFile: (path: string) => void;
  onOutlineSelect: (id: string) => void;
  locale: Locale;
}

export function Sidebar(props: SidebarProps) {
  const workspaceName = props.workspacePath?.split(/[\\/]/).pop();
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
            <button key={item.id} className={`outline-level-${item.level}`} style={{ paddingLeft: 18 + (item.level - 1) * 18 }} onClick={() => props.onOutlineSelect(item.id)}>{item.level > 1 ? <ChevronRight /> : null}<span>{item.text}</span></button>
          )) : <p>{t(props.locale, "noHeadings")}</p>}
        </nav>
      ) : (
        <div className="native-file-tree">
          {props.files.length ? props.files.map((node) => <TreeNode key={node.path} node={node} activePath={props.activePath} depth={0} onOpenFile={props.onOpenFile} />) : (
            <div className="sidebar-empty"><FolderOpen /><p>{t(props.locale, "openFolder")}</p><button onClick={props.onOpenFolder}>{t(props.locale, "openFolder")}</button></div>
          )}
        </div>
      )}
    </aside>
  );
}
