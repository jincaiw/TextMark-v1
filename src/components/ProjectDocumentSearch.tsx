import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search, X } from 'lucide-react'
import { isMacos } from '../lib/platform'
import type { FileNode, Locale } from '../types'

interface SearchEntry {
  name: string
  path: string
  relativePath: string
}

function flatten(nodes: FileNode[], prefix = ''): SearchEntry[] {
  return nodes.flatMap((node) => {
    const relativePath = prefix ? `${prefix}/${node.name}` : node.name
    return node.isDirectory
      ? flatten(node.children, relativePath)
      : /\.(?:md|markdown|mdown|mdx|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|txt)$/i.test(node.name)
        ? [{ name: node.name, path: node.path, relativePath }]
        : []
  })
}

function score(entry: SearchEntry, query: string) {
  const name = entry.name.toLocaleLowerCase()
  const path = entry.relativePath.toLocaleLowerCase()
  const needle = query.toLocaleLowerCase()
  const exact = name === needle
  const starts = name.startsWith(needle)
  const word = name.split(/[\\s._/-]+/).some((part) => part.startsWith(needle))
  let cursor = 0
  for (const character of needle) {
    cursor = path.indexOf(character, cursor)
    if (cursor < 0) return null
    cursor += 1
  }
  return (exact ? 1000 : 0) + (starts ? 500 : 0) + (word ? 250 : 0) + (name.includes(needle) ? 100 : 0) - entry.relativePath.length / 100
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
  const entries = useMemo(() => flatten(props.files), [props.files])
  const results = useMemo(() => {
    if (!query.trim()) return entries.slice(0, 30)
    return entries
      .map((entry) => ({ entry, score: score(entry, query.trim()) }))
      .filter((item): item is { entry: SearchEntry; score: number } => item.score !== null)
      .sort((a, b) => b.score - a.score || a.entry.relativePath.localeCompare(b.entry.relativePath))
      .slice(0, 30)
      .map((item) => item.entry)
  }, [entries, query])
  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => setSelected(0), [query])
  useEffect(() => resultRefs.current.get(selected)?.scrollIntoView?.({ block: 'nearest' }), [selected, results.length])

  const open = (entry: SearchEntry, mode: 'current' | 'tab' | 'window') => {
    if (mode === 'tab') props.onOpenInTab(entry.path)
    else if (mode === 'window') props.onOpenInWindow(entry.path)
    else props.onOpenCurrent(entry.path)
    props.onClose()
  }
  const highlightedName = (name: string) => {
    const characters = Array.from(name)
    const needle = Array.from(query.trim().toLocaleLowerCase())
    const matching = new Set<number>()
    let cursor = 0
    for (const character of needle) {
      while (cursor < characters.length && characters[cursor].toLocaleLowerCase() !== character) cursor += 1
      if (cursor < characters.length) matching.add(cursor++)
    }
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
              } else if (event.key === 'Enter' && results[selected]) {
                event.preventDefault()
                open(results[selected], event.altKey ? 'window' : event.metaKey || event.ctrlKey ? 'tab' : 'current')
              }
            }}
          />
          <button type="button" aria-label={props.locale === 'zh-CN' ? '关闭' : 'Close'} onClick={props.onClose}>
            <X />
          </button>
        </div>
        <div className="project-search-results" role="listbox" aria-label={labels.title}>
          {results.length ? (
            results.map((entry, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === selected}
                className={index === selected ? 'selected' : ''}
                key={entry.path}
                ref={(element) => {
                  if (element) resultRefs.current.set(index, element)
                  else resultRefs.current.delete(index)
                }}
                onMouseEnter={() => setSelected(index)}
                onClick={() => open(entry, 'current')}
              >
                <FileText aria-hidden="true" />
                <span className="project-search-file-name">{highlightedName(entry.name)}</span>
                <span className="project-search-file-path">{entry.relativePath}</span>
                {entry.path === props.activePath ? (
                  <span className="project-search-current">{props.locale === 'zh-CN' ? '当前' : 'Current'}</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="project-search-empty">{entries.length ? labels.empty : labels.noProject}</p>
          )}
        </div>
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
      </section>
    </div>
  )
}
