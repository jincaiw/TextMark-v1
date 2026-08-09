import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { isTauri, loadLocalAsset } from "../lib/platform";
import { t } from "../lib/i18n";
import type { ContentWidth, Locale, RenderedMarkdown, SearchMode, TableEdit, TableEditRequest } from "../types";

interface PreviewPaneProps {
  rendered: RenderedMarkdown;
  documentKey: string;
  initialScrollTop: number;
  baseDirectory: string | null;
  workspacePath: string | null;
  zoom: number;
  contentWidth: ContentWidth;
  searchQuery: string;
  searchIndex: number;
  matchCase: boolean;
  searchMode: SearchMode;
  locale: Locale;
  onSearchCount: (count: number) => void;
  onOpenRelative: (path: string) => void;
  onToggleTask: (index: number, checked: boolean) => void;
  onEditTable: (table: number, row: number, column: number, request: TableEditRequest) => void;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasRtl = (value: string) => /[\u0590-\u08ff]/.test(value);

export function PreviewPane(props: PreviewPaneProps) {
  const paneRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; table: number; row: number; column: number } | null>(null);
  const [tableSelection, setTableSelection] = useState<{ table: number; startRow: number; startColumn: number; endRow: number; endColumn: number } | null>(null);

  useEffect(() => { if (paneRef.current) paneRef.current.scrollTop = props.initialScrollTop; }, [props.documentKey, props.initialScrollTop]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll(".table-cell-selected").forEach((cell) => cell.classList.remove("table-cell-selected"));
    if (!tableSelection) return;
    const table = root.querySelectorAll("table")[tableSelection.table];
    const minRow = Math.min(tableSelection.startRow, tableSelection.endRow);
    const maxRow = Math.max(tableSelection.startRow, tableSelection.endRow);
    const minColumn = Math.min(tableSelection.startColumn, tableSelection.endColumn);
    const maxColumn = Math.max(tableSelection.startColumn, tableSelection.endColumn);
    Array.from(table?.querySelectorAll("tr") ?? []).forEach((row, rowIndex) => {
      Array.from(row.querySelectorAll("th, td")).forEach((cell, columnIndex) => {
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minColumn && columnIndex <= maxColumn) cell.classList.add("table-cell-selected");
      });
    });
  }, [tableSelection, props.rendered.html]);

  const cellCoordinates = (target: EventTarget | null) => {
    const cell = (target as HTMLElement | null)?.closest<HTMLTableCellElement>("td, th");
    const table = cell?.closest("table");
    const row = cell?.closest("tr");
    if (!cell || !table || !row || !containerRef.current) return null;
    return {
      table: Array.from(containerRef.current.querySelectorAll("table")).indexOf(table),
      row: Array.from(table.querySelectorAll("tr")).indexOf(row),
      column: Array.from(row.querySelectorAll("th, td")).indexOf(cell),
    };
  };

  const openDiagram = async (figure: HTMLElement) => {
    const sourceNode = figure.querySelector<HTMLElement>(".mermaid[data-mermaid-source]");
    const source = sourceNode?.dataset.mermaidSource ? decodeURIComponent(sourceNode.dataset.mermaidSource) : "";
    if (isTauri() && source) {
      const id = `diagram-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(`textmark.${id}`, source);
      try { await invoke("open_mermaid_window", { id, locale: props.locale }); }
      catch { localStorage.removeItem(`textmark.${id}`); setDiagram(figure.innerHTML); }
      return;
    }
    setDiagram(figure.innerHTML);
  };

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
      button.textContent = t(props.locale, "copy");
      button.setAttribute("aria-label", t(props.locale, "copyCode"));
      pre.append(button);
    });

    if (props.searchQuery) {
      const flags = props.matchCase ? "g" : "gi";
      const prefix = props.searchMode === "beginsWith" ? "\\b" : "";
      const pattern = new RegExp(`${prefix}${escapeRegExp(props.searchQuery)}`, flags);
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
          try { image.src = await loadLocalAsset(props.baseDirectory!, image.dataset.localSrc ?? "", props.workspacePath); }
          catch { image.classList.add("asset-error"); image.alt = `${image.alt || "Image"} — local asset unavailable`; }
        }));
      }
      if (props.rendered.hasMermaid) {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: document.documentElement.dataset.theme === "dark" ? "dark" : "neutral", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" });
        await Promise.all(Array.from(root.querySelectorAll<HTMLElement>(".mermaid[data-mermaid-source]")).map(async (node, index) => {
          try {
            const source = decodeURIComponent(node.dataset.mermaidSource ?? "");
            const { svg } = await mermaid.render(`textmark-diagram-${Date.now()}-${index}`, source);
            if (!cancelled) {
              node.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
              const figure = node.closest("figure");
              if (figure && !figure.querySelector(".diagram-hud")) {
                const hud = document.createElement("div");
                hud.className = "diagram-hud";
                hud.innerHTML = `<button data-diagram-action="out" aria-label="−">−</button><output>100%</output><button data-diagram-action="in" aria-label="+">+</button><button data-diagram-action="fit">↔</button><button data-diagram-action="open">↗</button>`;
                figure.append(hud);
              }
            }
          } catch { if (!cancelled) node.textContent = "Unable to render this Mermaid diagram."; }
        }));
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [props.rendered.html, props.rendered.hasMermaid, props.baseDirectory, props.workspacePath, props.searchQuery, props.searchIndex, props.matchCase, props.searchMode, props.locale]);

  return (
    <section ref={paneRef} className="preview-pane" aria-label="Rendered Markdown preview" tabIndex={0}
      onCopy={(event) => {
        if (!tableSelection || !containerRef.current) return;
        const table = containerRef.current.querySelectorAll("table")[tableSelection.table];
        const rows = Array.from(table?.querySelectorAll("tr") ?? []);
        const minRow = Math.min(tableSelection.startRow, tableSelection.endRow);
        const maxRow = Math.max(tableSelection.startRow, tableSelection.endRow);
        const minColumn = Math.min(tableSelection.startColumn, tableSelection.endColumn);
        const maxColumn = Math.max(tableSelection.startColumn, tableSelection.endColumn);
        const text = rows.slice(minRow, maxRow + 1).map((row) => Array.from(row.querySelectorAll("th, td")).slice(minColumn, maxColumn + 1).map((cell) => cell.textContent?.trim() ?? "").join("\t")).join("\n");
        event.preventDefault();
        event.clipboardData.setData("text/plain", text);
      }}>
      <article
        ref={containerRef}
        className={`markdown-body content-${props.contentWidth}`}
        style={{ fontSize: `${props.zoom}%` }}
        dangerouslySetInnerHTML={{ __html: props.rendered.html }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest("a, button, input, [contenteditable=true]")) return;
          const cell = cellCoordinates(event.target);
          if (!cell) { setTableSelection(null); return; }
          event.preventDefault();
          paneRef.current?.focus({ preventScroll: true });
          setTableSelection({ table: cell.table, startRow: cell.row, startColumn: cell.column, endRow: cell.row, endColumn: cell.column });
        }}
        onPointerMove={(event) => {
          if (!(event.buttons & 1) || !tableSelection) return;
          const cell = cellCoordinates(event.target);
          if (!cell || cell.table !== tableSelection.table) return;
          setTableSelection((selection) => selection ? { ...selection, endRow: cell.row, endColumn: cell.column } : selection);
        }}
        onDoubleClick={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td, th");
          if (cell && cell.tagName === "TD") {
            event.preventDefault();
            cell.contentEditable = "plaintext-only";
            cell.classList.add("editing");
            cell.focus();
            const selection = window.getSelection();
            selection?.selectAllChildren(cell);
            return;
          }
          const figure = (event.target as HTMLElement).closest<HTMLElement>(".diagram");
          if (figure) void openDiagram(figure);
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
        onBlur={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td[contenteditable]");
          if (!cell || !containerRef.current) return;
          const table = cell.closest("table");
          const row = cell.closest("tr");
          if (!table || !row) return;
          const tables = Array.from(containerRef.current.querySelectorAll("table"));
          const rows = Array.from(table.querySelectorAll("tr"));
          const cells = Array.from(row.querySelectorAll("th, td"));
          cell.contentEditable = "false";
          cell.classList.remove("editing");
          props.onEditTable(tables.indexOf(table), rows.indexOf(row), cells.indexOf(cell), { edit: "setCell", value: cell.textContent ?? "" });
        }}
        onClick={(event) => {
          setTableMenu(null);
          const target = event.target as HTMLElement;
          const copy = target.closest<HTMLButtonElement>(".copy-code-button");
          if (copy) { void navigator.clipboard.writeText(copy.parentElement?.querySelector("code")?.textContent ?? ""); copy.textContent = t(props.locale, "copied"); return; }
          const diagramAction = target.closest<HTMLButtonElement>("[data-diagram-action]");
          if (diagramAction) {
            const figure = diagramAction.closest<HTMLElement>(".diagram");
            const svg = figure?.querySelector<SVGSVGElement>("svg");
            if (!figure || !svg) return;
            const action = diagramAction.dataset.diagramAction;
            if (action === "open") { void openDiagram(figure); return; }
            const current = Number(figure.dataset.diagramZoom ?? 100);
            const next = action === "fit" ? 100 : Math.max(50, Math.min(300, current + (action === "in" ? 25 : -25)));
            figure.dataset.diagramZoom = String(next);
            svg.style.width = action === "fit" ? "100%" : `${next}%`;
            figure.querySelector(".diagram-hud output")!.textContent = `${next}%`;
            return;
          }
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
      <div className="sr-only" aria-live="polite" />
      {tableMenu ? <div className="table-context-menu" style={{ left: tableMenu.x, top: tableMenu.y }} role="menu" onClick={(event) => event.stopPropagation()}>
        {(["addRowBefore", "addRowAfter", "duplicateRow", "deleteRow", "addColumnBefore", "addColumnAfter", "duplicateColumn", "deleteColumn"] as TableEdit[]).map((edit) => {
          const labels: Record<Exclude<TableEdit, "setCell">, Parameters<typeof t>[1]> = { addRowBefore: "addRowAbove", addRowAfter: "addRowBelow", duplicateRow: "duplicateRow", deleteRow: "deleteRow", addColumnBefore: "addColumnBefore", addColumnAfter: "addColumnAfter", duplicateColumn: "duplicateColumn", deleteColumn: "deleteColumn" };
          if (edit === "deleteRow" && tableMenu.row === 0) return null;
          return <button key={edit} role="menuitem" onClick={() => { props.onEditTable(tableMenu.table, tableMenu.row, tableMenu.column, { edit }); setTableMenu(null); }}>{t(props.locale, labels[edit as Exclude<TableEdit, "setCell">])}</button>;
        })}
      </div> : null}
      {diagram ? <div className="diagram-lightbox" role="dialog" aria-modal="true" aria-label={t(props.locale, "diagramWindow")} onClick={() => setDiagram(null)}><div onClick={(event) => event.stopPropagation()} dangerouslySetInnerHTML={{ __html: diagram }} /><button aria-label={t(props.locale, "close")} onClick={() => setDiagram(null)}>×</button></div> : null}
    </section>
  );
}
