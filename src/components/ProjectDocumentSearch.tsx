import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search, X } from 'lucide-react'
import { isMacos } from '../lib/platform'
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

interface ProjectDocumentSearchProps {
  files: FileNode[]
  activePath: string | null
  locale: Locale
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
  const open = useCallback(
    (entry: SearchEntry, mode: 'current' | 'tab' | 'window') => {
      if (mode === 'tab') props.onOpenInTab(entry.path)
      else if (mode === 'window') props.onOpenInWindow(entry.path)
      else props.onOpenCurrent(entry.path)
      props.onClose()
    },
    [props.onClose, props.onOpenCurrent, props.onOpenInTab, props.onOpenInWindow],
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
  useEffect(() => {
    resultRefs.current.get(selected)?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, results.length])

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
              if (event.key === 'Escape') props.onClose()
              else if (event.key === 'ArrowDown' && results.length) {
                event.preventDefault()
                setSelected((value) => Math.min(value + 1, results.length - 1))
              } else if (event.key === 'ArrowUp' && results.length) {
                event.preventDefault()
                setSelected((value) => Math.max(value - 1, 0))
              } else if (event.key === 'Home' && results.length) {
                event.preventDefault()
                setSelected(0)
              } else if (event.key === 'End' && results.length) {
                event.preventDefault()
                setSelected(results.length - 1)
              } else if (event.key === 'PageUp' && results.length) {
                event.preventDefault()
                setSelected((value) => Math.max(value - 5, 0))
              } else if (event.key === 'PageDown' && results.length) {
                event.preventDefault()
                setSelected((value) => Math.min(value + 5, results.length - 1))
              } else if (event.key === 'Enter' && results[selected]) {
                event.preventDefault()
                const target = event.altKey ? 'window' : event.metaKey || event.ctrlKey ? 'tab' : 'current'
                if (resultsQuery === query.trim()) open(results[selected].entry, target)
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
        {query.trim() || !entries.length ? (
          <div className="project-search-results" role="listbox" aria-label={labels.title}>
            {results.length ? (
              results.map((result, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selected}
                  className={index === selected ? 'selected' : ''}
                  key={result.entry.path}
                  ref={(element) => {
                    if (element) resultRefs.current.set(index, element)
                    else resultRefs.current.delete(index)
                  }}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => open(result.entry, 'current')}
                >
                  <FileText aria-hidden="true" />
                  <span className="project-search-file-name">
                    {query.includes('/') ? result.entry.name : highlightedText(result.entry.name, result.positions)}
                  </span>
                  <span className="project-search-file-path">
                    {query.includes('/') ? highlightedText(result.entry.relativePath, result.positions) : result.entry.relativePath}
                  </span>
                  {result.entry.path === props.activePath ? (
                    <span className="project-search-current">{props.locale === 'zh-CN' ? '当前' : 'Current'}</span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="project-search-empty">{entries.length ? labels.empty : labels.noProject}</p>
            )}
          </div>
        ) : null}
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
