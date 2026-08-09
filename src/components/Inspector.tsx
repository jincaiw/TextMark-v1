import { FileText, FolderOpen, Hash, TextCursorInput, X } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauri } from "../lib/platform";
import { t } from "../lib/i18n";
import type { DocumentStats, FrontmatterEntry, Locale, TextDocument } from "../types";

const formatDate = (value: number | null | undefined, locale: Locale) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const formatBytes = (bytes: number, locale: Locale) => new Intl.NumberFormat(locale, { style: "unit", unit: bytes < 1024 ? "byte" : "kilobyte", maximumFractionDigits: 1 }).format(bytes < 1024 ? bytes : bytes / 1024);

export function Inspector({ document, stats, frontmatter, locale, onClose }: { document: TextDocument; stats: DocumentStats; frontmatter: FrontmatterEntry[]; locale: Locale; onClose: () => void }) {
  const bytes = document.sizeBytes ?? new TextEncoder().encode(document.contents).byteLength;
  const field = (label: Parameters<typeof t>[1], value: React.ReactNode, title?: string) => <div><dt>{t(locale, label)}</dt><dd title={title}>{value}</dd></div>;
  return <aside className="inspector-panel" aria-label={t(locale, "documentInfo")}>
    <header><strong>{t(locale, "documentInfo")}</strong><button onClick={onClose} aria-label={t(locale, "close")}><X /></button></header>
    <section className="inspector-file"><FileText /><div><strong>{document.name}</strong><span>{t(locale, "markdownDocument")}</span></div></section>
    <dl>{field("location", document.path ?? t(locale, "unsaved"), document.path ?? undefined)}{field("created", formatDate(document.createdMs, locale))}{field("modified", formatDate(document.modifiedMs, locale))}{field("size", formatBytes(bytes, locale))}</dl>
    {document.path && isTauri() ? <button className="reveal-button" onClick={() => void revealItemInDir(document.path!)}><FolderOpen />{t(locale, "showInFileManager")}</button> : null}
    <h3><TextCursorInput />{t(locale, "document")}</h3>
    <dl className="stats-grid">{field("words", stats.words.toLocaleString(locale))}{field("characters", stats.characters.toLocaleString(locale))}{field("lines", stats.lines.toLocaleString(locale))}{field("headings", stats.headings.toLocaleString(locale))}{field("links", stats.links.toLocaleString(locale))}{field("images", stats.images.toLocaleString(locale))}</dl>
    <h3><Hash />{t(locale, "frontmatter")}</h3>
    {frontmatter.length ? <dl className="frontmatter-list">{frontmatter.map((entry, index) => <div key={`${entry.key}-${index}`}><dt>{entry.key}</dt><dd>{entry.value}</dd></div>)}</dl> : <p className="inspector-empty">{t(locale, "noFrontmatter")}</p>}
  </aside>;
}
