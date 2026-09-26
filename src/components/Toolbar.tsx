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
  Folder,
  Info,
  ListTree,
  ALargeSmall,
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
import type { ExternalApplication, Locale, SidebarMode, ToolbarDisplayMode, ToolbarItem, ViewMode, ThemeMode, ThemePreset } from '../types'
import { ToolbarAppearance } from './ToolbarAppearance'

interface ToolbarProps {
  documentName?: string
  busy: boolean
  viewMode: ViewMode
  sidebarVisible: boolean
  sidebarWidth: number
  sidebarMode: SidebarMode
  inspectorVisible: boolean
  alwaysOnTop: boolean
  zoom: number
  theme: ThemeMode
  themePreset: ThemePreset
  onThemeChange: (theme: ThemeMode) => void
  onThemePresetChange: (preset: ThemePreset) => void
  onCustomizeAppearance: () => void
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
  onSearchDocumentsOpen: () => void
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
  onClose: () => void
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
  documentSearch: { title: 'searchDocuments', icon: <Search />, action: (p) => p.onSearchDocumentsOpen() },
}

const actionTitle = (item: ToolbarItem, props: ToolbarProps, fallback: Parameters<typeof t>[1]) =>
  item === 'edit' && props.viewMode === 'edit' ? ('stopEditing' as const) : fallback

export function Toolbar(props: ToolbarProps) {
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [hiddenIndexes, setHiddenIndexes] = useState<number[]>([])
  const actionsRef = useRef<HTMLDivElement>(null)
  const windowAction = (action: 'close' | 'minimize' | 'toggleMaximize') => {
    if (!isTauri()) return
    const window = getCurrentWindow()
    if (action === 'close') props.onClose()
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
  // `system` is a valid default target but is intentionally filtered out of
  // editorApps (it has kind="system"). Never silently substitute a different
  // editor for the user's configured target.
  const defaultEditor = editorApps.find((application) => application.id === props.defaultOpenTarget)
  const effectiveDefaultTarget = defaultEditor?.id ?? 'system'
  // Keep the user's ordered layout, including duplicate spacing items. Like
  // AppKit, navigation is absent until there is a destination in either direction.
  const toolbarItems = useMemo(
    () => props.items.filter((item) => item !== 'navigation' || props.canGoBack || props.canGoForward),
    [props.items, props.canGoBack, props.canGoForward],
  )

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
      {application.id === effectiveDefaultTarget ? <Check className="check" /> : null}
    </button>
  ))
  const defaultEditorButton = (
    <button onClick={() => props.onOpenWith(effectiveDefaultTarget)}>
      <AppWindow />
      <span>{tx('openWithDefault')}</span>
    </button>
  )
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

  // Measure the available toolbar width and hide the trailing customized items;
  // keep hidden actions reachable from the app menu bar or the overflow menu.
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
        slot.style.removeProperty('width')
        slot.removeAttribute('data-sidebar-tracking')
      })
      const style = getComputedStyle(container)
      const gap = Number.parseFloat(style.columnGap) || 0
      const available = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      // Track only a leading sidebar slot; never move a customized item back
      // to the front. If the whole row cannot fit, release the tracking space
      // before overflowing actions. The 3px anchor is the 6px divider's centre.
      const moreWidth = more?.getBoundingClientRect().width ?? 0
      const minimumWidths = slots.map((slot, index) => (toolbarItems[index] === 'flexibleSpace' ? 0 : slot.getBoundingClientRect().width))
      if (toolbarItems[0] === 'sidebar' && props.sidebarVisible && window.innerWidth > 700) {
        const targetWidth = props.sidebarWidth + 3 - container.getBoundingClientRect().left
        const required = moreWidth + minimumWidths.reduce((sum, width) => sum + width, 0) + slots.length * gap
        if (targetWidth >= minimumWidths[0] + 10 && required + targetWidth - minimumWidths[0] <= available + 0.5) {
          slots[0].setAttribute('data-sidebar-tracking', 'true')
          slots[0].style.width = `${targetWidth}px`
        }
      }
      // The container has an independent grid track; hiding children must not
      // shrink the budget itself. Flexible slots have zero minimum width.
      const hidden = new Set<number>()
      const rowWidth = () => {
        const visibleIndexes = slots.map((_slot, index) => index).filter((index) => !hidden.has(index))
        return (
          visibleIndexes.reduce(
            (sum, index) => sum + (toolbarItems[index] === 'flexibleSpace' ? 0 : slots[index].getBoundingClientRect().width),
            0,
          ) +
          Math.max(0, visibleIndexes.length - 1) * gap +
          (visibleIndexes.length > 0 ? gap : 0)
        )
      }
      // Keep the customized prefix visible, overflowing from the end one slot
      // at a time; explicit indexes keep rendering and the More menu in sync.
      while (rowWidth() + moreWidth > available + 0.5) {
        let index = slots.length - 1
        while (index >= 0 && hidden.has(index)) index -= 1
        if (index < 0) break
        hidden.add(index)
      }
      const hiddenList = [...hidden].sort((a, b) => a - b)
      // Apply hiding synchronously to avoid a crowded flash before React re-renders.
      slots.forEach((slot, index) => {
        if (hidden.has(index)) slot.style.display = 'none'
      })
      setHiddenIndexes(hiddenList)
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [toolbarItems, props.displayMode, props.searchQuery, props.zoom, props.viewMode, props.sidebarVisible, props.sidebarWidth])

  const renderItem = (item: ToolbarItem, index: number) => {
    const key = `${item}-${index}`
    const hidden = hiddenIndexes.includes(index)
    const hiddenStyle = hidden ? { display: 'none' as const } : undefined
    const slot = (node: React.ReactNode) => (
      <span key={key} data-toolbar-item={item} style={hiddenStyle}>
        {node}
      </span>
    )
    if (item === 'flexibleSpace')
      return (
        <span key={key} data-toolbar-item={item} data-tauri-drag-region className="toolbar-flexible-space" style={hiddenStyle}>
          {index === toolbarItems.indexOf('flexibleSpace') && props.documentName ? (
            <span className="toolbar-document-title" title={props.documentName}>
              {props.documentName}
            </span>
          ) : null}
        </span>
      )
    if (item === 'space')
      return <span key={key} data-toolbar-item={item} data-tauri-drag-region className="toolbar-space" style={hiddenStyle} />
    if (item === 'navigation')
      return slot(
        <div className="history-buttons toolbar-navigation">
          <button disabled={!props.canGoBack} aria-label="Back" title={tx('back')} onClick={props.onBack}>
            <ChevronLeft />
          </button>
          <button disabled={!props.canGoForward} aria-label="Forward" title={tx('forward')} onClick={props.onForward}>
            <ChevronRight />
          </button>
        </div>,
      )
    if (item === 'sidebar')
      return slot(
        <div className="sidebar-control">
          <div className="sidebar-mode-picker" role="group" aria-label={tx('chooseSidebar')}>
            {(['outline', 'files'] as const).map((mode) => {
              const label = mode === 'outline' ? 'tableOfContents' : 'projectNavigator'
              const selected = props.sidebarVisible && props.sidebarMode === mode
              return (
                <button
                  key={mode}
                  className={selected ? 'selected' : ''}
                  title={tx(label)}
                  aria-label={tx(label)}
                  aria-pressed={selected}
                  onClick={() => {
                    props.onSidebarModeChange(mode)
                  }}
                >
                  {withLabel(mode === 'outline' ? <ListTree /> : <Folder />, label)}
                </button>
              )
            })}
          </div>
          <button
            className={props.sidebarVisible ? 'selected' : ''}
            title={tx('toggleSidebar')}
            aria-label={tx('toggleSidebar')}
            aria-pressed={props.sidebarVisible}
            onClick={props.onToggleSidebar}
          >
            {withLabel(<PanelLeft />, 'sidebar')}
          </button>
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
    if (item === 'themesAndSettings')
      return slot(
        <ToolbarAppearance
          locale={props.locale}
          zoom={props.zoom}
          theme={props.theme}
          themePreset={props.themePreset}
          onZoomChange={props.onZoomChange}
          onThemeChange={props.onThemeChange}
          onThemePresetChange={props.onThemePresetChange}
          onCustomizeAppearance={props.onCustomizeAppearance}
        >
          {withLabel(<ALargeSmall />, 'themesAndSettings')}
        </ToolbarAppearance>,
      )
    if (item === 'documentActions')
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
            title={tx(props.viewMode === 'edit' ? 'stopEditing' : 'edit')}
            aria-label={tx(props.viewMode === 'edit' ? 'stopEditing' : 'edit')}
            onClick={() => props.onViewModeChange(props.viewMode === 'edit' ? 'preview' : 'edit')}
          >
            {withLabel(<FilePenLine />, props.viewMode === 'edit' ? 'stopEditing' : 'edit')}
          </button>
        </div>,
      )
    if (item === 'search')
      return slot(
        <div className="document-search">
          <button className="search-trigger" title={tx('search')} aria-label={tx('search')} onClick={props.onSearchOpen}>
            <Search />
          </button>
          <input
            aria-label={tx('search')}
            value={props.searchQuery}
            onFocus={props.onSearchOpen}
            onChange={(event) => props.onSearchQueryChange(event.target.value)}
            placeholder={tx('search')}
          />
        </div>,
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

  const overflowItems = hiddenIndexes
    .map((index) => toolbarItems[index])
    .filter((item) => item !== 'space' && item !== 'flexibleSpace' && item !== 'copy')

  return (
    <header
      className="native-toolbar"
      data-tauri-drag-region
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('.appearance-popover')) return
        const details = (event.target as HTMLElement).closest('.menu-popover button')?.closest('details')
        if (details) window.setTimeout(() => details.removeAttribute('open'), 0)
      }}
    >
      {!toolbarItems.includes('flexibleSpace') && props.documentName ? (
        <div className="toolbar-document-title toolbar-document-title-fallback" data-tauri-drag-region title={props.documentName}>
          {props.documentName}
        </div>
      ) : null}
      <div className="window-leading" data-tauri-drag-region>
        <div className="traffic-lights">
          <button aria-label={tx('close')} onClick={() => windowAction('close')} />
          <button aria-label={tx('minimize')} onClick={() => windowAction('minimize')} />
          <button aria-label={tx('maximize')} onClick={() => windowAction('toggleMaximize')} />
        </div>
      </div>
      <div className="native-actions" ref={actionsRef} data-tauri-drag-region>
        {toolbarItems.map(renderItem)}
        <details className="more-menu">
          <summary title={tx('more')}>
            <MoreHorizontal />
          </summary>
          <div className="menu-popover align-right">
            {overflowItems.map((item, index) => {
              const meta = SIMPLE_ACTIONS[item]
              if (item === 'documentActions')
                return (
                  <div key={`overflow-${index}`} className="toolbar-overflow-controls">
                    {renderItem(item, -1)}
                  </div>
                )
              if (!meta) {
                if (item === 'openActions')
                  return (
                    <div key={`overflow-${index}`}>
                      {defaultEditorButton}
                      {llmButtons}
                      {editorButtons}
                    </div>
                  )
                if (item === 'openWith')
                  return (
                    <div key={`overflow-${index}`}>
                      {defaultEditorButton}
                      {editorButtons}
                    </div>
                  )
                if (item === 'openInLlm') return <div key={`overflow-${index}`}>{llmButtons}</div>
                return (
                  <div key={`overflow-${index}`} className="toolbar-overflow-controls">
                    {item === 'themesAndSettings' ? (
                      <ToolbarAppearance
                        locale={props.locale}
                        zoom={props.zoom}
                        theme={props.theme}
                        themePreset={props.themePreset}
                        onZoomChange={props.onZoomChange}
                        onThemeChange={props.onThemeChange}
                        onThemePresetChange={props.onThemePresetChange}
                        onCustomizeAppearance={props.onCustomizeAppearance}
                      >
                        {withLabel(<ALargeSmall />, 'themesAndSettings')}
                      </ToolbarAppearance>
                    ) : (
                      renderItem(item, -1)
                    )}
                  </div>
                )
              }
              const title = actionTitle(item, props, meta.title)
              return (
                <button key={`overflow-${item}-${index}`} onClick={() => meta.action(props)}>
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
