import { useState } from 'react'
import { ArrowRightCircle, Copy, FileText, Info } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DocumentStats, FrontmatterEntry, InspectorMode, Locale, TextDocument } from '../types'

const formatDate = (value: number | null | undefined, locale: Locale) =>
  value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatBytes = (bytes: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: bytes < 1024 ? 'byte' : 'kilobyte', maximumFractionDigits: 1 }).format(
    bytes < 1024 ? bytes : bytes / 1024,
  )

/** The upstream inspector has two tabs — Document (doc) and Properties (info)
 * — picked with a centered segmented control (InspectorView.Tab). */
const TAB_META: Array<{ mode: InspectorMode; label: Parameters<typeof t>[1]; icon: typeof FileText }> = [
  { mode: 'document', label: 'document', icon: FileText },
  { mode: 'properties', label: 'properties', icon: Info },
]

export function Inspector({
  mode,
  document,
  stats,
  selectionStats,
  frontmatter,
  locale,
  onModeChange,
  onCopyPath,
  onRevealPath,
}: {
  mode: InspectorMode
  document: TextDocument
  stats: DocumentStats
  /** Words/characters/lines of the editor selection, or null when the caret
   * has no range. When set, the count rows switch to these numbers and gain
   * the upstream "- Selected" suffix. */
  selectionStats: DocumentStats | null
  frontmatter: FrontmatterEntry[]
  locale: Locale
  onModeChange: (mode: InspectorMode) => void
  onCopyPath: (path: string) => void
  onRevealPath: (path: string) => void
}) {
  const [pathExpanded, setPathExpanded] = useState(false)
  const bytes = document.sizeBytes ?? new TextEncoder().encode(document.contents).byteLength
  const showsSelection = selectionStats !== null
  const row = (label: Parameters<typeof t>[1], value: React.ReactNode, title?: string) => (
    <div className="inspector-row">
      <dt>{t(locale, label)}</dt>
      <dd title={title}>{value}</dd>
    </div>
  )
  // Words, characters and lines report the selection when one is active.
  const countRow = (label: 'words' | 'characters' | 'lines') => {
    const value = (showsSelection ? selectionStats[label] : stats[label]).toLocaleString(locale)
    return (
      <div className="inspector-row">
        <dt>
          {t(locale, label)}
          {showsSelection ? <span className="inspector-selected-suffix"> - {t(locale, 'selected')}</span> : null}
        </dt>
        <dd>{value}</dd>
      </div>
    )
  }
  const renderDocument = () => (
    <>
      <section className="inspector-section">
        <dl>
          {row('fileName', <strong>{document.name}</strong>, document.path ?? undefined)}
          {document.path ? (
            <div
              className={`inspector-row inspector-path ${pathExpanded ? 'expanded' : ''}`}
              onClick={() => setPathExpanded((value) => !value)}
              title={document.path}
            >
              <dt>{t(locale, 'fullPath')}</dt>
              <dd>
                <code>{document.path}</code>
                <span className="inspector-path-actions">
                  <button
                    type="button"
                    aria-label={t(locale, 'copyPath')}
                    title={t(locale, 'copyPath')}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCopyPath(document.path!)
                    }}
                  >
                    <Copy />
                  </button>
                  <button
                    type="button"
                    aria-label={t(locale, 'showInFileManager')}
                    title={t(locale, 'showInFileManager')}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRevealPath(document.path!)
                    }}
                  >
                    <ArrowRightCircle />
                  </button>
                </span>
              </dd>
            </div>
          ) : null}
          {row('documentType', t(locale, 'markdownDocument'))}
          {row('fileSize', formatBytes(bytes, locale))}
        </dl>
      </section>
      <section className="inspector-section">
        <dl>
          {countRow('words')}
          {countRow('characters')}
          {countRow('lines')}
        </dl>
      </section>
      <section className="inspector-section">
        <dl>
          {row('headings', stats.headings.toLocaleString(locale))}
          {row('links', stats.links.toLocaleString(locale))}
          {row('images', stats.images.toLocaleString(locale))}
        </dl>
      </section>
      <section className="inspector-section">
        <dl>{row('modified', formatDate(document.modifiedMs, locale))}</dl>
      </section>
    </>
  )
  const renderProperties = () =>
    frontmatter.length ? (
      <section className="inspector-section">
        <dl className="frontmatter-list">
          {frontmatter.map((entry, index) => (
            <div className="inspector-row" key={`${entry.key}-${index}`}>
              <dt>{entry.key}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    ) : (
      <p className="inspector-empty">{t(locale, 'noFrontmatter')}</p>
    )
  return (
    <aside className="inspector-panel" aria-label={t(locale, 'documentInfo')}>
      <header>
        <div className="inspector-segmented" role="tablist" aria-label={t(locale, 'inspectorTab')}>
          {TAB_META.map(({ mode: itemMode, label, icon: Icon }) => (
            <button
              key={itemMode}
              role="tab"
              aria-selected={mode === itemMode}
              aria-label={t(locale, label)}
              className={mode === itemMode ? 'active' : ''}
              title={t(locale, label)}
              onClick={() => onModeChange(itemMode)}
            >
              <Icon />
              <span className="sr-only">{t(locale, label)}</span>
            </button>
          ))}
        </div>
      </header>
      <section className="inspector-tab">{mode === 'properties' ? renderProperties() : renderDocument()}</section>
    </aside>
  )
}
