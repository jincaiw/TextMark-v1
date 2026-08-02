import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri, loadLocalAsset } from "../lib/platform";
import type { ContentWidth, RenderedMarkdown, TableEdit } from "../types";

interface PreviewPaneProps {
  rendered: RenderedMarkdown;
  baseDirectory: string | null;
  zoom: number;
  contentWidth: ContentWidth;
  searchQuery: string;
  searchIndex: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  onSearchCount: (count: number) => void;
  onOpenRelative: (path: string) => void;
  onToggleTask: (index: number, checked: boolean) => void;
  onEditTable: (table: number, row: number, column: number, edit: TableEdit) => void;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasRtl = (value: string) => /[\u0590-\u08ff]/.test(value);

export function PreviewPane(props: PreviewPaneProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; table: number; row: number; column: number } | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.innerHTML = props.rendered.html;
    let cancelled = false;

    root.querySelectorAll<HTMLElement>("p, li, blockquote, td, th").forEach((node) => {
      if (hasRtl(node.textContent ?? "")) node.dir = "rtl";
    });

    root.querySelectorAll("pre").forEach((pre) => {
      const button = document.createElement("button");
      button.className = "copy-code-button";
      button.type = "button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code");
      pre.append(button);
    });

    if (props.searchQuery) {
      const flags = props.caseSensitive ? "g" : "gi";
      const boundary = props.wholeWord ? "\\b" : "";
      const pattern = new RegExp(`${boundary}${escapeRegExp(props.searchQuery)}${boundary}`, flags);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => node.parentElement?.closest(".katex-mathml, button, svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const textNode of nodes) {
        const value = textNode.data;
        pattern.lastIndex = 0;
        let match = pattern.exec(value);
        if (!match) continue;
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        do {
          fragment.append(value.slice(cursor, match.index));
          const mark = document.createElement("mark");
          mark.className = "search-match";
          mark.textContent = match[0];
          fragment.append(mark);
          cursor = match.index + match[0].length;
          if (!match[0].length) pattern.lastIndex += 1;
          match = pattern.exec(value);
        } while (match);
        fragment.append(value.slice(cursor));
        textNode.replaceWith(fragment);
      }
    }

    const matches = Array.from(root.querySelectorAll<HTMLElement>("mark.search-match"));
    props.onSearchCount(matches.length);
    const active = matches[props.searchIndex % Math.max(matches.length, 1)];
    if (active) {
      active.classList.add("active");
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    const hydrate = async () => {
      if (props.baseDirectory && isTauri()) {
        await Promise.all(Array.from(root.querySelectorAll<HTMLImageElement>("img[data-local-src]")).map(async (image) => {
          try { image.src = await loadLocalAsset(props.baseDirectory!, image.dataset.localSrc ?? ""); }
          catch { image.classList.add("asset-error"); image.alt = `${image.alt || "Image"} — local asset unavailable`; }
        }));
      }
      if (props.rendered.hasMermaid) {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" });
        await Promise.all(Array.from(root.querySelectorAll<HTMLElement>(".mermaid[data-mermaid-source]")).map(async (node, index) => {
          try {
            const source = decodeURIComponent(node.dataset.mermaidSource ?? "");
            const { svg } = await mermaid.render(`textmark-diagram-${Date.now()}-${index}`, source);
            if (!cancelled) node.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
          } catch { if (!cancelled) node.textContent = "Unable to render this Mermaid diagram."; }
        }));
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [props.rendered.html, props.rendered.hasMermaid, props.baseDirectory, props.searchQuery, props.searchIndex, props.caseSensitive, props.wholeWord]);

  return (
    <section className="preview-pane" aria-label="Rendered Markdown preview">
      <article
        ref={containerRef}
        className={`markdown-body content-${props.contentWidth}`}
        style={{ fontSize: `${props.zoom}%` }}
        dangerouslySetInnerHTML={{ __html: props.rendered.html }}
        onDoubleClick={(event) => {
          const figure = (event.target as HTMLElement).closest<HTMLElement>(".diagram");
          if (figure) setDiagram(figure.innerHTML);
        }}
        onContextMenu={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td, th");
          const table = cell?.closest("table");
          if (!cell || !table || !containerRef.current) return;
          event.preventDefault();
          const tables = Array.from(containerRef.current.querySelectorAll("table"));
          const rows = Array.from(table.querySelectorAll("tr"));
          const cells = Array.from(cell.parentElement?.querySelectorAll("th, td") ?? []);
          setTableMenu({ x: event.clientX, y: event.clientY, table: tables.indexOf(table), row: rows.indexOf(cell.parentElement as HTMLTableRowElement), column: cells.indexOf(cell) });
        }}
        onChange={(event) => {
          const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>("input.task-list-item-checkbox");
          if (!checkbox) return;
          const boxes = Array.from(containerRef.current?.querySelectorAll("input.task-list-item-checkbox") ?? []);
          props.onToggleTask(boxes.indexOf(checkbox), checkbox.checked);
        }}
        onClick={(event) => {
          setTableMenu(null);
          const target = event.target as HTMLElement;
          const copy = target.closest<HTMLButtonElement>(".copy-code-button");
          if (copy) { void navigator.clipboard.writeText(copy.parentElement?.querySelector("code")?.textContent ?? ""); copy.textContent = "Copied"; return; }
          const formula = target.closest<HTMLElement>(".katex");
          if (formula) {
            const source = formula.querySelector("annotation")?.textContent;
            if (source) void navigator.clipboard.writeText(source);
            return;
          }
          const anchor = target.closest<HTMLAnchorElement>("a[href]");
          if (!anchor) return;
          const href = anchor.getAttribute("href") ?? "";
          if (href.startsWith("#")) return;
          event.preventDefault();
          if (/^https?:/i.test(href)) isTauri() ? void openUrl(href) : window.open(href, "_blank", "noopener,noreferrer");
          else if (/\.(?:md|markdown|mdown|mkd|mkdn)(?:[?#].*)?$/i.test(href)) props.onOpenRelative(href);
        }}
      />
      {tableMenu ? <div className="table-context-menu" style={{ left: tableMenu.x, top: tableMenu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
        {(["addRowBefore", "addRowAfter", "deleteRow", "addColumnBefore", "addColumnAfter", "deleteColumn"] as TableEdit[]).map((edit) => {
          const labels: Record<TableEdit, string> = { addRowBefore: "Add Row Above", addRowAfter: "Add Row Below", deleteRow: "Delete Row", addColumnBefore: "Add Column Before", addColumnAfter: "Add Column After", deleteColumn: "Delete Column" };
          if (edit === "deleteRow" && tableMenu.row === 0) return null;
          return <button key={edit} role="menuitem" onClick={() => { props.onEditTable(tableMenu.table, tableMenu.row, tableMenu.column, edit); setTableMenu(null); }}>{labels[edit]}</button>;
        })}
      </div> : null}
      {diagram ? <div className="diagram-lightbox" role="dialog" aria-modal="true" onClick={() => setDiagram(null)}><div dangerouslySetInnerHTML={{ __html: diagram }} /></div> : null}
    </section>
  );
}
