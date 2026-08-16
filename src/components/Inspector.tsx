import { useState } from 'react'
import { FileText, Info, X } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DocumentStats, FrontmatterEntry, Locale, TextDocument } from '../types'

const formatDate = (value: number | null | undefined, locale: Locale) =>
  value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const formatBytes = (bytes: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: bytes < 1024 ? 'byte' : 'kilobyte', maximumFractionDigits: 1 }).format(
    bytes < 1024 ? bytes : bytes / 1024,
  )

export function Inspector({
  document,
  stats,
  frontmatter,
  locale,
  onClose,
}: {
  document: TextDocument
  stats: DocumentStats
  frontmatter: FrontmatterEntry[]
  locale: Locale
  onClose: () => void
}) {
  const [tab, setTab] = useState<'document' | 'properties'>('document')
  const bytes = document.sizeBytes ?? new TextEncoder().encode(document.contents).byteLength
  const field = (label: Parameters<typeof t>[1], value: React.ReactNode, title?: string) => (
    <div>
      <dt>{t(locale, label)}</dt>
      <dd title={title}>{value}</dd>
    </div>
  )
  return (
    <aside className="inspector-panel" aria-label={t(locale, 'documentInfo')}>
      <header>
        <div className="inspector-segmented" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'document'}
            className={tab === 'document' ? 'active' : ''}
            onClick={() => setTab('document')}
          >
            <FileText />
            {t(locale, 'document')}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'properties'}
            className={tab === 'properties' ? 'active' : ''}
            onClick={() => setTab('properties')}
          >
            <Info />
            {t(locale, 'properties')}
          </button>
        </div>
        <button onClick={onClose} aria-label={t(locale, 'close')}>
          <X />
        </button>
      </header>
      {tab === 'document' ? (
        <section className="inspector-tab">
          <dl>
            {field('fileName', <strong>{document.name}</strong>, document.path ?? undefined)}
            {field('documentType', t(locale, 'markdownDocument'))}
            {field('fileSize', formatBytes(bytes, locale))}
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
        </section>
      ) : (
        <section className="inspector-tab">
          {frontmatter.length ? (
            <dl className="frontmatter-list">
              {frontmatter.map((entry, index) => (
                <div key={`${entry.key}-${index}`}>
                  <dt>{entry.key}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="inspector-empty">{t(locale, 'noFrontmatter')}</p>
          )}
        </section>
      )}
    </aside>
  )
}
