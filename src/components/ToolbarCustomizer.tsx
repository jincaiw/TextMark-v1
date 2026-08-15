import { useState } from "react";
import { AppWindow, ChevronLeft, Clipboard, FileDown, FilePenLine, GripVertical, Info, PanelLeft, Printer, RotateCcw, Search, Share, Sparkles, X, ZoomIn } from "lucide-react";
import { t } from "../lib/i18n";
import { DEFAULT_TOOLBAR } from "../lib/settings";
import type { Locale, ToolbarDisplayMode, ToolbarItem } from "../types";

const AVAILABLE: ToolbarItem[] = ["navigation", "sidebar", "openActions", "openWith", "openInLlm", "zoom", "inspector", "share", "edit", "search", "print", "copy", "export", "exportPdf", "flexibleSpace", "space"];

const label: Record<ToolbarItem, Parameters<typeof t>[1]> = {
  navigation: "navigation", sidebar: "sidebar", openActions: "open", openWith: "openWith", openInLlm: "openInLlm", zoom: "zoom", inspector: "inspector", share: "share", edit: "edit",
  search: "searchItem", print: "printItem", copy: "copyItem", export: "exportItem", exportPdf: "exportPdf", flexibleSpace: "flexibleSpace", space: "space",
};

const itemIcon = (item: ToolbarItem): React.ReactNode => {
  switch (item) {
    case "navigation": return <ChevronLeft />;
    case "sidebar": return <PanelLeft />;
    case "openActions":
    case "openWith": return <AppWindow />;
    case "openInLlm": return <Sparkles />;
    case "zoom": return <ZoomIn />;
    case "inspector": return <Info />;
    case "share": return <Share />;
    case "edit": return <FilePenLine />;
    case "search": return <Search />;
    case "print": return <Printer />;
    case "copy": return <Clipboard />;
    case "export":
    case "exportPdf": return <FileDown />;
    case "flexibleSpace": return <span className="tc-glyph tc-glyph-flex" aria-hidden="true" />;
    case "space": return <span className="tc-glyph tc-glyph-space" aria-hidden="true" />;
  }
};

interface ToolbarCustomizerProps {
  open: boolean;
  locale: Locale;
  items: ToolbarItem[];
  displayMode: ToolbarDisplayMode;
  onChange: (items: ToolbarItem[]) => void;
  onDisplayModeChange: (mode: ToolbarDisplayMode) => void;
  onClose: () => void;
}

export function ToolbarCustomizer({ open, locale, items, displayMode, onChange, onDisplayModeChange, onClose }: ToolbarCustomizerProps) {
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  if (!open) return null;

  const insert = (item: ToolbarItem, index = items.length) => {
    const next = [...items];
    next.splice(index, 0, item);
    onChange(next);
  };
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const remove = (index: number) => onChange(items.filter((_, candidate) => candidate !== index));
  const readDrop = (event: React.DragEvent) => {
    const payload = event.dataTransfer.getData("text/plain");
    if (payload.startsWith("add:")) return { kind: "add" as const, item: payload.slice(4) as ToolbarItem };
    const from = Number(payload.slice(5));
    if (payload.startsWith("move:") && Number.isInteger(from)) return { kind: "move" as const, from };
    return null;
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="toolbar-customizer" role="dialog" aria-modal="true" aria-labelledby="toolbar-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><h2 id="toolbar-title">{t(locale, "toolbarTitle")}</h2><p>{t(locale, "toolbarHint")}</p></div>
        <button onClick={onClose} aria-label={t(locale, "close")}><X /></button>
      </header>
      <h3 className="tc-section">{t(locale, "availableItems")}</h3>
      <div className="tc-palette">
        {AVAILABLE.map((item) => (
          <button key={item} type="button" className="tc-card" draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", `add:${item}`)}
            onClick={() => insert(item)}>
            <span className="tc-card-icon">{itemIcon(item)}</span>
            <span className="tc-card-label">{t(locale, label[item])}</span>
          </button>
        ))}
      </div>
      <h3 className="tc-section">{t(locale, "currentToolbar")}</h3>
      <div className="tc-current" onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const drop = readDrop(event);
          if (drop?.kind === "add") insert(drop.item);
          setOverIndex(null);
        }}>
        {items.map((item, index) => (
          <div key={`${item}-${index}`} className={`tc-current-item ${overIndex === index ? "drop-target" : ""}`} draggable
            onDragStart={(event) => { event.dataTransfer.setData("text/plain", `move:${index}`); event.dataTransfer.effectAllowed = "move"; setDraggingIndex(index); }}
            onDragOver={(event) => { event.preventDefault(); setOverIndex(index); }}
            onDrop={(event) => {
              event.stopPropagation();
              const drop = readDrop(event);
              if (drop?.kind === "add") insert(drop.item, index);
              else if (drop?.kind === "move" && drop.from !== index) move(drop.from, index);
              setOverIndex(null);
            }}
            onDragEnd={(event) => {
              // Dragged out of the toolbar (no drop target) removes the item.
              if (event.dataTransfer.dropEffect === "none" && draggingIndex === index) remove(index);
              setDraggingIndex(null);
              setOverIndex(null);
            }}>
            <GripVertical className="tc-grip" />
            <span className="tc-card-icon">{itemIcon(item)}</span>
            <span className="tc-card-label">{t(locale, label[item])}</span>
            <button type="button" className="tc-remove" aria-label={t(locale, "close")} onClick={() => remove(index)}><X /></button>
          </div>
        ))}
        {items.length === 0 ? <p className="tc-empty">{t(locale, "dragToToolbar")}</p> : null}
      </div>
      <footer>
        <button type="button" className="tc-reset" onClick={() => onChange(DEFAULT_TOOLBAR)}><RotateCcw />{t(locale, "reset")}</button>
        <label className="tc-display"><span>{t(locale, "toolbarDisplay")}</span>
          <select value={displayMode} onChange={(event) => onDisplayModeChange(event.target.value as ToolbarDisplayMode)}>
            <option value="iconOnly">{t(locale, "iconsOnly")}</option>
            <option value="iconAndLabel">{t(locale, "iconsAndText")}</option>
          </select>
        </label>
        <button type="button" className="primary" onClick={onClose}>{t(locale, "done")}</button>
      </footer>
    </section>
  </div>;
}
