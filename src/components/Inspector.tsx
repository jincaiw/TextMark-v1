import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { homeDir } from '@tauri-apps/api/path'
import { ChevronRight } from 'lucide-react'
import { t } from '../lib/i18n'
import { SfGlyph } from './SfGlyph'
import type { SelectionStats } from '../lib/inspectorSelection'
import type { DocumentStats, FrontmatterEntry, InspectorMode, Locale, TextDocument } from '../types'

// The reference's inspector has exactly two segments: the document summary and
// the front-matter ("Properties") pane, drawn with SF Symbols "doc" and
// "info" at 13pt. Those symbols are rasterised by AppKit and used as a mask so
// the ink is the system's own artwork; the hand-drawn paths remain as the
// fallback for other platforms and for the first frame before the mask lands.
const Segments = {
  document: () => (
    <SfGlyph
      name="doc"
      points={13}
      weight={0}
      fallback={
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 1.75h5.5l4.5 4.5v8H3z" fill="none" stroke="currentColor" strokeWidth="1.15" />
          <path d="M7.75 1.75v4.5h5.25" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        </svg>
      }
    />
  ),
  properties: () => (
    <SfGlyph
      name="info"
      points={13}
      weight={0}
      fallback={
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <ellipse cx="7.6" cy="2.8" rx="0.8" ry="1.1" fill="currentColor" />
          <path d="M4.8 6.25h3.5v6.75h-1V7.15H4.8z" fill="currentColor" />
          <rect x="4.8" y="13" width="6" height="1" fill="currentColor" />
        </svg>
      }
    />
  ),
}

const MODE_META: Array<{ mode: 'document' | 'properties'; label: Parameters<typeof t>[1] }> = [
  { mode: 'document', label: 'document' },
  { mode: 'properties', label: 'properties' },
]

// The reference's medium date plus a 12-hour clock: zh reads
// "2026年11月8日 上午11:39", en "Nov 8, 2026 at 11:39 AM".
const formatModified = (value: number | null | undefined, locale: Locale) => {
  if (!value) return '—'
  const date = new Date(value)
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
  return locale === 'zh-CN' ? `${day} ${time}` : `${day} at ${time}`
}
// ByteCountFormatter's wording: "744 字节" over here, "744 bytes" there; a
// kilobyte or more uses the short "KB" unit.
const formatBytes = (bytes: number, locale: Locale) => {
  if (bytes < 1024) return `${bytes.toLocaleString(locale)} ${locale === 'zh-CN' ? '字节' : 'bytes'}`
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`
}

/** Abbreviate a path with `~` when it lives under the user's home, as the
 * upstream inspector does before display. */
async function abbreviatePath(path: string): Promise<string> {
  try {
    const home = (await homeDir()).replace(/\/$/, '')
    if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`
  } catch {
    // Non-Tauri contexts (tests, preview host) keep the full path.
  }
  return path
}

export function Inspector({
  mode,
  document,
  stats,
  selectionCountStats,
  frontmatter,
  locale,
  onModeChange,
  onRevealPath,
}: {
  mode: InspectorMode
  document: TextDocument
  stats: DocumentStats
  /** When the editor has a selection, counts for just that selection. */
  selectionCountStats: SelectionStats | null
  frontmatter: FrontmatterEntry[]
  locale: Locale
  onModeChange: (mode: 'document' | 'properties') => void
  onRevealPath: (path: string) => void
}) {
  const bytes = document.sizeBytes ?? new TextEncoder().encode(document.contents).byteLength
  const [displayPath, setDisplayPath] = useState(document.path)
  useEffect(() => {
    if (!document.path) {
      setDisplayPath(null)
      return
    }
    let cancelled = false
    void abbreviatePath(document.path).then((abbreviated) => {
      if (!cancelled) setDisplayPath(abbreviated)
    })
    return () => {
      cancelled = true
    }
  }, [document.path])
  const row = (label: Parameters<typeof t>[1], value: ReactNode, title?: string) => (
    <div className="inspector-row">
      <span className="inspector-row-label">{t(locale, label)}</span>
      <span className="inspector-row-value" title={title}>
        {value}
      </span>
    </div>
  )
  // Words / characters / lines carry a muted "- Selected" suffix whenever the
  // editor has a selection, mirroring the upstream countLabel.
  const countRow = (label: Parameters<typeof t>[1], value: number) => (
    <div className="inspector-row">
      <span className="inspector-row-label">
        {t(locale, label)}
        {selectionCountStats ? <span className="inspector-selected-suffix">- {t(locale, 'selected')}</span> : null}
      </span>
      <span className="inspector-row-value">{value.toLocaleString(locale)}</span>
    </div>
  )
  // Tags, outgoing links and backlinks live in other surfaces; the reference's
  // inspector is exactly these two segments.
  const renderDocument = () => (
    <div className="inspector-sections">
      <section className="inspector-card">
        {row('fileName', document.name, document.path ?? undefined)}
        {document.path
          ? row(
              'fullPath',
              <>
                <code>{displayPath ?? document.path}</code>
                <button
                  type="button"
                  className="inspector-reveal"
                  title={t(locale, 'showInFileManager')}
                  aria-label={t(locale, 'showInFileManager')}
                  onClick={() => onRevealPath(document.path!)}
                >
                  <ChevronRight />
                </button>
              </>,
              document.path,
            )
          : null}
        {row('documentType', t(locale, 'markdownDocument'))}
        {row('fileSize', formatBytes(bytes, locale))}
      </section>
      <section className="inspector-card">
        {countRow('words', selectionCountStats?.words ?? stats.words)}
        {countRow('characters', selectionCountStats?.characters ?? stats.characters)}
        {countRow('lines', selectionCountStats?.lines ?? stats.lines)}
      </section>
      <section className="inspector-card">
        {row('headings', stats.headings.toLocaleString(locale))}
        {row('links', stats.links.toLocaleString(locale))}
        {row('images', stats.images.toLocaleString(locale))}
      </section>
      <section className="inspector-card inspector-card-date">
        <span className="inspector-row-label">{t(locale, 'modified')}</span>
        <span className="inspector-date-value">{formatModified(document.modifiedMs, locale)}</span>
      </section>
    </div>
  )
  const renderProperties = () =>
    frontmatter.length ? (
      <div className="inspector-sections">
        <section className="inspector-card">
          {frontmatter.map((entry, index) => (
            <div className="inspector-row" key={`${entry.key}-${index}`}>
              <span className="inspector-row-label">{entry.key}</span>
              <span className="inspector-row-value">{entry.value}</span>
            </div>
          ))}
        </section>
      </div>
    ) : (
      <p className="inspector-empty">{t(locale, 'noFrontmatter')}</p>
    )
  const active: 'document' | 'properties' = mode === 'properties' ? 'properties' : 'document'
  return (
    <aside className="inspector-panel" aria-label={t(locale, 'documentInfo')}>
      <header>
        <div className="inspector-segmented" role="tablist" aria-label={locale === 'zh-CN' ? '检查器面板' : 'Inspector panels'}>
          {MODE_META.map(({ mode: itemMode, label }) => (
            <button
              key={itemMode}
              role="tab"
              aria-selected={active === itemMode}
              className={active === itemMode ? 'active' : ''}
              title={t(locale, label)}
              aria-label={t(locale, label)}
              onClick={() => onModeChange(itemMode)}
            >
              {Segments[itemMode]()}
            </button>
          ))}
        </div>
      </header>
      <section className={`inspector-tab inspector-tab-${active}`}>{active === 'document' ? renderDocument() : renderProperties()}</section>
    </aside>
  )
}
