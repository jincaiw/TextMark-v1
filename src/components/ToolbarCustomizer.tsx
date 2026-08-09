import { GripVertical, RotateCcw, X } from "lucide-react";
import { t } from "../lib/i18n";
import type { Locale, ToolbarItem } from "../types";

export const DEFAULT_TOOLBAR: ToolbarItem[] = ["sidebar", "flexibleSpace", "openWith", "zoom", "inspector", "share", "edit", "search"];
const AVAILABLE: ToolbarItem[] = ["sidebar", "openWith", "zoom", "inspector", "share", "edit", "search", "print", "copy", "export", "flexibleSpace", "space"];
const label: Record<ToolbarItem, Parameters<typeof t>[1]> = { sidebar: "sidebar", openWith: "openWith", zoom: "zoom", inspector: "inspector", share: "share", edit: "edit", search: "searchItem", print: "printItem", copy: "copyItem", export: "exportItem", flexibleSpace: "flexibleSpace", space: "space" };

export function ToolbarCustomizer({ open, locale, items, onChange, onClose }: { open: boolean; locale: Locale; items: ToolbarItem[]; onChange: (items: ToolbarItem[]) => void; onClose: () => void }) {
  if (!open) return null;
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  return <div className="dialog-backdrop" onMouseDown={onClose}><section className="toolbar-customizer" role="dialog" aria-modal="true" aria-labelledby="toolbar-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><h2 id="toolbar-title">{t(locale, "toolbarTitle")}</h2><p>{t(locale, "toolbarHint")}</p></div><button onClick={onClose} aria-label={t(locale, "close")}><X /></button></header>
    <h3>{t(locale, "availableItems")}</h3><div className="toolbar-palette">{AVAILABLE.map((item) => <button key={item} onClick={() => onChange([...items, item])}>{t(locale, label[item])}</button>)}</div>
    <h3>{t(locale, "currentToolbar")}</h3><div className="toolbar-order">{items.map((item, index) => <div key={`${item}-${index}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(Number(event.dataTransfer.getData("text/plain")), index)}>
      <GripVertical /><span>{t(locale, label[item])}</span><button onClick={() => onChange(items.filter((_, candidate) => candidate !== index))}><X /></button>
    </div>)}</div>
    <footer><button onClick={() => onChange(DEFAULT_TOOLBAR)}><RotateCcw />{t(locale, "reset")}</button><button className="primary" onClick={onClose}>{t(locale, "done")}</button></footer>
  </section></div>;
}
