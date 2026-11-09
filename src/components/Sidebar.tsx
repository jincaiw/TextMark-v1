import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  ListFilter,
  Plus,
  SquarePen,
} from 'lucide-react'
import type { ExternalApplication, FileNode, OutlineItem, SidebarMode } from '../types'
import { t } from '../lib/i18n'
import { useFileIcons } from '../hooks/useFileIcons'
import type { Locale } from '../types'

/** Shared empty set so an untouched document does not allocate on every render. */
const EMPTY_HEADINGS: ReadonlySet<string> = new Set<string>()

const COLLAPSED_STORAGE_KEY = 'textmark.outlineCollapsed'
const COLLAPSED_STORAGE_LIMIT = 40
/** Per-workspace expanded-folder paths, so the navigator reopens the way the
 * reader left it across restarts and workspace switches (upstream keeps the
 * navigator's expansion state alive for the session; TextMark persists it). */
const TREE_EXPANDED_STORAGE_KEY = 'textmark.treeExpanded'
const TREE_EXPANDED_STORAGE_LIMIT = 40

function readStoredStringMap(key: string, limit: number, storage: Pick<Storage, 'getItem'> = localStorage): Record<string, string[]> {
  try {
    const raw = storage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([entryKey, value]) => typeof entryKey === 'string' && Array.isArray(value) && value.every((id) => typeof id === 'string'),
    ) as Array<[string, string[]]>
    return Object.fromEntries(entries.slice(-limit))
  } catch {
    return {}
  }
}

function writeStoredStringMap(
  key: string,
  limit: number,
  state: Record<string, Set<string>>,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    // Keep the newest entries only; the map is a convenience cache, not data.
    const entries = Object.entries(state).slice(-limit)
    storage.setItem(key, JSON.stringify(Object.fromEntries(entries.map(([entryKey, ids]) => [entryKey, [...ids]]))))
  } catch {
    // Quota or private-mode failures leave the session state intact.
  }
}

function readCollapsedState(storage: Pick<Storage, 'getItem'> = localStorage): Record<string, string[]> {
  return readStoredStringMap(COLLAPSED_STORAGE_KEY, COLLAPSED_STORAGE_LIMIT, storage)
}

function writeCollapsedState(state: Record<string, Set<string>>, storage: Pick<Storage, 'setItem'> = localStorage): void {
  writeStoredStringMap(COLLAPSED_STORAGE_KEY, COLLAPSED_STORAGE_LIMIT, state, storage)
}

function readExpandedFolders(storage: Pick<Storage, 'getItem'> = localStorage): Record<string, string[]> {
  return readStoredStringMap(TREE_EXPANDED_STORAGE_KEY, TREE_EXPANDED_STORAGE_LIMIT, storage)
}

function writeExpandedFolders(state: Record<string, Set<string>>, storage: Pick<Storage, 'setItem'> = localStorage): void {
  writeStoredStringMap(TREE_EXPANDED_STORAGE_KEY, TREE_EXPANDED_STORAGE_LIMIT, state, storage)
}

/** Narrow a file tree to nodes matching the query, keeping every ancestor
 * folder of each match so the filtered tree stays navigable. Mirrors the
 * upstream navigator's filter: file-name substring, case-insensitive. */
function filterTree(nodes: FileNode[], query: string): FileNode[] {
  const needle = query.toLowerCase()
  const walk = (children: FileNode[]): FileNode[] =>
    children.reduce<FileNode[]>((kept, node) => {
      if (node.isDirectory) {
        const children = walk(node.children)
        if (children.length) return [...kept, { ...node, children }]
        return kept
      }
      return node.name.toLowerCase().includes(needle) ? [...kept, node] : kept
    }, [])
  return walk(nodes)
}

/** True when a folder's subtree contains at least one file matching the query
 * (case-insensitive substring), i.e. the folder will still render when the
 * filter is applied. */
function matchesSubtree(node: FileNode, needleLower: string): boolean {
  if (node.isDirectory) return node.children.some((child) => matchesSubtree(child, needleLower))
  return node.name.toLowerCase().includes(needleLower)
}

interface TreeNodeProps {
  node: FileNode
  activePath: string | null
  depth: number
  /** Expanded directory paths for the current workspace (persisted). */
  expandedFolders: ReadonlySet<string>
  onToggleFolder: (path: string) => void
  onOpenFile: (path: string) => void
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void
  /** Double-click starts an inline rename; with a name it commits. */
  onRename: (node: FileNode, newName?: string | null) => void
  /** Shared Finder-icon cache: maps path to a PNG data URL ('' while loading
   * or unavailable). Rows request their icon on first render. */
  icons: Readonly<Record<string, string>>
  requestIcon: (path: string) => void
  /** Set while this row's name is being edited inline. */
  renaming: boolean
}

function TreeNode({
  node,
  activePath,
  depth,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  onContextMenu,
  onRename,
  renaming,
  icons,
  requestIcon,
}: TreeNodeProps) {
  // Start with a compact navigator. Expansion lives in a per-workspace map
  // owned by the Sidebar: expanding two levels by default makes large
  // workspaces (and especially application bundles) flood the sidebar and
  // squeeze the document canvas before the reader has chosen a folder.
  const expanded = node.isDirectory && expandedFolders.has(node.path)
  // Like the upstream navigator's NSWorkspace.icon(forFile:) rows, each row
  // loads its real file icon once; the generic lucide glyph shows until the
  // data URL arrives (or forever outside Tauri, where it resolves '').
  useEffect(() => {
    requestIcon(node.path)
  }, [node.path, requestIcon])
  const icon = icons[node.path]
  const iconImage = icon ? <img className="tree-file-icon" src={icon} alt="" aria-hidden="true" /> : null
  if (node.isDirectory) {
    return (
      <div>
        <button
          className="tree-row"
          style={{ paddingLeft: 10 + depth * 14 }}
          aria-expanded={expanded}
          aria-level={depth + 1}
          onClick={() => onToggleFolder(node.path)}
          onDoubleClick={(event) => {
            event.stopPropagation()
            onRename(node)
          }}
          onContextMenu={(event) => onContextMenu(event, node)}
        >
          {expanded ? <ChevronDown className="tree-disclosure" /> : <ChevronRight className="tree-disclosure" />}
          {expanded ? <FolderOpen /> : <Folder />}
          {renaming ? <RenameField node={node} onRename={onRename} /> : <span>{node.name}</span>}
        </button>
        {expanded
          ? node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                onContextMenu={onContextMenu}
                onRename={onRename}
                renaming={renaming}
                icons={icons}
                requestIcon={requestIcon}
              />
            ))
          : null}
      </div>
    )
  }
  return (
    <button
      className={`tree-row file ${activePath === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 28 + depth * 14 }}
      aria-level={depth + 1}
      aria-current={activePath === node.path ? 'true' : undefined}
      onClick={() => onOpenFile(node.path)}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onRename(node)
      }}
      onContextMenu={(event) => onContextMenu(event, node)}
      title={node.path}
    >
      {iconImage ?? <FileText />}
      {renaming ? <RenameField node={node} onRename={onRename} /> : <span>{node.name}</span>}
    </button>
  )
}

/** The inline rename editor. Enter commits, Escape cancels, blur commits —
 * mirroring the upstream label editor's field editor semantics. */
function RenameField({ node, onRename }: { node: FileNode; onRename: (node: FileNode, newName: string | null) => void }) {
  const [value, setValue] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    // Select the base name without the extension, as the Finder does.
    const dot = node.isDirectory ? -1 : node.name.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : node.name.length)
  }, [node.isDirectory, node.name])
  const commit = () => {
    const typed = value.trim()
    onRename(node, !typed || typed === node.name ? null : typed)
  }
  return (
    <input
      ref={inputRef}
      className="tree-rename-field"
      value={value}
      aria-label={node.name}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') commit()
        else if (event.key === 'Escape') onRename(node, null)
      }}
      onBlur={commit}
    />
  )
}

interface SidebarProps {
  visible?: boolean
  mode: SidebarMode
  fileName: string
  /** Identifies the active document. Heading collapse state is kept per
   * document: outline ids are derived from heading text, so two documents that
   * share a heading name would otherwise share its collapsed state. */
  documentKey: string
  files: FileNode[]
  workspacePath: string | null
  activePath: string | null
  outline: OutlineItem[]
  activeHeading: string | null
  applications: ExternalApplication[]
  defaultOpenTarget: string
  onOpenFolder: () => void
  onOpenFile: (path: string) => void
  onOpenFileInTab: (path: string) => void
  onOpenFileInWindow: (path: string) => void
  onOpenFileWith: (path: string, application: string) => void
  onRevealFile: (path: string) => void
  onCopyFilePath: (path: string) => void
  onCopyFileContents: (path: string) => void
  onOutlineSelect: (id: string) => void
  /** Navigator file management (the upstream "+" add menu and inline rename).
   * create receives the target folder and whether a folder is wanted;
   * rename receives the entry path and the typed name. */
  onCreateEntry?: (directory: string, isDirectory: boolean, contents: string | null) => void
  /** "Add Files to…": the reader picks files anywhere; copies land in the
   * navigator's folder (upstream ProjectNavigatorView addFilesFromURLs). */
  onImportFiles?: (directory: string) => void
  onRenameEntry?: (path: string, newName: string) => void
  locale: Locale
}

export function Sidebar(props: SidebarProps) {
  const fileTreeRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (props.mode !== 'files' || props.visible === false || !props.activePath) return
    const tree = fileTreeRef.current
    const active = tree?.querySelector<HTMLElement>('.tree-row.file.active')
    if (!tree || !active) return
    const treeBounds = tree.getBoundingClientRect()
    const activeBounds = active.getBoundingClientRect()
    // Keep the current document visible even in a folder with many siblings.
    // Adjust only the file navigator, never the document's reading position.
    if (activeBounds.top < treeBounds.top) tree.scrollTop += activeBounds.top - treeBounds.top
    else if (activeBounds.bottom > treeBounds.bottom) tree.scrollTop += activeBounds.bottom - treeBounds.bottom
  }, [props.activePath, props.files, props.mode, props.visible])
  const workspaceName = props.workspacePath?.split(/[\\/]/).pop()
  const [collapsedByDocument, setCollapsedByDocument] = useState<Record<string, Set<string>>>(() => {
    const stored = readCollapsedState()
    return Object.fromEntries(Object.entries(stored).map(([key, ids]) => [key, new Set(ids)]))
  })
  useLayoutEffect(() => {
    writeCollapsedState(collapsedByDocument)
  }, [collapsedByDocument])
  const collapsedHeadings = collapsedByDocument[props.documentKey] ?? EMPTY_HEADINGS
  const toggleHeading = (id: string) =>
    setCollapsedByDocument((current) => {
      const next = new Set(current[props.documentKey] ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...current, [props.documentKey]: next }
    })
  // Mirrors the upstream scroll-follow behavior (SidebarViewController.swift):
  // revealing the active heading expands its collapsed ancestors, so the
  // position indicator can never silently disappear behind a folded section.
  const expandedForActiveRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    const active = props.activeHeading
    if (!active || props.mode !== 'outline') return
    if (expandedForActiveRef.current === active) return
    expandedForActiveRef.current = active
    const collapsed = collapsedByDocument[props.documentKey]
    if (!collapsed || !collapsed.size) return
    const ancestors = new Set<string>()
    const activeIndex = props.outline.findIndex((item) => item.id === active)
    if (activeIndex < 0) return
    let level = props.outline[activeIndex].level
    for (let index = activeIndex - 1; index >= 0; index -= 1) {
      const candidate = props.outline[index]
      if (candidate.level >= level) continue
      ancestors.add(candidate.id)
      level = candidate.level
      if (level <= 1) break
    }
    let overlapsCollapsed = false
    ancestors.forEach((id) => {
      if (collapsed.has(id)) overlapsCollapsed = true
    })
    if (!overlapsCollapsed) return
    const next = new Set(collapsed)
    ancestors.forEach((id) => next.delete(id))
    setCollapsedByDocument((current) => ({ ...current, [props.documentKey]: next }))
  }, [props.activeHeading, props.mode, props.documentKey, props.outline, collapsedByDocument])
  const [context, setContext] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  // Navigator filter bar state (mirrors ProjectNavigatorFilterBar): a capsule
  // field filtering the tree by file name, and a clock toggle limiting it to
  // recently opened files. Esc clears the field before it ever closes anything.
  const [filterText, setFilterText] = useState('')
  const [recentOnly, setRecentOnly] = useState(false)
  const [recentPaths, setRecentPaths] = useState<ReadonlySet<string>>(new Set())
  const filterInputRef = useRef<HTMLInputElement>(null)
  const recentOnlyRef = useRef(false)
  recentOnlyRef.current = recentOnly
  // Expanded navigator folders, keyed by workspace so each project reopens
  // with the tree shape the reader last chose; survives restarts like the
  // outline's per-document folds.
  const [expandedByWorkspace, setExpandedByWorkspace] = useState<Record<string, Set<string>>>(() => {
    const stored = readExpandedFolders()
    return Object.fromEntries(Object.entries(stored).map(([key, paths]) => [key, new Set(paths)]))
  })
  useLayoutEffect(() => {
    writeExpandedFolders(expandedByWorkspace)
  }, [expandedByWorkspace])
  const expandedKey = props.workspacePath ?? ''
  const expandedFolders = expandedByWorkspace[expandedKey] ?? EMPTY_HEADINGS
  const toggleFolder = (path: string) =>
    setExpandedByWorkspace((current) => {
      const next = new Set(current[expandedKey] ?? [])
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { ...current, [expandedKey]: next }
    })
  // While a filter narrows the tree, remember what was expanded so clearing
  // the filter restores the navigator exactly as it stood (upstream
  // expandedBeforeFilter, ProjectNavigatorView.swift:74,209-233).
  const expandedBeforeFilterRef = useRef<Set<string> | null>(null)
  const isFiltering = Boolean(filterText.trim()) || (recentOnly && recentPaths.size > 0)
  useLayoutEffect(() => {
    if (props.mode !== 'files') return
    if (isFiltering) {
      if (expandedBeforeFilterRef.current === null) {
        expandedBeforeFilterRef.current = new Set(expandedFolders)
        const narrowed = new Set<string>()
        // Reveal every ancestor of a visible match so the filter results are
        // readable without manually unfolding each level. Unmatched folders
        // keep their stored expansion (they simply do not render).
        const query = filterText.trim().toLowerCase()
        const reveal = (nodes: FileNode[]) => {
          for (const node of nodes) {
            if (!node.isDirectory) continue
            if (query && !recentOnly && matchesSubtree(node, query)) narrowed.add(node.path)
            reveal(node.children)
          }
        }
        reveal(props.files)
        setExpandedByWorkspace((current) => ({ ...current, [expandedKey]: narrowed }))
      }
      return
    }
    // Filter cleared: restore the pre-filter shape (or just drop the snapshot
    // when the filter never actually engaged).
    if (expandedBeforeFilterRef.current !== null) {
      const restored = expandedBeforeFilterRef.current
      expandedBeforeFilterRef.current = null
      setExpandedByWorkspace((current) => ({ ...current, [expandedKey]: restored }))
    }
  }, [props.mode, props.files, isFiltering])
  useLayoutEffect(() => {
    if (props.mode !== 'files') return
    let cancelled = false
    void import('../lib/platform').then(({ listRecentFiles }) =>
      listRecentFiles().then((files) => {
        if (!cancelled) setRecentPaths(new Set(files))
      }),
    )
    return () => {
      cancelled = true
    }
  }, [props.mode])
  const recentPathsRef = useRef(recentPaths)
  recentPathsRef.current = recentPaths
  const filteredFiles = useMemo(() => {
    if (props.mode !== 'files') return props.files
    const query = filterText.trim().toLowerCase()
    let candidates = props.files
    if (recentOnly && recentPaths.size) candidates = filterTree(candidates, '')
    const filtered = query ? filterTree(candidates, query) : candidates
    if (!recentOnly || !recentPaths.size) return filtered
    const keep = (nodes: FileNode[]): FileNode[] =>
      nodes.reduce<FileNode[]>((kept, node) => {
        if (node.isDirectory) {
          const children = keep(node.children)
          return children.length ? [...kept, { ...node, children }] : kept
        }
        return recentPathsRef.current.has(node.path) ? [...kept, node] : kept
      }, [])
    return keep(filtered)
  }, [props.files, props.mode, filterText, recentOnly, recentPaths])
  const visibleFileList = filteredFiles
  const clearFilter = () => {
    setFilterText('')
    setRecentOnly(false)
    filterInputRef.current?.focus()
  }
  // The upstream "+" opens an add menu (New Empty File / New File from
  // Clipboard / New Folder); the created row goes straight into inline rename.
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!addMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [addMenuOpen])
  // Inline rename: the node being renamed, by path. The tree renders the
  // editor in that row; commit goes through the platform rename command.
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const commitRename = (node: FileNode, newName?: string | null) => {
    if (newName === undefined) {
      // Double-click on a row begins the inline rename.
      if (!props.onRenameEntry) return
      setFilterText('')
      setRenamingPath(node.path)
      return
    }
    setRenamingPath(null)
    if (newName) props.onRenameEntry?.(node.path, newName)
  }
  const visibleOutline = props.outline.filter((item, index) => {
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const ancestor = props.outline[previous]
      if (ancestor.level >= item.level) continue
      if (collapsedHeadings.has(ancestor.id)) return false
    }
    return true
  })
  const hasChildHeading = (index: number) => props.outline[index + 1]?.level > props.outline[index].level
  const contextMenu = (event: React.MouseEvent, node: FileNode) => {
    event.preventDefault()
    setContext({ x: event.clientX, y: event.clientY, node })
  }
  const editors = props.applications.filter((application) => application.kind !== 'llm' && application.available)
  const { icons: menuIcons, requestIcon } = useFileIcons()
  // The upstream context menu renders each editor entry with its real app
  // icon; load icons for the available editors once the menu opens.
  useEffect(() => {
    if (!context) return
    editors.forEach((application) => {
      if (application.macApp) requestIcon(application.macApp)
    })
  }, [context, editors, requestIcon])
  const closeContext = () => setContext(null)
  const run = (action: () => void) => {
    action()
    closeContext()
  }
  return (
    <aside className={`native-sidebar ${props.visible === false ? 'sidebar-collapsed' : ''}`} aria-hidden={props.visible === false}>
      {props.mode === 'files' ? (
        <div className="sidebar-section-title">
          <strong>{workspaceName ?? t(props.locale, 'project')}</strong>
        </div>
      ) : null}
      {props.mode === 'outline' ? (
        <nav className="native-outline" aria-label={t(props.locale, 'tableOfContents')}>
          {/* The file name is the outline's first, non-selectable row — the
              upstream TitleItem — so it scrolls away with the headings
              instead of staying pinned above them. */}
          {props.fileName ? (
            <div className="outline-title-row" title={props.fileName}>
              {props.fileName}
            </div>
          ) : null}
          {visibleOutline.map((item) => {
            const sourceIndex = props.outline.findIndex((candidate) => candidate.id === item.id)
            const expandable = hasChildHeading(sourceIndex)
            const collapsed = collapsedHeadings.has(item.id)
            return (
              <div
                key={item.id}
                className={`outline-row ${props.activeHeading === item.id ? 'active' : ''}`}
                // Upstream indents the whole source-list row, disclosure
                // included, 12pt per level.
                style={{ paddingLeft: (item.level - 1) * 12 }}
              >
                {expandable ? (
                  <button
                    className="outline-disclosure"
                    aria-label={collapsed ? '展开子标题' : '折叠子标题'}
                    aria-expanded={!collapsed}
                    onClick={() => toggleHeading(item.id)}
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {collapsed ? <ChevronRight /> : <ChevronDown />}
                  </button>
                ) : null}
                <button
                  className={`outline-level-${item.level}`}
                  aria-current={props.activeHeading === item.id ? 'location' : undefined}
                  // A leaf sits at the cell's own leading inset instead of
                  // reserving the disclosure's gutter: a native source-list row
                  // only shifts its label right when it shows a chevron. The
                  // gutter stays a token so each platform keeps its own inset.
                  style={{ paddingLeft: expandable ? 1.5 : `calc(1.5px + var(--outline-leaf-gutter, 16px))` }}
                  onClick={() => props.onOutlineSelect(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span>{item.text}</span>
                </button>
              </div>
            )
          })}
        </nav>
      ) : (
        <>
          <div className="native-file-tree" ref={fileTreeRef}>
            {props.files.length ? (
              visibleFileList.length ? (
                visibleFileList.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    activePath={props.activePath}
                    depth={0}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onOpenFile={props.onOpenFile}
                    onContextMenu={contextMenu}
                    onRename={commitRename}
                    renaming={renamingPath === node.path}
                    icons={menuIcons}
                    requestIcon={requestIcon}
                  />
                ))
              ) : (
                <p className="sidebar-filter-empty">{t(props.locale, 'filterNoMatches')}</p>
              )
            ) : (
              <div className="sidebar-empty">
                <FolderOpen />
                <p>{t(props.locale, 'openFolder')}</p>
                <button onClick={props.onOpenFolder}>{t(props.locale, 'openFolder')}</button>
              </div>
            )}
          </div>
          <div className="sidebar-filter-bar">
            <div className="sidebar-add-wrap" ref={addMenuRef}>
              <button
                className="sidebar-filter-add"
                aria-label={t(props.locale, 'addMenu')}
                title={t(props.locale, 'addMenu')}
                aria-expanded={addMenuOpen}
                onClick={() => setAddMenuOpen((value) => !value)}
              >
                <Plus />
              </button>
              {addMenuOpen ? (
                <div className="sidebar-add-menu" role="menu">
                  <button
                    role="menuitem"
                    disabled={!props.workspacePath || !props.onCreateEntry}
                    onClick={() => {
                      setAddMenuOpen(false)
                      if (props.workspacePath) props.onCreateEntry?.(props.workspacePath, false, null)
                    }}
                  >
                    {t(props.locale, 'newEmptyFile')}
                  </button>
                  <button
                    role="menuitem"
                    disabled={!props.workspacePath || !props.onCreateEntry}
                    onClick={async () => {
                      setAddMenuOpen(false)
                      if (!props.workspacePath) return
                      try {
                        const text = await navigator.clipboard.readText()
                        if (text) props.onCreateEntry?.(props.workspacePath, false, text)
                      } catch {
                        // Clipboard read denied: create the empty file anyway.
                        props.onCreateEntry?.(props.workspacePath, false, null)
                      }
                    }}
                  >
                    <Clipboard />
                    {t(props.locale, 'newFileFromClipboard')}
                  </button>
                  <hr />
                  <button
                    role="menuitem"
                    disabled={!props.workspacePath || !props.onCreateEntry}
                    onClick={() => {
                      setAddMenuOpen(false)
                      if (props.workspacePath) props.onCreateEntry?.(props.workspacePath, true, null)
                    }}
                  >
                    {t(props.locale, 'newFolder')}
                  </button>
                  <hr />
                  <button
                    role="menuitem"
                    disabled={!props.workspacePath || !props.onImportFiles}
                    onClick={() => {
                      setAddMenuOpen(false)
                      if (props.workspacePath) props.onImportFiles?.(props.workspacePath)
                    }}
                  >
                    {t(props.locale, 'addFiles')}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="sidebar-filter-field">
              <ListFilter />
              <input
                ref={filterInputRef}
                type="text"
                value={filterText}
                placeholder={t(props.locale, 'filterFiles')}
                aria-label={t(props.locale, 'filterFiles')}
                onChange={(event) => setFilterText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && (filterText || recentOnly)) {
                    event.stopPropagation()
                    clearFilter()
                  }
                }}
              />
              <button
                className={`sidebar-filter-recent ${recentOnly ? 'on' : ''}`}
                aria-label={t(props.locale, 'showOnlyRecentFiles')}
                aria-pressed={recentOnly}
                title={t(props.locale, 'showOnlyRecentFiles')}
                onClick={() => setRecentOnly((value) => !value)}
              >
                <Clock />
              </button>
            </div>
          </div>
        </>
      )}
      {context ? (
        <div className="project-context-menu" role="menu" style={{ left: context.x, top: context.y }} onMouseLeave={closeContext}>
          {!context.node.isDirectory ? (
            <>
              <button role="menuitem" onClick={() => run(() => props.onOpenFile(context.node.path))}>
                <FileText />
                {t(props.locale, 'openFile')}
              </button>
              <button role="menuitem" onClick={() => run(() => props.onOpenFileInTab(context.node.path))}>
                <AppWindow />
                {t(props.locale, 'openInNewTab')}
              </button>
              <button role="menuitem" onClick={() => run(() => props.onOpenFileInWindow(context.node.path))}>
                <ExternalLink />
                {t(props.locale, 'openInNewWindow')}
              </button>
              <hr />
              <button
                role="menuitem"
                disabled={!editors.length}
                onClick={() =>
                  run(() =>
                    props.onOpenFileWith(
                      context.node.path,
                      props.defaultOpenTarget === 'system'
                        ? 'system'
                        : editors.some((e) => e.id === props.defaultOpenTarget)
                          ? props.defaultOpenTarget
                          : 'system',
                    ),
                  )
                }
              >
                <SquarePen />
                {t(props.locale, 'openWithExternalEditor')}
              </button>
              <div className="context-submenu">
                <button role="menuitem">
                  {t(props.locale, 'openAs')}
                  <ChevronRight />
                </button>
                <div className="context-submenu-panel">
                  {editors.length ? (
                    editors.map((application) => {
                      const icon = application.macApp ? menuIcons[application.macApp] : undefined
                      return (
                        <button
                          key={application.id}
                          role="menuitem"
                          onClick={() => run(() => props.onOpenFileWith(context.node.path, application.id))}
                        >
                          {icon ? (
                            <img className="context-app-icon" src={icon} alt="" aria-hidden="true" />
                          ) : (
                            <span className="context-app-icon-fallback" aria-hidden="true">
                              {application.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          {application.kind === 'system' ? t(props.locale, 'systemDefault') : application.name}
                        </button>
                      )
                    })
                  ) : (
                    <button role="menuitem" disabled>
                      {t(props.locale, 'noEditorsAvailable')}
                    </button>
                  )}
                </div>
              </div>
              <hr />
            </>
          ) : null}
          <button role="menuitem" onClick={() => run(() => props.onRevealFile(context.node.path))}>
            <FolderOpen />
            {t(props.locale, 'showInFileManager')}
          </button>
          <button role="menuitem" onClick={() => run(() => props.onCopyFilePath(context.node.path))}>
            <Clipboard />
            {t(props.locale, 'copyPath')}
          </button>
          <button role="menuitem" onClick={() => run(() => props.onCopyFileContents(context.node.path))}>
            <Copy />
            {t(props.locale, 'copyContents')}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
