import { FileText, FolderOpen, Hash, TextCursorInput, X } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauri } from "../lib/platform";
import type { DocumentStats, FrontmatterEntry, TextDocument } from "../types";

interface InspectorProps { document: TextDocument; stats: DocumentStats; frontmatter: FrontmatterEntry[]; onClose: () => void; }

const formatDate = (value?: number | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export function Inspector({ document, stats, frontmatter, onClose }: InspectorProps) {
  const bytes = new TextEncoder().encode(document.contents).byteLength;
  return (
    <aside className="inspector-panel" aria-label="Document inspector">
      <header><strong>Document Info</strong><button onClick={onClose} aria-label="Close inspector"><X /></button></header>
      <section className="inspector-file"><FileText /><div><strong>{document.name}</strong><span>Markdown document</span></div></section>
      <dl>
        <div><dt>Location</dt><dd title={document.path ?? "Unsaved"}>{document.path ?? "Unsaved"}</dd></div>
        <div><dt>Modified</dt><dd>{formatDate(document.modifiedMs)}</dd></div>
        <div><dt>Size</dt><dd>{bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`}</dd></div>
      </dl>
      {document.path && isTauri() ? <button className="reveal-button" onClick={() => void revealItemInDir(document.path!)}><FolderOpen />Show in File Manager</button> : null}
      <h3><TextCursorInput />Document</h3>
      <dl className="stats-grid"><div><dt>Words</dt><dd>{stats.words.toLocaleString()}</dd></div><div><dt>Characters</dt><dd>{stats.characters.toLocaleString()}</dd></div><div><dt>Lines</dt><dd>{stats.lines.toLocaleString()}</dd></div></dl>
      <h3><Hash />Frontmatter</h3>
      {frontmatter.length ? <dl className="frontmatter-list">{frontmatter.map((entry, index) => <div key={`${entry.key}-${index}`}><dt>{entry.key}</dt><dd>{entry.value}</dd></div>)}</dl> : <p className="inspector-empty">No frontmatter</p>}
    </aside>
  );
}
