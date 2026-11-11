import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FileText, Search } from 'lucide-react'
import { t } from '../lib/i18n'
import { matchFile, rankFiles, type FileMatch } from '../lib/fileSearchMatcher'
import { normalizeIdentity, type IndexedFile } from '../lib/fileSearchIndex'
import type { Locale } from '../types'

export type OpenMode = 'current' | 'tab' | 'window'

interface FileSearchPaletteProps {
  open: boolean
  locale: Locale
  /** Flattened Markdown files of the mounted project folder. */
  projectFiles: IndexedFile[]
  /** Recent documents, already filtered/deduped/capped, newest first. */
  recents: IndexedFile[]
  /** Mounted project folder name; null puts the palette in recents-only mode. */
  projectName: string | null
  /** True when the project index hit its file cap. */
  truncated: boolean
  onOpen: (absolutePath: string, mode: OpenMode) => void
  onOpenFolder: () => void
  onClose: () => void
}

type Row = { kind: 'header'; id: string; label: string } | { kind: 'file'; id: string; file: IndexedFile; match: FileMatch }

const DEBOUNCE_MS = 100
const VISIBLE_ROWS = 8

/** Bold the matched character runs inside `text`. */
function highlight(text: string, ranges: Array<[number, number]>): ReactNode {
  if (!ranges.length) return text
  const nodes: ReactNode[] = []
  let cursor = 0
  ranges.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(<strong key={index}>{text.slice(start, end)}</strong>)
    cursor = end
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

const parentSegments = (path: string): string[] => path.replace(/\\/g, '/').split('/').slice(0, -1).filter(Boolean)

/** The gray path subtitle: a ' › ' breadcrumb. Project rows are prefixed with the
 * project folder name; recent rows show their absolute parent directory. On the
 * slash route the full relative path is shown and its matched characters bolded. */
function subtitle(file: IndexedFile, match: FileMatch, projectName: string | null): ReactNode {
  if (file.isRecent) {
    const segments = parentSegments(file.absolutePath)
    const text = segments.join(' › ')
    return match.field === 'path' ? highlight(file.absolutePath, match.ranges) : text
  }
  if (match.field === 'path') {
    const prefix = projectName ? `${projectName} › ` : ''
    return (
      <>
        {prefix}
        {highlight(file.path, match.ranges)}
      </>
    )
  }
  const segments = parentSegments(file.path)
  const parts = projectName ? [projectName, ...segments] : segments
  return parts.join(' › ')
}

export function FileSearchPalette(props: FileSearchPaletteProps) {
  const { open, locale, projectFiles, recents, projectName, truncated } = props
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selection, setSelection] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const tx = (key: Parameters<typeof t>[1]) => t(locale, key)

  // Reset the field each time the palette opens and take focus.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setSelection(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  // Blank queries apply immediately; typing is debounced 100ms like upstream.
  useEffect(() => {
    if (query.trim() === '') {
      setDebounced('')
      return
    }
    const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const rows = useMemo<Row[]>(() => {
    const blank = debounced.trim() === ''
    const result: Row[] = []
    if (blank) {
      if (recents.length) {
        result.push({ kind: 'header', id: 'h-recent', label: tx('recentFiles') })
        recents.forEach((file, index) => result.push({ kind: 'file', id: `r${index}`, file, match: matchFile('', file)! }))
      }
      return result
    }
    const rankedRecents = rankFiles(debounced, recents)
    if (rankedRecents.length) {
      result.push({ kind: 'header', id: 'h-recent', label: tx('recentFiles') })
      rankedRecents.forEach((r, index) => result.push({ kind: 'file', id: `r${index}`, file: r.candidate, match: r.match }))
    }
    const shownRecent = new Set(rankedRecents.map((r) => normalizeIdentity(r.candidate.absolutePath)))
    const rankedProject = rankFiles(
      debounced,
      projectFiles.filter((file) => !shownRecent.has(normalizeIdentity(file.absolutePath))),
    )
    if (rankedProject.length) {
      result.push({ kind: 'header', id: 'h-project', label: tx('fileResults') })
      rankedProject.forEach((r, index) => result.push({ kind: 'file', id: `p${index}`, file: r.candidate, match: r.match }))
    }
    return result
  }, [debounced, projectFiles, recents, projectName, locale])

  const selectable = useMemo(() => rows.filter((row): row is Extract<Row, { kind: 'file' }> => row.kind === 'file'), [rows])

  // Auto-select the first file row after every ranking.
  useEffect(() => {
    setSelection(0)
  }, [debounced, projectFiles, recents])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const panel = document.querySelector('.file-search-palette')
      if (panel && !panel.contains(event.target as Node)) props.onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, props])

  // Keep the selected row scrolled into view. Declared before the early return
  // so the hook order is identical whether or not the palette is open.
  useEffect(() => {
    if (!open) return
    const selected = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    selected?.scrollIntoView?.({ block: 'nearest' })
  }, [open, selection, rows])

  if (!open) return null

  const blank = debounced.trim() === ''
  const openSelected = (mode: OpenMode) => {
    const row = selectable[selection]
    if (row) props.onOpen(row.file.absolutePath, mode)
  }
  const move = (delta: number) => {
    setSelection((current) => {
      if (!selectable.length) return 0
      const next = Math.min(selectable.length - 1, Math.max(0, current + delta))
      return next
    })
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        setSelection(0)
        break
      case 'End':
        event.preventDefault()
        setSelection(Math.max(0, selectable.length - 1))
        break
      case 'PageDown':
        event.preventDefault()
        move(VISIBLE_ROWS - 1)
        break
      case 'PageUp':
        event.preventDefault()
        move(-(VISIBLE_ROWS - 1))
        break
      case 'Escape':
        event.preventDefault()
        props.onClose()
        break
      case 'Enter':
        event.preventDefault()
        openSelected(event.metaKey || event.ctrlKey ? 'tab' : event.altKey ? 'window' : 'current')
        break
    }
  }

  let selectableIndex = -1
  const showEmpty = selectable.length === 0
  return (
    <div className="file-search-overlay">
      <div className="file-search-palette" role="dialog" aria-label={tx('searchForDocument')} onKeyDown={onKeyDown}>
        <div className="file-search-row">
          <Search className="file-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="file-search-input"
            type="text"
            value={query}
            placeholder={tx('searchFilesByName')}
            aria-label={tx('searchFilesByName')}
            onChange={(event) => setQuery(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {showEmpty ? (
          <div className="file-search-empty">
            <span>{blank ? tx('noRecentFiles') : tx('noMatchingFiles')}</span>
            {/* Upstream: `openFolderButton.isHidden = projectRoot != nil` — the
             * offer appears whenever nothing is on screen and no folder is
             * mounted, with or without a query. */}
            {projectName == null ? (
              <button type="button" className="file-search-open-folder" onClick={props.onOpenFolder}>
                {tx('openFolder')}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="file-search-results" ref={listRef} role="listbox" aria-label={tx('fileResults')}>
            {!blank && truncated ? (
              <div className="file-search-truncated">{t(locale, 'showingFirstFiles', { count: projectFiles.length })}</div>
            ) : null}
            {rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <div key={row.id} className="file-search-header" role="presentation">
                    {row.label}
                  </div>
                )
              }
              selectableIndex += 1
              const index = selectableIndex
              const selected = index === selection
              const nameNode = row.match.field === 'name' ? highlight(row.file.name, row.match.ranges) : row.file.name
              return (
                <div
                  key={row.id}
                  className="file-search-file"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected}
                  title={row.file.absolutePath}
                  onClick={() => setSelection(index)}
                  onDoubleClick={() => props.onOpen(row.file.absolutePath, 'current')}
                >
                  <FileText className="file-search-file-icon" aria-hidden="true" />
                  <span className="file-search-file-text">
                    <span className="file-search-file-name">{nameNode}</span>
                    <span className="file-search-file-path">{subtitle(row.file, row.match, projectName)}</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
