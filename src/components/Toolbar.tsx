import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  FileDown,
  FilePenLine,
  FolderOpen,
  Info,
  Minus,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Share,
  Sparkles,
} from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '../lib/platform'
import { t } from '../lib/i18n'
import { nextZoomStep } from '../constants'
import type { ExternalApplication, Locale, SidebarMode, ToolbarDisplayMode, ToolbarItem, ViewMode } from '../types'

interface ToolbarProps {
  fileName: string
  busy: boolean
  viewMode: ViewMode
  sidebarVisible: boolean
  sidebarMode: SidebarMode
  inspectorVisible: boolean
  alwaysOnTop: boolean
  zoom: number
  searchQuery: string
  locale: Locale
  items: ToolbarItem[]
  displayMode: ToolbarDisplayMode
  applications: ExternalApplication[]
  defaultOpenTarget: string
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onToggleSidebar: () => void
  onSidebarModeChange: (mode: SidebarMode) => void
  onViewModeChange: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleAlwaysOnTop: () => void
  onZoomChange: (zoom: number) => void
  onSearchQueryChange: (value: string) => void
  onSearchOpen: () => void
  onOpenWith: (application?: string) => void
  onOpenInLlm: (application: 'codex' | 'claude' | 'chatgpt') => void
  onOpen: () => void
  onOpenFolder: () => void
  onSave: () => void
  onSaveAs: () => void
  onShare: () => void
  onCopy: () => void
  onPrint: () => void
  onExportHtml: () => void
  onExportPng: () => void
  onExportPdf: () => void
  onExport: () => void
  onSettings: () => void
  onCustomizeToolbar: () => void
}

const SIMPLE_ACTIONS: Partial<
  Record<ToolbarItem, { title: Parameters<typeof t>[1]; icon: React.ReactNode; action: (p: ToolbarProps) => void }>
> = {
  inspector: { title: 'getInfo', icon: <Info />, action: (p) => p.onToggleInspector() },
  alwaysOnTop: { title: 'alwaysOnTop', icon: <Pin />, action: (p) => p.onToggleAlwaysOnTop() },
  share: { title: 'shareSource', icon: <Share />, action: (p) => p.onShare() },
  edit: { title: 'edit', icon: <FilePenLine />, action: (p) => p.onViewModeChange(p.viewMode === 'edit' ? 'preview' : 'edit') },
  print: { title: 'printItem', icon: <Printer />, action: (p) => p.onPrint() },
  copy: { title: 'copyItem', icon: <Clipboard />, action: (p) => p.onCopy() },
  export: { title: 'exportItem', icon: <FileDown />, action: (p) => p.onExport() },
  exportPdf: { title: 'exportPdf', icon: <FileDown />, action: (p) => p.onExportPdf() },
  search: { title: 'searchItem', icon: <Search />, action: (p) => p.onSearchOpen() },
}

const actionTitle = (item: ToolbarItem, props: ToolbarProps, fallback: Parameters<typeof t>[1]) =>
  item === 'edit' && props.viewMode === 'edit' ? ('stopEditing' as const) : fallback

export function Toolbar(props: ToolbarProps) {
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [hiddenCount, setHiddenCount] = useState(0)
  const actionsRef = useRef<HTMLDivElement>(null)
  const windowAction = (action: 'close' | 'minimize' | 'toggleMaximize') => {
    if (!isTauri()) return
    const window = getCurrentWindow()
    if (action === 'close') void window.close()
    else if (action === 'minimize') void window.minimize()
    else void window.toggleMaximize()
  }

  const [lastLlmTarget, setLastLlmTarget] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('textmark.lastLlmTarget') : null,
  )
  const editorApps = useMemo(
    () => props.applications.filter((application) => application.kind !== 'llm' && application.available),
    [props.applications],
  )
  const llmApps = useMemo(() => props.applications.filter((application) => application.kind === 'llm'), [props.applications])
  const defaultEditor = editorApps.find((application) => application.id === props.defaultOpenTarget) ?? editorApps[0]

  const withLabel = (icon: React.ReactNode, title: Parameters<typeof t>[1]) => (
    <>
      {icon}
      {props.displayMode === 'iconAndLabel' ? <span className="toolbar-label">{tx(title)}</span> : null}
    </>
  )
  const editorButtons = editorApps.map((application) => (
    <button key={application.id} onClick={() => props.onOpenWith(application.id)}>
      <span className="app-badge">{application.name.slice(0, 1).toUpperCase()}</span>
      <span>{application.kind === 'system' ? tx('systemDefault') : application.name}</span>
      {application.id === props.defaultOpenTarget ? <Check className="check" /> : null}
    </button>
  ))
  const defaultEditorButton = defaultEditor ? (
    <button onClick={() => props.onOpenWith(defaultEditor.id)}>
      <AppWindow />
      <span>{tx('openWithDefault')}</span>
    </button>
  ) : null
  const llmButtons = llmApps.map((application) => (
    <button
      key={application.id}
      disabled={!application.available}
      onClick={() => {
        setLastLlmTarget(application.id)
        props.onOpenInLlm(application.id as 'codex' | 'claude' | 'chatgpt')
      }}
    >
      <Sparkles />
      {application.name}
      {application.id === lastLlmTarget ? <Check className="check" /> : null}
    </button>
  ))
  const emptyAppItem = () => (
    <button disabled className="menu-empty">
      {tx('noAppsAvailable')}
    </button>
  )

  // Measure which trailing items overflow the available toolbar width and hide
  // them (they remain reachable from the app menu bar and, for simple actions,
  // from the overflow "more" menu). flexibleSpace collapses first.
  useLayoutEffect(() => {
    const container = actionsRef.current
    if (!container) return
    const compute = () => {
      const slots = Array.from(container.querySelectorAll<HTMLElement>(':scope > [data-toolbar-item]'))
      const more = container.querySelector<HTMLElement>(':scope > .more-menu')
      // Measure with everything visible: a display:none slot reports width 0
      // and would be mistaken for "fits", un-hiding everything again.
      slots.forEach((slot) => {
        slot.style.display = ''
      })
      const gap = 8
      const available = container.clientWidth - (more?.offsetWidth ?? 0) - gap
      let used = 0
      let cut = slots.length
      for (let index = 0; index < slots.length; index += 1) {
        const flexible = props.items[index] === 'flexibleSpace'
        const width = flexible ? 6 : slots[index].offsetWidth
        const extra = used > 0 ? gap : 0
        if (used + extra + width <= available) used += extra + width
        else {
          cut = index
          break
        }
      }
      // Apply hiding synchronously to avoid a crowded flash before React re-renders.
      slots.forEach((slot, index) => {
        if (index >= cut) slot.style.display = 'none'
      })
      setHiddenCount(slots.length - cut)
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [props.items, props.displayMode, props.searchQuery, props.zoom, props.viewMode])

  const renderItem = (item: ToolbarItem, index: number) => {
    const key = `${item}-${index}`
    const hidden = index >= props.items.length - hiddenCount
    const hiddenStyle = hidden ? { display: 'none' as const } : undefined
    const slot = (node: React.ReactNode) => (
      <span key={key} data-toolbar-item style={hiddenStyle}>
        {node}
      </span>
    )
    if (item === 'flexibleSpace')
      return <span key={key} data-toolbar-item data-tauri-drag-region className="toolbar-flexible-space" style={hiddenStyle} />
    if (item === 'space') return <span key={key} data-toolbar-item data-tauri-drag-region className="toolbar-space" style={hiddenStyle} />
    if (item === 'navigation')
      return slot(
        <div className="history-buttons toolbar-navigation">
          <button disabled={!props.canGoBack} aria-label="Back" onClick={props.onBack}>
            <ChevronLeft />
          </button>
          <button disabled={!props.canGoForward} aria-label="Forward" onClick={props.onForward}>
            <ChevronRight />
          </button>
        </div>,
      )
    if (item === 'sidebar')
      return slot(
        <div className="sidebar-control">
          <button
            className={props.sidebarVisible ? 'selected' : ''}
            title={tx('toggleSidebar')}
            aria-label={tx('toggleSidebar')}
            onClick={props.onToggleSidebar}
          >
            {withLabel(<PanelLeft />, 'sidebar')}
          </button>
          <details>
            <summary aria-label={tx('chooseSidebar')}>
              <ChevronDown />
            </summary>
            <div className="menu-popover sidebar-menu">
              <button onClick={props.onToggleSidebar}>{tx('hideSidebar')}</button>
              <button onClick={() => props.onSidebarModeChange('outline')}>{tx('tableOfContents')}</button>
              <button onClick={() => props.onSidebarModeChange('files')}>{tx('projectNavigator')}</button>
            </div>
          </details>
        </div>,
      )
    if (item === 'openActions')
      return slot(
        <details className="toolbar-group open-with">
          <summary title={tx('open')}>
            {withLabel(<AppWindow />, 'open')}
            <ChevronDown />
          </summary>
          <div className="menu-popover">
            {llmApps.length === 0 && editorApps.length === 0 ? (
              emptyAppItem()
            ) : (
              <>
                {defaultEditorButton}
                {llmApps.length > 0 && <b>{tx('aiApps')}</b>}
                {llmButtons}
                {llmApps.length > 0 && editorApps.length > 0 && <hr />}
                {editorApps.length > 0 && <b>{tx('editors')}</b>}
                {editorButtons}
              </>
            )}
          </div>
        </details>,
      )
    if (item === 'openWith')
      return slot(
        <details className="toolbar-group open-with">
          <summary title={tx('openWith')}>
            {withLabel(<AppWindow />, 'openWith')}
            <ChevronDown />
          </summary>
          <div className="menu-popover">
            {defaultEditorButton}
            {editorApps.length ? editorButtons : emptyAppItem()}
          </div>
        </details>,
      )
    if (item === 'openInLlm')
      return slot(
        <details className="toolbar-group open-with">
          <summary title={tx('openInLlm')}>
            {withLabel(<Sparkles />, 'openInLlm')}
            <ChevronDown />
          </summary>
          <div className="menu-popover">{llmApps.length ? llmButtons : emptyAppItem()}</div>
        </details>,
      )
    if (item === 'zoom')
      return slot(
        <div className="toolbar-group zoom-buttons" aria-label={`${tx('zoom')} ${props.zoom}%`}>
          <button title={tx('zoomOut')} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, -1))}>
            <span>A</span>
            <Minus />
          </button>
          <button title={tx('zoomIn')} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, 1))}>
            <span>A</span>
            <Plus />
          </button>
        </div>,
      )
    if (item === 'documentActions')
      return (() => {
        const editTitle = props.viewMode === 'edit' ? 'stopEditing' : 'edit'
        return slot(
          <div className="toolbar-group document-actions" aria-label={tx('documentActions')}>
            <button
              className={props.inspectorVisible ? 'selected' : ''}
              title={tx('getInfo')}
              aria-label={tx('getInfo')}
              onClick={props.onToggleInspector}
            >
              {withLabel(<Info />, 'getInfo')}
            </button>
            <button title={tx('shareSource')} aria-label={tx('shareSource')} onClick={props.onShare}>
              {withLabel(<Share />, 'shareSource')}
            </button>
            <button
              className={props.viewMode === 'edit' ? 'selected edit-active' : ''}
              title={tx(editTitle)}
              aria-label={tx(editTitle)}
              onClick={() => props.onViewModeChange(props.viewMode === 'edit' ? 'preview' : 'edit')}
            >
              {withLabel(<FilePenLine />, editTitle)}
            </button>
          </div>,
        )
      })()
    if (item === 'search')
      return slot(
        <label className="document-search" onClick={props.onSearchOpen}>
          <Search />
          <input
            value={props.searchQuery}
            onFocus={props.onSearchOpen}
            onChange={(event) => props.onSearchQueryChange(event.target.value)}
            placeholder={tx('search')}
          />
        </label>,
      )
    const simple = SIMPLE_ACTIONS[item]
    if (simple) {
      const title = actionTitle(item, props, simple.title)
      const active =
        (item === 'inspector' && props.inspectorVisible) ||
        (item === 'edit' && props.viewMode === 'edit') ||
        (item === 'alwaysOnTop' && props.alwaysOnTop)
      return slot(
        <button
          className={`toolbar-item-button ${props.displayMode === 'iconAndLabel' ? 'with-label' : ''} ${active ? 'selected' : ''} ${item === 'edit' && active ? 'edit-active' : ''}`}
          title={tx(title)}
          aria-label={tx(title)}
          onClick={() => {
            if (item === 'copy') {
              props.onCopy()
              setCopiedFlash(true)
              window.setTimeout(() => setCopiedFlash(false), 1200)
            } else simple.action(props)
          }}
        >
          {withLabel(item === 'copy' && copiedFlash ? <Check /> : simple.icon, title)}
        </button>,
      )
    }
    return null
  }

  const overflowItems = props.items.slice(props.items.length - hiddenCount).filter((item) => SIMPLE_ACTIONS[item] && item !== 'copy')

  return (
    <header
      className="native-toolbar"
      data-tauri-drag-region
      onClick={(event) => {
        const details = (event.target as HTMLElement).closest('.menu-popover button')?.closest('details')
        if (details) window.setTimeout(() => details.removeAttribute('open'), 0)
      }}
    >
      <div className="window-leading" data-tauri-drag-region>
        <div className="traffic-lights">
          <button aria-label={tx('close')} onClick={() => windowAction('close')} />
          <button aria-label={tx('minimize')} onClick={() => windowAction('minimize')} />
          <button aria-label={tx('maximize')} onClick={() => windowAction('toggleMaximize')} />
        </div>
      </div>
      <div className="native-actions" ref={actionsRef} data-tauri-drag-region>
        {props.items.map(renderItem)}
        <details className="more-menu">
          <summary title={tx('more')}>
            <MoreHorizontal />
          </summary>
          <div className="menu-popover align-right">
            {overflowItems.map((item) => {
              const meta = SIMPLE_ACTIONS[item]!
              const title = actionTitle(item, props, meta.title)
              return (
                <button key={`overflow-${item}`} onClick={() => meta.action(props)}>
                  {meta.icon}
                  {tx(title)}
                </button>
              )
            })}
            {overflowItems.length > 0 && <hr />}
            <button onClick={props.onOpen}>
              <FolderOpen />
              {tx('openFile')}
            </button>
            <button onClick={props.onOpenFolder}>
              <FolderOpen />
              {tx('openFolder')}
            </button>
            <button onClick={props.onSave} disabled={props.busy}>
              <Save />
              {tx('save')}
            </button>
            <button onClick={props.onSaveAs}>
              <Download />
              {tx('saveAs')}
            </button>
            <hr />
            <button onClick={props.onCopy}>
              <Clipboard />
              {tx('copySource')}
            </button>
            <button onClick={props.onPrint}>
              <Printer />
              {tx('print')}
            </button>
            <button onClick={props.onExportHtml}>
              <FileDown />
              {tx('exportHtml')}
            </button>
            <button onClick={props.onExportPdf}>
              <FileDown />
              {tx('exportPdf')}
            </button>
            <button onClick={props.onExportPng}>
              <FileDown />
              {tx('exportPng')}
            </button>
            <hr />
            <button onClick={props.onCustomizeToolbar}>
              <Settings />
              {tx('customizeToolbar')}
            </button>
            <button onClick={props.onSettings}>
              <Settings />
              {tx('preferences')}…
            </button>
          </div>
        </details>
      </div>
    </header>
  )
}
