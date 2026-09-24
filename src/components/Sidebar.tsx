import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import type { ExternalApplication, FileNode, OutlineItem, SidebarMode } from '../types'
import { t } from '../lib/i18n'
import type { Locale } from '../types'

/** Shared empty set so an untouched document does not allocate on every render. */
const EMPTY_HEADINGS: ReadonlySet<string> = new Set<string>()

interface TreeNodeProps {
  node: FileNode
  activePath: string | null
  depth: number
  onOpenFile: (path: string) => void
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void
}

function TreeNode({ node, activePath, depth, onOpenFile, onContextMenu }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  if (node.isDirectory) {
    return (
      <div>
        <button
          className="tree-row"
          style={{ paddingLeft: 12 + depth * 16 }}
          aria-expanded={expanded}
          aria-level={depth + 1}
          onClick={() => setExpanded((value) => !value)}
          onContextMenu={(event) => onContextMenu(event, node)}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
          {expanded ? <FolderOpen /> : <Folder />}
          <span>{node.name}</span>
        </button>
        {expanded
          ? node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                onContextMenu={onContextMenu}
              />
            ))
          : null}
      </div>
    )
  }
  return (
    <button
      className={`tree-row file ${activePath === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 31 + depth * 16 }}
      aria-level={depth + 1}
      aria-current={activePath === node.path ? 'true' : undefined}
      onClick={() => onOpenFile(node.path)}
      onContextMenu={(event) => onContextMenu(event, node)}
      title={node.path}
    >
      <FileText />
      <span>{node.name}</span>
    </button>
  )
}

interface SidebarProps {
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
  locale: Locale
}

export function Sidebar(props: SidebarProps) {
  const workspaceName = props.workspacePath?.split(/[\\/]/).pop()
  const [collapsedByDocument, setCollapsedByDocument] = useState<Record<string, Set<string>>>({})
  const collapsedHeadings = collapsedByDocument[props.documentKey] ?? EMPTY_HEADINGS
  const toggleHeading = (id: string) =>
    setCollapsedByDocument((current) => {
      const next = new Set(current[props.documentKey] ?? [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...current, [props.documentKey]: next }
    })
  const [context, setContext] = useState<{ x: number; y: number; node: FileNode } | null>(null)
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
  const closeContext = () => setContext(null)
  const run = (action: () => void) => {
    action()
    closeContext()
  }
  return (
    <aside className="native-sidebar">
      <div className="sidebar-section-title">
        <strong>{props.mode === 'outline' ? props.fileName : (workspaceName ?? t(props.locale, 'project'))}</strong>
      </div>
      {props.mode === 'outline' ? (
        <nav className="native-outline" aria-label={t(props.locale, 'tableOfContents')}>
          {props.outline.length ? (
            visibleOutline.map((item) => {
              const sourceIndex = props.outline.findIndex((candidate) => candidate.id === item.id)
              const expandable = hasChildHeading(sourceIndex)
              const collapsed = collapsedHeadings.has(item.id)
              return (
                <div key={item.id} className="outline-row">
                  {expandable ? (
                    <button
                      className="outline-disclosure"
                      aria-label={collapsed ? '展开子标题' : '折叠子标题'}
                      aria-expanded={!collapsed}
                      onClick={() => toggleHeading(item.id)}
                    >
                      {collapsed ? <ChevronRight /> : <ChevronDown />}
                    </button>
                  ) : null}
                  <button
                    className={`outline-level-${item.level} ${props.activeHeading === item.id ? 'active' : ''}`}
                    aria-current={props.activeHeading === item.id ? 'location' : undefined}
                    style={{ paddingLeft: 18 + (item.level - 1) * 18 + (expandable ? 0 : 18) }}
                    onClick={() => props.onOutlineSelect(item.id)}
                  >
                    <span>{item.text}</span>
                  </button>
                </div>
              )
            })
          ) : (
            <p>{t(props.locale, 'noHeadings')}</p>
          )}
        </nav>
      ) : (
        <div className="native-file-tree">
          {props.files.length ? (
            props.files.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                activePath={props.activePath}
                depth={0}
                onOpenFile={props.onOpenFile}
                onContextMenu={contextMenu}
              />
            ))
          ) : (
            <div className="sidebar-empty">
              <FolderOpen />
              <p>{t(props.locale, 'openFolder')}</p>
              <button onClick={props.onOpenFolder}>{t(props.locale, 'openFolder')}</button>
            </div>
          )}
        </div>
      )}
      {context ? (
        <div className="project-context-menu" role="menu" style={{ left: context.x, top: context.y }} onMouseLeave={closeContext}>
          {!context.node.isDirectory ? (
            <>
              <button role="menuitem" onClick={() => run(() => props.onOpenFile(context.node.path))}>
                {t(props.locale, 'openFile')}
              </button>
              <button role="menuitem" onClick={() => run(() => props.onOpenFileInTab(context.node.path))}>
                {t(props.locale, 'openInNewTab')}
              </button>
              <button role="menuitem" onClick={() => run(() => props.onOpenFileInWindow(context.node.path))}>
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
                {t(props.locale, 'openWithExternalEditor')}
              </button>
              <div className="context-submenu">
                <button role="menuitem">
                  {t(props.locale, 'openAs')}
                  <ChevronRight />
                </button>
                <div className="context-submenu-panel">
                  {editors.length ? (
                    editors.map((application) => (
                      <button
                        key={application.id}
                        role="menuitem"
                        onClick={() => run(() => props.onOpenFileWith(context.node.path, application.id))}
                      >
                        {application.kind === 'system' ? t(props.locale, 'systemDefault') : application.name}
                      </button>
                    ))
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
            {t(props.locale, 'showInFileManager')}
          </button>
          <button role="menuitem" onClick={() => run(() => props.onCopyFilePath(context.node.path))}>
            {t(props.locale, 'copyPath')}
          </button>
          <button role="menuitem" onClick={() => run(() => props.onCopyFileContents(context.node.path))}>
            {t(props.locale, 'copyContents')}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
