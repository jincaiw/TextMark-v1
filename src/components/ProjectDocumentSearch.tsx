import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search, X } from 'lucide-react'
import { isMacos, listRecentFiles } from '../lib/platform'
import { t } from '../lib/i18n'
import { fuzzySubsequenceScore } from '../lib/fuzzySubsequence'
import { rankProjectDocuments, type SearchEntry, type SearchResult } from '../lib/projectDocumentRank'
import type { FileNode, Locale } from '../types'

function flatten(nodes: FileNode[], prefix = ''): SearchEntry[] {
  return nodes.flatMap((node) => {
    const relativePath = prefix ? `${prefix}/${node.name}` : node.name
    return node.isDirectory
      ? flatten(node.children, relativePath)
      : /\.(?:md|markdown|mdown|mdx|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i.test(node.name)
        ? [{ name: node.name, path: node.path, relativePath, relativePathLength: Array.from(relativePath).length }]
        : []
  })
}

interface RecentEntry {
  path: string
  name: string
}

interface ProjectDocumentSearchProps {
  files: FileNode[]
  activePath: string | null
  locale: Locale
  onOpenPath: (path: string) => void
  onOpenCurrent: (path: string) => void
  onOpenInTab: (path: string) => void
  onOpenInWindow: (path: string) => void
  onOpenFolder: () => void
  onClose: () => void
}

export function ProjectDocumentSearch(props: ProjectDocumentSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef(new Map<number, HTMLButtonElement>())
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [resultsQuery, setResultsQuery] = useState('')
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingOpenRef = useRef<'current' | 'tab' | 'window' | null>(null)
  const entries = useMemo(() => flatten(props.files), [props.files])
  const entriesRef = useRef(entries)
  const queryRef = useRef(query)
  entriesRef.current = entries
  queryRef.current = query
  // App-wide recents, merged into the palette the way the upstream file
  // search does: a Recent section when the query is blank, ranked rows
  // ahead of the project files otherwise.
  const [recents, setRecents] = useState<RecentEntry[]>([])
  useEffect(() => {
    let cancelled = false
    void listRecentFiles().then((paths) => {
      if (!cancelled) {
        setRecents(
          paths.map((path) => ({
            path,
            name: path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1) || path,
          })),
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
  const recentsRef = useRef(recents)
  recentsRef.current = recents
  /** Recent rows for the current query: ranked when searching, first 10 when blank. */
  const rankedRecents = useMemo((): RecentEntry[] => {
    const normalized = query.trim()
    if (!normalized) return recents.slice(0, 10)
    return recents
      .map((entry) => {
        const score = Math.max(fuzzySubsequenceScore(normalized, entry.name) ?? -1, fuzzySubsequenceScore(normalized, entry.path) ?? -1)
        return score >= 0 ? { entry, score } : null
      })
      .filter((item): item is { entry: RecentEntry; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry)
  }, [query, recents])
  const open = useCallback(
    (entry: SearchEntry | RecentEntry, mode: 'current' | 'tab' | 'window') => {
      if (mode === 'tab') props.onOpenInTab(entry.path)
      else if (mode === 'window') props.onOpenInWindow(entry.path)
      else if ('relativePath' in entry) props.onOpenCurrent(entry.path)
      else props.onOpenPath(entry.path)
      props.onClose()
    },
    [props.onClose, props.onOpenCurrent, props.onOpenInTab, props.onOpenInWindow, props.onOpenPath],
  )
  useEffect(() => {
    if (typeof Worker === 'undefined') return
    try {
      const worker = new Worker(new URL('../workers/projectDocumentSearch.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<{ requestId: number; query: string; results: SearchResult[] }>) => {
        if (event.data.requestId !== requestIdRef.current) return
        setResults(event.data.results)
        setResultsQuery(event.data.query)
        setSelected(0)
      }
      worker.onerror = () => {
        worker.terminate()
        if (workerRef.current !== worker) return
        workerRef.current = null
        const normalizedQuery = queryRef.current.trim()
        if (normalizedQuery) {
          setResults(rankProjectDocuments(entriesRef.current, normalizedQuery))
          setResultsQuery(normalizedQuery)
          setSelected(0)
        }
      }
      return () => {
        worker.terminate()
        if (workerRef.current === worker) workerRef.current = null
      }
    } catch {
      workerRef.current = null
    }
  }, [])
  useEffect(() => {
    workerRef.current?.postMessage({ type: 'index', entries })
  }, [entries])
  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestId = ++requestIdRef.current
    pendingOpenRef.current = null
    if (!normalizedQuery) {
      setResults([])
      setResultsQuery('')
      return
    }
    const worker = workerRef.current
    if (!worker) {
      setResults(rankProjectDocuments(entries, normalizedQuery))
      setResultsQuery(normalizedQuery)
      return
    }
    const timer = window.setTimeout(() => worker.postMessage({ type: 'search', requestId, query: normalizedQuery }), 60)
    return () => window.clearTimeout(timer)
  }, [entries, query])
  useEffect(() => {
    const pendingTarget = pendingOpenRef.current
    if (!pendingTarget || resultsQuery !== query.trim() || !results.length) return
    pendingOpenRef.current = null
    open(results[0].entry, pendingTarget)
  }, [open, query, results, resultsQuery])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    setSelected(0)
  }, [query])
  // Unified keyboard-selection model across both sections: recents first,
  // then project files, matching the visual row order.
  type SelectableRow = { id: string; kind: 'recent'; entry: RecentEntry } | { id: string; kind: 'file'; result: SearchResult }
  const selectableRows: SelectableRow[] = useMemo(() => {
    const normalizedQuery = query.trim()
    const rows: SelectableRow[] = rankedRecents.map((entry) => ({ id: `recent:${entry.path}`, kind: 'recent', entry }))
    if (normalizedQuery) for (const result of results) rows.push({ id: `file:${result.entry.path}`, kind: 'file', result })
    return rows
  }, [query, rankedRecents, results])
  const openSelected = useCallback(
    (row: SelectableRow, target: 'current' | 'tab' | 'window') => {
      if (row.kind === 'recent') {
        if (target === 'tab') props.onOpenInTab(row.entry.path)
        else if (target === 'window') props.onOpenInWindow(row.entry.path)
        else props.onOpenPath(row.entry.path)
        props.onClose()
      } else open(row.result.entry, target)
    },
    [open, props.onClose, props.onOpenInTab, props.onOpenInWindow, props.onOpenPath],
  )
  useEffect(() => {
    resultRefs.current.get(selected)?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, selectableRows.length])

  const highlightedText = (text: string, positions: number[]) => {
    const characters = Array.from(text)
    const matching = new Set(positions)
    return characters.map((character, index) =>
      matching.has(index) ? <strong key={index}>{character}</strong> : <span key={index}>{character}</span>,
    )
  }
  const commandKey = isMacos() ? '⌘' : 'Ctrl+'
  const optionKey = isMacos() ? '⌥' : 'Alt+'
  const enterKey = props.locale === 'zh-CN' ? '回车' : 'Enter'
  const labels =
    props.locale === 'zh-CN'
      ? {
          title: '搜索文稿',
          placeholder: '按文件名搜索当前项目',
          empty: '未找到匹配的 Markdown 文稿',
          noProject: '先打开一个项目文件夹以搜索文稿',
          openFolder: '打开文件夹…',
          current: '回车打开',
          tab: `${commandKey} ${enterKey}在新标签页打开`,
          window: `${optionKey} ${enterKey}在新窗口打开`,
        }
      : {
          title: 'Search Documents',
          placeholder: 'Find a file by name in this project',
          empty: 'No matching Markdown documents',
          noProject: 'Open a project folder to search its documents',
          openFolder: 'Open Folder…',
          current: 'Return to open',
          tab: `${commandKey}Enter in new tab`,
          window: `${optionKey}Enter in new window`,
        }

  return (
    <div
      className="project-search-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <section className="project-search-palette" role="dialog" aria-modal="true" aria-label={labels.title}>
        <div className="project-search-input-row">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              const rowCount = selectableRows.length
              const resultsStable = resultsQuery === query.trim()
              if (event.key === 'Escape') props.onClose()
              else if (event.key === 'ArrowDown' && rowCount) {
                event.preventDefault()
                setSelected((value) => Math.min(value + 1, rowCount - 1))
              } else if (event.key === 'ArrowUp' && rowCount) {
                event.preventDefault()
                setSelected((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Home' && rowCount) {
                event.preventDefault()
                setSelected(0)
              } else if (event.key === 'End' && rowCount) {
                event.preventDefault()
                setSelected(rowCount - 1)
              } else if (event.key === 'PageUp' && rowCount) {
                event.preventDefault()
                setSelected((value) => Math.max(value - 5, 0))
              } else if (event.key === 'PageDown' && rowCount) {
                event.preventDefault()
                setSelected((value) => Math.min(value + 5, rowCount - 1))
              } else if (event.key === 'Enter' && selectableRows[selected]) {
                event.preventDefault()
                const target = event.altKey ? 'window' : event.metaKey || event.ctrlKey ? 'tab' : 'current'
                const row = selectableRows[selected]
                if (resultsStable) openSelected(row, target)
                else pendingOpenRef.current = target
              } else if (event.key === 'Enter' && query.trim()) {
                event.preventDefault()
                pendingOpenRef.current = event.altKey ? 'window' : event.metaKey || event.ctrlKey ? 'tab' : 'current'
              }
            }}
          />
          <button type="button" aria-label={props.locale === 'zh-CN' ? '关闭' : 'Close'} onClick={props.onClose}>
            <X />
          </button>
        </div>
        <div className="project-search-results" role="listbox" aria-label={labels.title}>
          {(() => {
            // Recents (with their heading) come first, then project files with
            // their own heading, as in the upstream palette. Keyboard selection
            // indexes into selectableRows, which mirrors this visual order.
            const normalizedQuery = query.trim()
            const rows: Array<
              | { kind: 'heading'; id: string; label: string }
              | { kind: 'recent'; id: string; entry: RecentEntry }
              | { kind: 'file'; id: string; result: SearchResult }
            > = []
            if (rankedRecents.length) rows.push({ kind: 'heading', id: 'recent-heading', label: t(props.locale, 'recentFiles') })
            for (const entry of rankedRecents) rows.push({ kind: 'recent', id: `recent:${entry.path}`, entry })
            if (normalizedQuery && results.length)
              rows.push({ kind: 'heading', id: 'files-heading', label: t(props.locale, 'projectFiles') })
            if (normalizedQuery) for (const result of results) rows.push({ kind: 'file', id: `file:${result.entry.path}`, result })

            if (!selectableRows.length) return <p className="project-search-empty">{entries.length ? labels.empty : labels.noProject}</p>

            const globalIndexOf = (id: string) => selectableRows.findIndex((item) => item.id === id)
            const rowProps = (id: string) => {
              const globalIndex = globalIndexOf(id)
              return {
                role: 'option' as const,
                'aria-selected': globalIndex === selected,
                className: globalIndex === selected ? 'selected' : '',
                ref: (element: HTMLButtonElement | null) => {
                  if (element) resultRefs.current.set(globalIndex, element)
                  else resultRefs.current.delete(globalIndex)
                },
                onMouseEnter: () => setSelected(globalIndex),
              }
            }
            const renderRow = (row: (typeof rows)[number]) => {
              if (row.kind === 'heading')
                return (
                  <p key={row.id} className="project-search-heading">
                    {row.label}
                  </p>
                )
              if (row.kind === 'recent')
                return (
                  <button type="button" key={row.id} {...rowProps(row.id)} onClick={() => open(row.entry, 'current')}>
                    <FileText aria-hidden="true" />
                    <span className="project-search-file-name">{row.entry.name}</span>
                    <span className="project-search-file-path">
                      <span title={row.entry.path}>{row.entry.path}</span>
                    </span>
                  </button>
                )
              const result = row.result
              const relativePath = result.entry.relativePath
              const showFullPath = query.includes('/')
              const lastSlash = relativePath.lastIndexOf('/')
              const displayPath = showFullPath ? relativePath : lastSlash >= 0 ? relativePath.slice(0, lastSlash) : ''
              const firstSlash = displayPath.indexOf('/')
              const displayLastSlash = displayPath.lastIndexOf('/')
              const hasMiddlePath = firstSlash >= 0 && displayLastSlash > firstSlash
              const prefix = hasMiddlePath ? displayPath.slice(0, firstSlash + 1) : ''
              const tail = hasMiddlePath ? displayPath.slice(displayLastSlash + 1) : ''
              const prefixPositions = result.positions.filter((position) => position < prefix.length)
              const tailPositions = result.positions
                .filter((position) => position >= displayLastSlash + 1)
                .map((position) => position - displayLastSlash - 1)
              return (
                <button type="button" key={row.id} {...rowProps(row.id)} onClick={() => open(result.entry, 'current')}>
                  <FileText aria-hidden="true" />
                  <span className="project-search-file-name">
                    {query.includes('/') ? result.entry.name : highlightedText(result.entry.name, result.positions)}
                  </span>
                  <span className="project-search-file-path">
                    <span title={result.entry.path}>
                      {hasMiddlePath ? (
                        <>
                          <span className="project-search-path-prefix">
                            {query.includes('/') ? highlightedText(prefix, prefixPositions) : prefix}
                          </span>
                          <span className="project-search-path-ellipsis" aria-hidden="true">
                            …/
                          </span>
                          <span className="project-search-path-tail">
                            {query.includes('/') ? highlightedText(tail, tailPositions) : tail}
                          </span>
                        </>
                      ) : showFullPath ? (
                        highlightedText(displayPath, result.positions)
                      ) : (
                        displayPath
                      )}
                    </span>
                  </span>
                  {result.entry.path === props.activePath ? (
                    <span className="project-search-current">{props.locale === 'zh-CN' ? '当前' : 'Current'}</span>
                  ) : null}
                </button>
              )
            }
            return rows.map(renderRow)
          })()}
        </div>
        {query.trim() || !entries.length ? (
          <footer className="project-search-footer">
            {!entries.length ? (
              <button type="button" onClick={props.onOpenFolder}>
                {labels.openFolder}
              </button>
            ) : (
              <span>{labels.current}</span>
            )}
            <span>{labels.tab}</span>
            <span>{labels.window}</span>
          </footer>
        ) : null}
      </section>
    </div>
  )
}
