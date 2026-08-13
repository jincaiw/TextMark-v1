import { GripVertical, RotateCcw, X } from "lucide-react";
import { t } from "../lib/i18n";
import { DEFAULT_TOOLBAR } from "../lib/settings";
import type { Locale, ToolbarDisplayMode, ToolbarItem } from "../types";

const AVAILABLE: ToolbarItem[] = ["navigation", "sidebar", "openWith", "zoom", "inspector", "share", "edit", "search", "print", "copy", "export", "flexibleSpace", "space"];
const label: Record<ToolbarItem, Parameters<typeof t>[1]> = { navigation: "navigation", sidebar: "sidebar", openWith: "openWith", zoom: "zoom", inspector: "inspector", share: "share", edit: "edit", search: "searchItem", print: "printItem", copy: "copyItem", export: "exportItem", flexibleSpace: "flexibleSpace", space: "space" };

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
  if (!open) return null;
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  const addFromPalette = (item: ToolbarItem, index = items.length) => { const next = [...items]; next.splice(index, 0, item); onChange(next); };
  return <div className="dialog-backdrop" onMouseDown={onClose}><section className="toolbar-customizer" role="dialog" aria-modal="true" aria-labelledby="toolbar-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><h2 id="toolbar-title">{t(locale, "toolbarTitle")}</h2><p>{t(locale, "toolbarHint")}</p></div><button onClick={onClose} aria-label={t(locale, "close")}><X /></button></header>
    <h3>{t(locale, "availableItems")}</h3><div className="toolbar-palette">{AVAILABLE.map((item) => <button key={item} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-textmark-toolbar-item", item)} onClick={() => addFromPalette(item)}>{t(locale, label[item])}</button>)}</div>
    <h3>{t(locale, "currentToolbar")}</h3><div className="toolbar-order" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const item = event.dataTransfer.getData("application/x-textmark-toolbar-item") as ToolbarItem; if (AVAILABLE.includes(item)) addFromPalette(item); }}>{items.map((item, index) => <div key={`${item}-${index}`} draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData("text/plain", String(index)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); const from = Number(event.dataTransfer.getData("text/plain")); const paletteItem = event.dataTransfer.getData("application/x-textmark-toolbar-item") as ToolbarItem; if (Number.isInteger(from)) move(from, index); else if (AVAILABLE.includes(paletteItem)) addFromPalette(paletteItem, index); }}>
      <GripVertical /><span>{t(locale, label[item])}</span><button onClick={() => onChange(items.filter((_, candidate) => candidate !== index))}><X /></button>
    </div>)}</div>
    <footer><button onClick={() => onChange(DEFAULT_TOOLBAR)}><RotateCcw />{t(locale, "reset")}</button><label className="toolbar-display"><span>{t(locale, "toolbarDisplay")}</span><select value={displayMode} onChange={(event) => onDisplayModeChange(event.target.value as ToolbarDisplayMode)}><option value="iconOnly">{t(locale, "iconsOnly")}</option><option value="iconAndLabel">{t(locale, "iconsAndText")}</option></select></label><button className="primary" onClick={onClose}>{t(locale, "done")}</button></footer>
  </section></div>;
}
