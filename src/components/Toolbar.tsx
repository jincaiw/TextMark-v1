import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  FileDown,
  FileOutput,
  FileText,
  FolderOpen,
  ALargeSmall,
  Minus,
  MoreHorizontal,
  Pin,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isMacos, isTauri } from '../lib/platform'
import { useFileIcons } from '../hooks/useFileIcons'
import { t } from '../lib/i18n'
import { nextZoomStep } from '../constants'
import type { ExternalApplication, Locale, SidebarMode, ToolbarDisplayMode, ToolbarItem, ViewMode, ThemeMode, ThemePreset } from '../types'
import { ToolbarAppearance } from './ToolbarAppearance'
import {
  CopyStackIcon,
  DocumentSearchIcon,
  EditDiscIcon,
  EditPencilIcon,
  ExportPageIcon,
  FolderGlyphIcon,
  InfoBareIcon,
  InfoCircleFillIcon,
  ListIndentIcon,
  ShareUpIcon,
  SidebarLeadingIcon,
} from './toolbarIcons'

interface ToolbarProps {
  documentName?: string
  documentWords?: number
  documentSizeBytes?: number
  visible: boolean
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
  toolbarSearchActive: boolean
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
  Record<
    ToolbarItem,
    {
      title: Parameters<typeof t>[1]
      // The reference separates a control's accessibility description (its
      // short name) from the tooltip sentence AppKit stores as AXHelp. WebKit
      // maps aria-label to AXDescription and title to AXHelp, so the renderer
      // needs both keys to reproduce the reference's AX tree.
      help?: Parameters<typeof t>[1]
      icon: React.ReactNode
      action: (p: ToolbarProps) => void
    }
  >
> = {
  inspector: {
    title: 'inspector',
    help: 'inspectorHelp',
    icon: <InfoBareIcon />,
    action: (p) => p.onToggleInspector(),
  },
  alwaysOnTop: { title: 'alwaysOnTop', help: 'alwaysOnTopHelp', icon: <Pin />, action: (p) => p.onToggleAlwaysOnTop() },
  share: { title: 'share', help: 'shareHelp', icon: <ShareUpIcon />, action: (p) => p.onShare() },
  edit: { title: 'edit', icon: <EditPencilIcon />, action: (p) => p.onViewModeChange(p.viewMode === 'edit' ? 'preview' : 'edit') },
  print: { title: 'printItem', help: 'printHelp', icon: <Printer />, action: (p) => p.onPrint() },
  copy: { title: 'copyItem', help: 'copyHelp', icon: <CopyStackIcon />, action: (p) => p.onCopy() },
  export: { title: 'exportItem', help: 'exportHelp', icon: <ExportPageIcon />, action: (p) => p.onExport() },
  exportPdf: { title: 'exportPdf', help: 'exportPdfHelp', icon: <FileDown />, action: (p) => p.onExportPdf() },
  search: { title: 'searchItem', icon: <Search />, action: (p) => p.onSearchOpen() },
  documentSearch: {
    title: 'searchDocuments',
    help: 'searchDocumentsHelp',
    icon: <DocumentSearchIcon />,
    action: (p) => p.onSearchDocumentsOpen(),
  },
}

// AppKit draws these items as plain bordered buttons. On macOS 26 two adjacent
// plain buttons share one glass capsule instead of drawing a capsule each, so
// the renderer marks them and the stylesheet merges consecutive runs.
const CAPSULE_ITEMS = new Set<ToolbarItem>(['copy', 'inspector', 'share', 'export', 'exportPdf', 'edit', 'alwaysOnTop', 'print'])

const actionTitle = (item: ToolbarItem, props: ToolbarProps, fallback: Parameters<typeof t>[1]) =>
  item === 'edit' && props.viewMode === 'edit' ? ('stopEditing' as const) : fallback

const formatByteSize = (bytes: number, locale: Locale) => {
  const unit = bytes >= 1024 * 1024 ? 'megabyte' : bytes >= 1024 ? 'kilobyte' : 'byte'
  const divisor = unit === 'megabyte' ? 1024 * 1024 : unit === 'kilobyte' ? 1024 : 1
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(bytes / divisor)
}

export function Toolbar(props: ToolbarProps) {
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [hiddenIndexes, setHiddenIndexes] = useState<number[]>([])
  const actionsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const restoreSearchFocusRef = useRef(false)
  useEffect(() => {
    const closeOutsideMenus = (event: Event) => {
      document
        .querySelectorAll<HTMLDetailsElement>(
          '.native-toolbar .open-with[open], .native-toolbar .more-menu[open], .native-toolbar .share-menu[open]',
        )
        .forEach((menu) => {
          if (!menu.contains(event.target as Node)) menu.open = false
        })
    }
    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const menus = [
        ...document.querySelectorAll<HTMLDetailsElement>(
          '.native-toolbar .open-with[open], .native-toolbar .more-menu[open], .native-toolbar .share-menu[open]',
        ),
      ]
      if (!menus.length) return
      event.preventDefault()
      menus.forEach((menu) => {
        menu.open = false
      })
      const focusMenu = menus.find((menu) => menu.classList.contains('more-menu')) ?? menus[0]
      focusMenu?.querySelector<HTMLElement>('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOutsideMenus)
    document.addEventListener('click', closeOutsideMenus)
    document.addEventListener('keydown', closeMenusOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutsideMenus)
      document.removeEventListener('click', closeOutsideMenus)
      document.removeEventListener('keydown', closeMenusOnEscape)
    }
  }, [])
  useEffect(() => {
    if (!props.toolbarSearchActive && document.activeElement !== searchInputRef.current) setSearchExpanded(false)
  }, [props.toolbarSearchActive])
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
  // AppKit draws the split button's app tile at 20pt: the reference's icon
  // artwork covers 16pt of that box, against 14.5pt when the same image is
  // given the menus' 18pt slot.
  const { icons: appIcons, requestIcon } = useFileIcons(20)
  useEffect(() => {
    editorApps.forEach((application) => {
      if (application.macApp) requestIcon(application.macApp)
    })
  }, [editorApps, requestIcon])
  // The real Finder icon once loaded, else the first-letter badge fallback.
  // The system target has no app bundle to ask NSWorkspace about; it draws the
  // same window glyph its "open with default" row uses, so the split button
  // still shows an 18pt icon instead of a bare letter.
  const appIconFor = (application: ExternalApplication) =>
    application.kind === 'system' ? (
      <AppWindow className="context-app-icon" />
    ) : application.macApp && appIcons[application.macApp] ? (
      <img className="context-app-icon" src={appIcons[application.macApp]} alt="" aria-hidden="true" />
    ) : (
      <span className="app-badge" aria-hidden="true">
        {application.name.slice(0, 1).toUpperCase()}
      </span>
    )
  // Keep the user's ordered layout, including duplicate spacing items. Like
  // AppKit, navigation is absent until there is a destination in either direction.
  const toolbarItems = useMemo(
    () => props.items.filter((item) => item !== 'navigation' || props.canGoBack || props.canGoForward),
    [props.items, props.canGoBack, props.canGoForward],
  )
  // Upstream's sidebar section (pane picker + show/hide toggle) is the toolbar's
  // leading item; the window title is drawn after it, at the content pane's edge.
  const leadingSidebarItem = toolbarItems[0] === 'sidebar'

  const withLabel = (icon: React.ReactNode, title: Parameters<typeof t>[1]) => (
    <>
      {icon}
      {props.displayMode === 'iconAndLabel' ? <span className="toolbar-label">{tx(title)}</span> : null}
    </>
  )
  // AppKit's size item is a text label whose two CJK words are drawn at
  // different optical sizes: 大 stands for Large and 小 for Small, so the
  // reference's 大 ink is 12.5pt square while its 小 is 9.5. A two-character
  // Han label splits into the large word and the small one; every other
  // localization (including the English "Size") stays a single run.
  const sizeLabel = tx('size')
  const sizeGlyph = !isMacos() ? (
    <ALargeSmall />
  ) : /^\p{Script=Han}{2}$/u.test(sizeLabel) ? (
    <span className="toolbar-size-glyph">
      {sizeLabel[0]}
      <span className="toolbar-size-glyph-small">{sizeLabel[1]}</span>
    </span>
  ) : (
    <span className="toolbar-size-glyph">{sizeLabel}</span>
  )
  const editorButtons = editorApps.map((application) => (
    <button key={application.id} onClick={() => props.onOpenWith(application.id)}>
      {appIconFor(application)}
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
      // before overflowing actions. The tracked slot runs to the content pane's
      // edge, i.e. past the 6px split gutter.
      // The overflow affordance is hidden while nothing overflows, so measure
      // it with its own display forced back on; otherwise the budget would not
      // reserve room for it once items do start to hide.
      let moreWidth = 0
      if (more) {
        const previous = more.style.display
        more.style.display = ''
        moreWidth = more.getBoundingClientRect().width
        more.style.display = previous
      }
      const minimumWidths = slots.map((slot, index) => (toolbarItems[index] === 'flexibleSpace' ? 0 : slot.getBoundingClientRect().width))
      if (toolbarItems[0] === 'sidebar' && props.sidebarVisible && window.innerWidth > 700) {
        const targetWidth = props.sidebarWidth + 6 - container.getBoundingClientRect().left
        const required = moreWidth + minimumWidths.reduce((sum, width) => sum + width, 0) + slots.length * gap
        // Tracking gives the air between the picker and the toggle to the pane
        // edge: the picker stays at the leading edge, the toggle at the trailing
        // one, and a narrower sidebar shrinks the air rather than letting the
        // toggle fall off the edge. So the slot only has to fit the two controls
        // plus the tracked inset — not the 17.5pt gap of the untracked row.
        // Reserving that whole gap put the threshold exactly on the 234pt
        // default, so a sidebar a point narrower silently dropped tracking and
        // parked the toggle 2.5pt short of the pane edge the reference follows.
        const control = slots[0].querySelector<HTMLElement>('.sidebar-control')
        const controlGap = control ? Number.parseFloat(getComputedStyle(control).columnGap) || 0 : 0
        const trackedInset = isTauri() && isMacos() ? 7.5 : 11
        if (targetWidth >= minimumWidths[0] - controlGap + trackedInset && required + targetWidth - minimumWidths[0] <= available + 0.5) {
          slots[0].setAttribute('data-sidebar-tracking', 'true')
          slots[0].style.width = `${targetWidth}px`
        }
      }
      // Upstream draws the window title at the content pane's leading edge, not
      // at the window's: with the sidebar open the title starts where the tab
      // strip starts, 11pt into the pane. Measure the title with its margin
      // cleared; a tracked leading slot already ends at the pane's edge, so the
      // same target inset works for both arrangements.
      const title = container.querySelector<HTMLElement>(':scope > .toolbar-document-title')
      if (title) {
        title.style.marginLeft = '0px'
        if (props.sidebarVisible && isTauri() && isMacos()) {
          const target = props.sidebarWidth + 6 + 12
          const inset = target - title.getBoundingClientRect().left
          if (inset > 0) title.style.marginLeft = `${inset}px`
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
        while (index >= 0 && (hidden.has(index) || (props.toolbarSearchActive && toolbarItems[index] === 'search'))) index -= 1
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
  }, [
    toolbarItems,
    props.displayMode,
    props.searchQuery,
    props.toolbarSearchActive,
    props.zoom,
    props.viewMode,
    props.sidebarVisible,
    props.sidebarWidth,
    props.visible,
  ])

  // Consecutive plain-button items share one glass capsule on macOS 26, so each
  // one needs to know the length of the run it belongs to and whether it opens
  // it: the opening slot paints the whole tray as a single surface.
  const capsuleRuns = new Map<number, { start: boolean; length: number }>()
  for (let index = 0; index < toolbarItems.length; index += 1) {
    if (!CAPSULE_ITEMS.has(toolbarItems[index])) continue
    let end = index
    while (end + 1 < toolbarItems.length && CAPSULE_ITEMS.has(toolbarItems[end + 1])) end += 1
    const length = end - index + 1
    for (let member = index; member <= end; member += 1) capsuleRuns.set(member, { start: member === index, length })
    index = end
  }

  // The reference's toolbar share button opens the macOS sharing service
  // picker directly. Keep the custom popover for browsers and the WebDriver
  // build, where there is no native panel and the copy/toast fallback is the
  // behaviour under test.
  const nativeSharePicker = isTauri() && isMacos() && !import.meta.env.VITE_WDIO

  const renderItem = (item: ToolbarItem, index: number) => {
    const key = `${item}-${index}`
    const hidden = hiddenIndexes.includes(index)
    const hiddenStyle = hidden ? { display: 'none' as const } : undefined
    const run = capsuleRuns.get(index)
    const slot = (node: React.ReactNode) => (
      <span
        key={key}
        data-toolbar-item={item}
        data-capsule={run ? 'true' : undefined}
        data-capsule-start={run?.start ? 'true' : undefined}
        style={{ ...hiddenStyle, ...(run ? { '--capsule-count': String(run.length) } : null) } as React.CSSProperties}
      >
        {node}
      </span>
    )
    if (item === 'flexibleSpace')
      return <span key={key} data-toolbar-item={item} data-tauri-drag-region className="toolbar-flexible-space" style={hiddenStyle} />
    if (item === 'space')
      return <span key={key} data-toolbar-item={item} data-tauri-drag-region className="toolbar-space" style={hiddenStyle} />
    if (item === 'navigation')
      return slot(
        <div className="history-buttons toolbar-navigation">
          <button disabled={!props.canGoBack} aria-label={tx('back')} title={tx('back')} onClick={props.onBack}>
            <ChevronLeft />
          </button>
          <button disabled={!props.canGoForward} aria-label={tx('forward')} title={tx('forward')} onClick={props.onForward}>
            <ChevronRight />
          </button>
        </div>,
      )
    if (item === 'sidebar')
      return slot(
        <div className="sidebar-control">
          {/* Upstream hides the pane picker together with the sidebar; the
              toggle is the way back and stays alone at the leading edge. */}
          {props.sidebarVisible ? (
            <div className="sidebar-mode-picker" role="radiogroup" aria-label={tx('chooseSidebar')}>
              {(['outline', 'files'] as const).map((mode) => {
                const label = mode === 'outline' ? 'sidebarTableOfContents' : 'sidebarProjectNavigator'
                const selected = props.sidebarMode === mode
                return (
                  <button
                    key={mode}
                    className={selected ? 'selected' : ''}
                    role="radio"
                    title={tx(label)}
                    aria-label={tx(label)}
                    aria-checked={selected}
                    onClick={() => {
                      props.onSidebarModeChange(mode)
                    }}
                  >
                    {withLabel(mode === 'outline' ? <ListIndentIcon /> : <FolderGlyphIcon />, label)}
                  </button>
                )
              })}
            </div>
          ) : null}
          <button
            className={props.sidebarVisible ? 'selected' : ''}
            title={tx(props.sidebarVisible ? 'hideSidebar' : 'showSidebar')}
            aria-label={tx('sidebar')}
            onClick={props.onToggleSidebar}
          >
            {withLabel(<SidebarLeadingIcon />, 'sidebar')}
          </button>
        </div>,
      )
    if (item === 'openActions') {
      const defaultEditorName = defaultEditor?.name ?? tx('systemDefault')
      // The reference's tooltip is the action sentence "Open in <app>" (its AX
      // help). The split button has no visible text, so the app name doubles as
      // the accessible description and the sentence as the tooltip.
      const defaultEditorTitle = tx('openInApp').replace('%@', defaultEditorName)
      return slot(
        <div className="toolbar-group open-actions-split">
          <button
            className="open-actions-primary"
            title={defaultEditorTitle}
            aria-label={defaultEditorName}
            onClick={() => props.onOpenWith(effectiveDefaultTarget)}
          >
            {defaultEditor ? appIconFor(defaultEditor) : <AppWindow />}
          </button>
          <details className="open-with">
            <summary title={tx('openWith')} aria-label={tx('openWith')}>
              <ChevronDown />
            </summary>
            <div className="menu-popover">
              {llmApps.length === 0 && editorApps.length === 0 ? (
                emptyAppItem()
              ) : (
                <>
                  {/* The reference's split menu is the editor list and nothing
                      else: its primary half already means "open with the
                      checked editor", so a leading "open with default" row had
                      no counterpart there and pushed every row down one. */}
                  {llmApps.length > 0 && <b>{tx('aiApps')}</b>}
                  {llmButtons}
                  {llmApps.length > 0 && editorApps.length > 0 && <hr />}
                  {editorApps.length > 0 && <b>{tx('editors')}</b>}
                  {editorButtons}
                </>
              )}
            </div>
          </details>
        </div>,
      )
    }
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
          <button title={tx('zoomOut')} aria-label={tx('zoomOut')} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, -1))}>
            <span>A</span>
            <Minus />
          </button>
          <button title={tx('zoomIn')} aria-label={tx('zoomIn')} onClick={() => props.onZoomChange(nextZoomStep(props.zoom, 1))}>
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
          {/* The reference's size item is a text label rather than an "AA"
              glyph: AppKit's localized control reads 大小 in Chinese and Size
              in English. Its two CJK words are drawn at different optical
              sizes (Large and Small), so the second character takes a smaller
              cut: the reference's 大 ink is 12.5pt square and its 小 9.5. */}
          {withLabel(sizeGlyph, 'themesAndSettings')}
        </ToolbarAppearance>,
      )
    if (item === 'documentActions')
      return slot(
        <div className="toolbar-group document-actions" aria-label={tx('documentActions')}>
          <button
            className={props.inspectorVisible ? 'selected' : ''}
            title={tx('inspectorHelp')}
            aria-label={tx('inspector')}
            aria-pressed={props.inspectorVisible}
            onClick={props.onToggleInspector}
          >
            {withLabel(props.inspectorVisible ? <InfoCircleFillIcon /> : <InfoBareIcon />, 'inspector')}
          </button>
          <button title={tx('shareHelp')} aria-label={tx('share')} onClick={props.onShare}>
            {withLabel(<ShareUpIcon />, 'share')}
          </button>
          <button
            className={props.viewMode === 'edit' ? 'selected' : ''}
            title={props.viewMode === 'edit' ? tx('stopEditing') : undefined}
            aria-label={tx('edit')}
            aria-pressed={props.viewMode === 'edit'}
            onClick={() => props.onViewModeChange(props.viewMode === 'edit' ? 'preview' : 'edit')}
          >
            {withLabel(
              props.viewMode === 'edit' ? <EditDiscIcon /> : <EditPencilIcon />,
              props.viewMode === 'edit' ? 'stopEditing' : 'edit',
            )}
          </button>
        </div>,
      )
    if (item === 'search')
      return slot(
        <div className={`document-search ${searchExpanded ? 'is-expanded' : ''}`}>
          <button
            className="search-trigger"
            title={tx('search')}
            aria-label={tx('search')}
            aria-expanded={searchExpanded}
            onClick={() => {
              setSearchExpanded(true)
              window.requestAnimationFrame(() => searchInputRef.current?.focus())
            }}
          >
            <Search />
          </button>
          <input
            ref={searchInputRef}
            aria-label={tx('search')}
            value={props.searchQuery}
            tabIndex={searchExpanded ? 0 : -1}
            onFocus={() => {
              setSearchExpanded(true)
              if (restoreSearchFocusRef.current) {
                restoreSearchFocusRef.current = false
                return
              }
              props.onSearchOpen()
              // Opening FindBar focuses its own query field. The toolbar input
              // is the initiating control, so restore focus to it after mount
              // unless the user has already moved focus elsewhere.
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => {
                  if (document.activeElement?.classList.contains('find-query')) {
                    restoreSearchFocusRef.current = true
                    searchInputRef.current?.focus()
                  }
                }),
              )
            }}
            onBlur={(event) => {
              if (!props.toolbarSearchActive && !event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null))
                setSearchExpanded(false)
            }}
            onChange={(event) => props.onSearchQueryChange(event.target.value)}
            placeholder={tx('search')}
          />
        </div>,
      )
    if (item === 'share' && nativeSharePicker)
      return slot(
        <button
          className={`toolbar-item-button ${props.displayMode === 'iconAndLabel' ? 'with-label' : ''}`}
          title={tx('shareHelp')}
          aria-label={tx('share')}
          onClick={props.onShare}
        >
          {withLabel(<ShareUpIcon />, 'share')}
        </button>,
      )
    if (item === 'share')
      return slot(
        <details className="toolbar-group share-menu">
          <summary role="button" title={tx('shareHelp')} aria-label={tx('share')}>
            {withLabel(<ShareUpIcon />, 'share')}
          </summary>
          <div className="menu-popover share-popover">
            <div className="share-document-meta">
              <strong title={props.documentName}>{props.documentName || tx('noDocumentOpen')}</strong>
              <div>
                <span>
                  <FileText />
                  {props.locale === 'zh-CN'
                    ? `${tx('wordCount')} ${(props.documentWords ?? 0).toLocaleString(props.locale)}`
                    : `${(props.documentWords ?? 0).toLocaleString(props.locale)} ${tx('words')}`}
                </span>
                <span>
                  {tx('fileSize')}: {formatByteSize(props.documentSizeBytes ?? 0, props.locale)}
                </span>
              </div>
            </div>
            <button onClick={props.onShare}>
              <ShareUpIcon />
              {tx('shareSource')}
            </button>
            <button onClick={props.onCopy}>
              <Clipboard />
              {tx('copySource')}
            </button>
            <hr />
            <button onClick={props.onPrint}>
              <Printer />
              {tx('printItem')}
            </button>
            <button onClick={props.onExport}>
              <FileOutput />
              {tx('exportItem')}…
            </button>
          </div>
        </details>,
      )
    const simple = SIMPLE_ACTIONS[item]
    if (simple) {
      const title = actionTitle(item, props, simple.title)
      // The reference's edit item carries no tooltip while previewing and only
      // explains itself in edit mode; its description stays "Edit" throughout.
      const help = item === 'edit' ? (props.viewMode === 'edit' ? 'stopEditing' : undefined) : simple.help
      const active =
        (item === 'inspector' && props.inspectorVisible) ||
        (item === 'edit' && props.viewMode === 'edit') ||
        (item === 'alwaysOnTop' && props.alwaysOnTop)
      const toggle = item === 'inspector' || item === 'edit' || item === 'alwaysOnTop'
      return slot(
        <button
          className={`toolbar-item-button ${props.displayMode === 'iconAndLabel' ? 'with-label' : ''} ${active ? 'selected' : ''}`}
          title={help ? tx(help) : undefined}
          aria-label={tx(simple.title)}
          aria-pressed={toggle ? active : undefined}
          onClick={() => {
            if (item === 'copy') {
              props.onCopy()
              setCopiedFlash(true)
              window.setTimeout(() => setCopiedFlash(false), 1200)
            } else simple.action(props)
          }}
        >
          {withLabel(
            item === 'inspector' && active ? (
              <InfoCircleFillIcon />
            ) : item === 'edit' && active ? (
              <EditDiscIcon />
            ) : item === 'copy' && copiedFlash ? (
              <Check />
            ) : (
              simple.icon
            ),
            title,
          )}
        </button>,
      )
    }
    return null
  }

  const overflowItems = hiddenIndexes
    .map((index) => toolbarItems[index])
    .filter((item) => item !== 'space' && item !== 'flexibleSpace' && item !== 'copy')

  if (!props.visible) {
    return (
      <header className="native-toolbar" data-tauri-drag-region>
        <span className="toolbar-hidden-title" data-tauri-drag-region title={props.documentName}>
          {props.documentName}
        </span>
      </header>
    )
  }

  return (
    <header
      className="native-toolbar"
      data-tauri-drag-region
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('.appearance-popover')) return
        const button = (event.target as HTMLElement).closest('.menu-popover button')
        if (!button) return
        window.setTimeout(() => {
          button.closest('details')?.removeAttribute('open')
          button.closest('.more-menu')?.removeAttribute('open')
        }, 0)
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
        {/* Upstream's leading sidebar section (the pane picker and its toggle)
            sits in the titlebar's sidebar area, and the system draws the window
            title after it at the content pane's leading edge. Render that first
            item ahead of the title so the tracked slot spans the sidebar and
            the title lands on the pane instead of over the sidebar. */}
        {leadingSidebarItem ? renderItem(toolbarItems[0], 0) : null}
        {/* Upstream draws the window title at the leading edge of the content
            titlebar area, before the navigational items, rather than centred
            in a flexible slot. */}
        {props.documentName ? (
          <span className="toolbar-document-title" data-tauri-drag-region title={props.documentName}>
            {props.documentName}
          </span>
        ) : null}
        {toolbarItems.map((item, index) => (leadingSidebarItem && index === 0 ? null : renderItem(item, index)))}
        <details className="more-menu" style={overflowItems.length === 0 ? { display: 'none' } : undefined}>
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
              if (item === 'share')
                return (
                  <div key={`overflow-${item}-${index}`} className="toolbar-overflow-controls">
                    {renderItem(item, -1)}
                  </div>
                )
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
