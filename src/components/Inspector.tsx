import { useMemo } from 'react'
import { ArrowDownRight, FileText, ListTree, Tag, X } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DocumentStats, FrontmatterEntry, InspectorMode, Locale, OutlineItem, TextDocument } from '../types'

const formatDate = (value: number | null | undefined, locale: Locale) =>
  value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatBytes = (bytes: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: bytes < 1024 ? 'byte' : 'kilobyte', maximumFractionDigits: 1 }).format(
    bytes < 1024 ? bytes : bytes / 1024,
  )

const MODE_META: Array<{ mode: InspectorMode; label: Parameters<typeof t>[1]; icon: typeof FileText }> = [
  { mode: 'outline', label: 'tableOfContents', icon: ListTree },
  { mode: 'document', label: 'document', icon: FileText },
  { mode: 'tags', label: 'tags', icon: Tag },
  { mode: 'outgoing', label: 'outgoingLinks', icon: ArrowDownRight },
  { mode: 'backlinks', label: 'backlinks', icon: ArrowDownRight },
]

function extractTags(source: string) {
  const tags = new Set<string>()
  for (const match of source.matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gmu)) tags.add(`#${match[2]}`)
  return [...tags]
}

function extractOutgoingLinks(source: string) {
  const links: string[] = []
  for (const match of source.matchAll(/(?<!!)(?:\[[^\]]*\]\(([^)]+)\)|\[\[([^\]]+)\]\])/g)) links.push(match[1] ?? match[2])
  return [...new Set(links)]
}

export function Inspector({
  mode,
  outline,
  document,
  stats,
  frontmatter,
  locale,
  onModeChange,
  onOutlineSelect,
  onCopyPath,
  onRevealPath,
  onClose,
}: {
  mode: InspectorMode
  outline: OutlineItem[]
  document: TextDocument
  stats: DocumentStats
  frontmatter: FrontmatterEntry[]
  locale: Locale
  onModeChange: (mode: InspectorMode) => void
  onOutlineSelect: (id: string) => void
  onCopyPath: (path: string) => void
  onRevealPath: (path: string) => void
  onClose: () => void
}) {
  const bytes = document.sizeBytes ?? new TextEncoder().encode(document.contents).byteLength
  const tags = useMemo(() => extractTags(document.contents), [document.contents])
  const outgoingLinks = useMemo(() => extractOutgoingLinks(document.contents), [document.contents])
  const field = (label: Parameters<typeof t>[1], value: React.ReactNode, title?: string) => (
    <div>
      <dt>{t(locale, label)}</dt>
      <dd title={title}>{value}</dd>
    </div>
  )
  const empty = (message: string) => <p className="inspector-empty">{message}</p>
  const renderDocument = () => (
    <>
      <dl>
        {field('fileName', <strong>{document.name}</strong>, document.path ?? undefined)}
        {field('documentType', t(locale, 'markdownDocument'))}
        {field(
          'location',
          document.path ? (
            <div className="inspector-location">
              <code>{document.path}</code>
              <span>
                <button type="button" onClick={() => onCopyPath(document.path!)}>
                  {t(locale, 'copyPath')}
                </button>
                <button type="button" onClick={() => onRevealPath(document.path!)}>
                  {t(locale, 'showInFileManager')}
                </button>
              </span>
            </div>
          ) : (
            t(locale, 'unsaved')
          ),
          document.path ?? undefined,
        )}
        {field('fileSize', formatBytes(bytes, locale))}
        {field('created', formatDate(document.createdMs, locale))}
        {field('modified', formatDate(document.modifiedMs, locale))}
      </dl>
      <h3>{t(locale, 'documentInfo')}</h3>
      <dl className="stats-grid">
        {field('words', stats.words.toLocaleString(locale))}
        {field('characters', stats.characters.toLocaleString(locale))}
        {field('lines', stats.lines.toLocaleString(locale))}
        {field('headings', stats.headings.toLocaleString(locale))}
        {field('links', stats.links.toLocaleString(locale))}
        {field('images', stats.images.toLocaleString(locale))}
      </dl>
    </>
  )
  const renderOutline = () =>
    outline.length ? (
      <nav className="inspector-outline" aria-label={t(locale, 'tableOfContents')}>
        {outline.map((item) => (
          <button key={item.id} className={`outline-level-${item.level}`} onClick={() => onOutlineSelect(item.id)}>
            <span>{item.text}</span>
          </button>
        ))}
      </nav>
    ) : (
      empty(t(locale, 'noHeadings'))
    )
  const renderTags = () =>
    tags.length ? (
      <div className="inspector-chip-list" aria-label={t(locale, 'tags')}>
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    ) : (
      empty(locale === 'zh-CN' ? '当前文档没有标签。' : 'This document has no tags.')
    )
  const renderLinks = (backlinks: boolean) =>
    backlinks ? (
      empty(locale === 'zh-CN' ? '尚未建立反向链接索引。' : 'No backlink index is available yet.')
    ) : outgoingLinks.length ? (
      <ul className="inspector-link-list">
        {outgoingLinks.map((link) => (
          <li key={link}>
            <span>{link}</span>
          </li>
        ))}
      </ul>
    ) : (
      empty(locale === 'zh-CN' ? '当前文档没有出链。' : 'This document has no outgoing links.')
    )
  const renderContent = () => {
    if (mode === 'outline') return renderOutline()
    if (mode === 'tags') return renderTags()
    if (mode === 'outgoing') return renderLinks(false)
    if (mode === 'backlinks') return renderLinks(true)
    return frontmatter.length ? (
      <>
        {renderDocument()}
        <h3>{t(locale, 'properties')}</h3>
        <dl className="frontmatter-list">
          {frontmatter.map((entry, index) => (
            <div key={`${entry.key}-${index}`}>
              <dt>{entry.key}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </>
    ) : (
      renderDocument()
    )
  }
  return (
    <aside className="inspector-panel" aria-label={t(locale, 'documentInfo')}>
      <header>
        <div className="inspector-segmented" role="tablist" aria-label={locale === 'zh-CN' ? '检查器面板' : 'Inspector panels'}>
          {MODE_META.map(({ mode: itemMode, label, icon: Icon }) => (
            <button
              key={itemMode}
              role="tab"
              aria-selected={mode === itemMode}
              className={mode === itemMode ? 'active' : ''}
              title={t(locale, label)}
              onClick={() => onModeChange(itemMode)}
            >
              <Icon />
              <span>{t(locale, label)}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} aria-label={t(locale, 'close')}>
          <X />
        </button>
      </header>
      <section className="inspector-tab">{renderContent()}</section>
    </aside>
  )
}
