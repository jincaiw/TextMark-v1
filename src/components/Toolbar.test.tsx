// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../lib/i18n'
import { Toolbar } from './Toolbar'

const platformFlags = vi.hoisted(() => ({ native: false }))

// The share item switches between the macOS native picker (Tauri) and the
// custom popover. Mock the platform probe so both branches are reachable in
// jsdom without a running Tauri shell.
vi.mock('../lib/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/platform')>()
  return { ...actual, isTauri: () => platformFlags.native, isMacos: () => platformFlags.native }
})

type ToolbarProps = ComponentProps<typeof Toolbar>

const makeProps = (overrides: Partial<ToolbarProps> = {}): ToolbarProps => ({
  visible: true,
  busy: false,
  viewMode: 'preview',
  sidebarVisible: false,
  sidebarWidth: 240,
  sidebarMode: 'outline',
  inspectorVisible: false,
  alwaysOnTop: false,
  zoom: 100,
  theme: 'system',
  themePreset: 'normal',
  onThemeChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onCustomizeAppearance: vi.fn(),
  searchQuery: '',
  toolbarSearchActive: false,
  locale: 'en',
  items: [],
  displayMode: 'iconOnly',
  applications: [],
  defaultOpenTarget: 'system',
  canGoBack: false,
  canGoForward: false,
  onBack: vi.fn(),
  onForward: vi.fn(),
  onToggleSidebar: vi.fn(),
  onSidebarModeChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onToggleInspector: vi.fn(),
  onToggleAlwaysOnTop: vi.fn(),
  onZoomChange: vi.fn(),
  onSearchQueryChange: vi.fn(),
  onSearchOpen: vi.fn(),
  onSearchDocumentsOpen: vi.fn(),
  onOpenWith: vi.fn(),
  onOpenInLlm: vi.fn(),
  onOpen: vi.fn(),
  onOpenFolder: vi.fn(),
  onSave: vi.fn(),
  onSaveAs: vi.fn(),
  onShare: vi.fn(),
  onCopy: vi.fn(),
  onPrint: vi.fn(),
  onExportHtml: vi.fn(),
  onExportPng: vi.fn(),
  onExportPdf: vi.fn(),
  onExport: vi.fn(),
  onSettings: vi.fn(),
  onCustomizeToolbar: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
})

describe('Toolbar', () => {
  let host: HTMLDivElement
  let root: Root
  let containerWidth: number
  let paddingLeft: number
  let paddingRight: number
  let itemWidths: Partial<Record<ToolbarProps['items'][number], number>>
  let resizeCallbacks: Set<() => void>

  beforeEach(() => {
    platformFlags.native = false
    vi.useFakeTimers()
    containerWidth = 1000
    paddingLeft = 0
    paddingRight = 0
    itemWidths = {}
    resizeCallbacks = new Set()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private notify: () => void
        constructor(callback: ResizeObserverCallback) {
          this.notify = () => callback([], this as unknown as ResizeObserver)
        }
        observe = vi.fn(() => resizeCallbacks.add(this.notify))
        unobserve = vi.fn(() => resizeCallbacks.delete(this.notify))
        disconnect = vi.fn(() => resizeCallbacks.delete(this.notify))
      },
    )

    // jsdom 不排版：仅模拟测量输入，验证组件的预算、隐藏与恢复逻辑。
    const getStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element.classList.contains('native-actions')) {
        const style = document.createElement('div').style
        style.columnGap = '4px'
        style.paddingLeft = `${paddingLeft}px`
        style.paddingRight = `${paddingRight}px`
        return style
      }
      if (element.classList.contains('sidebar-control')) {
        // 未跟踪时取景器与开关之间的间距；跟踪状态下 CSS 会把它归零。
        const style = document.createElement('div').style
        style.columnGap = '17.5px'
        return style
      }
      return getStyle(element)
    })
    const clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!.get!
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('native-actions') ? containerWidth : clientWidth.call(this)
    })
    const getRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const item = this.dataset.toolbarItem as ToolbarProps['items'][number] | undefined
      if (!item && !this.classList.contains('more-menu')) return getRect.call(this)
      // 隐藏项必须返回零宽度，否则无法捕获重新测量前未清除 display:none 的回归。
      const width = this.style.display === 'none' ? 0 : item ? parseFloat(this.style.width) || itemWidths[item] || 40 : 28
      return new DOMRect(0, 0, width, 28)
    })
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function render(props: ToolbarProps) {
    act(() => root.render(<Toolbar {...props} />))
  }

  function element<T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = host): T {
    const result = scope.querySelector<T>(selector)
    expect(result, selector).not.toBeNull()
    return result!
  }

  function slots() {
    return Array.from(host.querySelectorAll<HTMLElement>('.native-actions > [data-toolbar-item]'))
  }

  function visibleItems() {
    return slots()
      .filter((slot) => slot.style.display !== 'none')
      .map((slot) => slot.dataset.toolbarItem)
  }

  function resize(width: number) {
    containerWidth = width
    expect(resizeCallbacks.size).toBe(1)
    act(() => resizeCallbacks.forEach((callback) => callback()))
  }

  function click(target: HTMLElement) {
    act(() => target.click())
  }

  it('隐藏工具栏时卸载全部顶部操作，恢复后保留自定义顺序', () => {
    const props = makeProps({
      documentName: 'notes.md',
      items: ['sidebar', 'documentActions', 'search', 'inspector'],
    })
    render(props)
    expect(visibleItems()).toEqual(props.items)

    render({ ...props, visible: false })
    expect(host.querySelector('.native-actions')).toBeNull()
    expect(host.querySelector('.window-leading')).toBeNull()
    expect(host.querySelectorAll('header button, header summary, header input')).toHaveLength(0)
    expect(host.querySelector('.toolbar-hidden-title')?.textContent).toBe('notes.md')

    render(props)
    expect(visibleItems()).toEqual(props.items)
    expect(host.querySelector('.toolbar-hidden-title')).toBeNull()
  })

  it('保持 items 的顺序与重复间隔，删除 sidebar/navigation 后不擅自补回', () => {
    const props = makeProps({
      canGoBack: true,
      items: ['search', 'space', 'sidebar', 'flexibleSpace', 'navigation', 'space', 'documentActions', 'flexibleSpace'],
    })
    render(props)
    expect(slots().map((slot) => slot.dataset.toolbarItem)).toEqual(props.items)
    expect(visibleItems()).toEqual(props.items)
    // 文件名由原生窗口标题与侧栏标题承载，工具栏不再重复渲染同一名称。
    expect(host.querySelector('.toolbar-document-name')).toBeNull()
    expect(host.querySelector('.toolbar-document-context')).toBeNull()

    const items = props.items.filter((item) => item !== 'sidebar' && item !== 'navigation')
    render({ ...props, items })
    expect(slots().map((slot) => slot.dataset.toolbarItem)).toEqual(items)
    expect(host.querySelectorAll('[data-toolbar-item="space"]')).toHaveLength(2)
    expect(host.querySelectorAll('[data-toolbar-item="flexibleSpace"]')).toHaveLength(2)
    expect(host.querySelector('[data-toolbar-item="sidebar"]')).toBeNull()
    expect(host.querySelector('[data-toolbar-item="navigation"]')).toBeNull()
    expect(host.querySelector('.sidebar-control')).toBeNull()
    expect(host.querySelector('.toolbar-navigation')).toBeNull()
  })

  it('把文稿名放在工具栏前导位置，而不是弹性空位内', () => {
    render(makeProps({ documentName: 'A long document name.md', items: ['navigation', 'flexibleSpace', 'openActions', 'search'] }))
    const actions = host.querySelector('.native-actions') as HTMLElement
    // Upstream draws the window title at the leading edge of the content
    // titlebar area, before the navigational items.
    expect(actions.firstElementChild?.classList.contains('toolbar-document-title')).toBe(true)
    expect(actions.firstElementChild?.textContent).toBe('A long document name.md')
    expect(host.querySelector('.toolbar-flexible-space .toolbar-document-title')).toBeNull()

    render(makeProps({ documentName: undefined, items: ['navigation', 'search'] }))
    expect(host.querySelector('.toolbar-document-title')).toBeNull()
  })

  it.each([
    { canGoBack: true, canGoForward: false },
    { canGoBack: false, canGoForward: true },
    { canGoBack: true, canGoForward: true },
  ])('无历史时不渲染 navigation，历史变为 %j 后在原位出现', (history) => {
    const props = makeProps({ items: ['share', 'navigation', 'search'] })
    render(props)
    expect(visibleItems()).toEqual(['share', 'search'])
    expect(host.querySelector('[aria-label="Back"]')).toBeNull()
    expect(host.querySelector('[aria-label="Forward"]')).toBeNull()

    render({ ...props, ...history })
    expect(visibleItems()).toEqual(props.items)
    const back = element<HTMLButtonElement>('button[aria-label="Back"]')
    const forward = element<HTMLButtonElement>('button[aria-label="Forward"]')
    expect(back.disabled).toBe(!history.canGoBack)
    expect(forward.disabled).toBe(!history.canGoForward)
    click(back)
    click(forward)
    expect(props.onBack).toHaveBeenCalledTimes(Number(history.canGoBack))
    expect(props.onForward).toHaveBeenCalledTimes(Number(history.canGoForward))

    render(props)
    expect(host.querySelector('[data-toolbar-item="navigation"]')).toBeNull()
  })

  it.each([
    { sidebarVisible: false, sidebarMode: 'outline' as const },
    { sidebarVisible: false, sidebarMode: 'files' as const },
  ])('边栏隐藏时 %j 只保留开关，模式选择器随边栏一起隐藏', (state) => {
    render(makeProps({ items: ['sidebar'], ...state }))
    // Upstream hides the pane picker with the sidebar; the toggle stays.
    expect(host.querySelector('[role="radiogroup"][aria-label="Choose sidebar mode"]')).toBeNull()
    expect(element('button[aria-label="Sidebar"]').classList.contains('selected')).toBe(false)
  })

  it.each([
    { sidebarVisible: true, sidebarMode: 'outline' as const },
    { sidebarVisible: true, sidebarMode: 'files' as const },
  ])('边栏状态 %j 的 pressed 正确，模式按钮不额外切换边栏', (state) => {
    const props = makeProps({ items: ['sidebar'], ...state })
    render(props)
    const group = element('[role="radiogroup"][aria-label="Choose sidebar mode"]')
    const outline = element<HTMLButtonElement>('button[aria-label="Table of Contents"]', group)
    const files = element<HTMLButtonElement>('button[aria-label="Project Navigator"]', group)
    expect(group.querySelectorAll('button')).toHaveLength(2)
    expect(element('button[aria-label="Sidebar"]').classList.contains('selected')).toBe(state.sidebarVisible)
    expect(outline.getAttribute('aria-checked')).toBe(String(state.sidebarMode === 'outline'))
    expect(files.getAttribute('aria-checked')).toBe(String(state.sidebarMode === 'files'))

    click(outline)
    click(files)
    expect(props.onSidebarModeChange).toHaveBeenCalledTimes(2)
    expect(props.onSidebarModeChange).toHaveBeenNthCalledWith(1, 'outline')
    expect(props.onSidebarModeChange).toHaveBeenNthCalledWith(2, 'files')
    expect(props.onToggleSidebar).not.toHaveBeenCalled()

    // 模拟 App 父回调更新受控 props；模式按钮本身不负责额外 toggle。
    render({ ...props, sidebarVisible: true, sidebarMode: 'files' })
    expect(outline.getAttribute('aria-checked')).toBe('false')
    expect(files.getAttribute('aria-checked')).toBe('true')
    const toggle = element<HTMLButtonElement>('button[aria-label="Sidebar"]')
    expect(toggle.classList.contains('selected')).toBe(true)
    click(toggle)
    expect(props.onToggleSidebar).toHaveBeenCalledTimes(1)
    expect(props.onSidebarModeChange).toHaveBeenCalledTimes(2)
  })

  it.each(['en', 'zh-CN'] as const)('在 %s 下提供 aA 图标入口与有名称、可交互的搜索控件', (locale) => {
    const props = makeProps({ locale, items: ['themesAndSettings', 'search'] })
    render(props)
    const summary = element<HTMLElement>('[data-toolbar-item="themesAndSettings"] summary')
    expect(summary.title).toBe(t(locale, 'themesHelp'))
    expect(summary.querySelector('svg.lucide-a-large-small')).not.toBeNull()
    expect(summary.querySelector('.toolbar-label')).toBeNull()
    const menu = element<HTMLDetailsElement>('.themes-and-settings')
    click(summary)
    expect(menu.open).toBe(true)
    const preferences = element<HTMLButtonElement>('.appearance-customize', menu)
    click(preferences)
    expect(props.onCustomizeAppearance).toHaveBeenCalledTimes(1)
    expect(menu.open).toBe(false)

    const trigger = element<HTMLButtonElement>('.document-search button')
    const input = element<HTMLInputElement>('.document-search input')
    expect(trigger.getAttribute('aria-label')).toBe(t(locale, 'search'))
    expect(input.getAttribute('aria-label')).toBe(t(locale, 'search'))
    click(trigger)
    act(() => vi.advanceTimersToNextFrame())
    expect(document.activeElement).toBe(input)
    expect(element('.document-search').classList.contains('is-expanded')).toBe(true)
    expect(props.onSearchOpen).toHaveBeenCalledTimes(1)
    const outside = document.createElement('button')
    host.append(outside)
    act(() => outside.focus())
    expect(element('.document-search').classList.contains('is-expanded')).toBe(false)
    expect(input.tabIndex).toBe(-1)
    act(() => input.focus())
    expect(document.activeElement).toBe(input)
    expect(props.onSearchOpen).toHaveBeenCalledTimes(2)
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'needle')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(props.onSearchQueryChange).toHaveBeenCalledExactlyOnceWith('needle')
    render({ ...props, searchQuery: 'needle' })
    expect(input.value).toBe('needle')
    outside.remove()
  })

  it('将 system 作为默认打开目标，不回退到首个可用编辑器', () => {
    const props = makeProps({
      items: ['openActions'],
      defaultOpenTarget: 'system',
      applications: [
        { id: 'system', name: 'System Default', kind: 'system', available: true },
        { id: 'vscode', name: 'Visual Studio Code', kind: 'editor', available: true },
      ],
    })
    render(props)
    // 与参考实现的分体按钮一致：主键就是“用已选编辑器打开”，菜单里只列编辑器。
    const defaultButton = element<HTMLButtonElement>('.open-actions-primary')
    click(defaultButton)
    expect(props.onOpenWith).toHaveBeenCalledExactlyOnceWith('system')
  })

  it('系统默认目标在分体按钮上画窗口图符，而不是未成形的字母', () => {
    const props = makeProps({
      items: ['openActions'],
      defaultOpenTarget: 'system',
      applications: [
        { id: 'system', name: 'System Default', kind: 'system', available: true },
        { id: 'vscode', name: 'Visual Studio Code', kind: 'editor', available: true },
      ],
    })
    render(props)
    // 系统目标没有 app bundle，取不到 NSWorkspace 图标；退回 `.app-badge`
    // 只会得到裸字母，因为该类的样式写死在菜单容器里。工具栏改用窗口图符。
    const primary = element<HTMLButtonElement>('.open-actions-primary')
    expect(primary.querySelector('svg')).not.toBeNull()
    expect(primary.querySelector('.app-badge')).toBeNull()
  })

  it('未知或不可用的默认目标安全回退系统默认，并标记有效目标', () => {
    const props = makeProps({
      items: ['openActions'],
      defaultOpenTarget: 'missing-editor',
      applications: [
        { id: 'system', name: 'System Default', kind: 'system', available: true },
        { id: 'vscode', name: 'Visual Studio Code', kind: 'editor', available: true },
      ],
    })
    render(props)
    const openActions = element<HTMLDetailsElement>('[data-toolbar-item="openActions"] details')
    click(element<HTMLButtonElement>('.open-actions-primary'))
    expect(props.onOpenWith).toHaveBeenCalledExactlyOnceWith('system')
    const systemChoice = Array.from(openActions.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(t(props.locale, 'systemDefault')),
    )
    expect(systemChoice?.querySelector('.check')).not.toBeNull()
  })

  it('独立渲染 Inspector、Share、Edit 默认动作并按配置顺序响应', () => {
    const props = makeProps({ items: ['edit', 'share', 'inspector'] })
    render(props)
    expect(slots().map((slot) => slot.dataset.toolbarItem)).toEqual(['edit', 'share', 'inspector'])
    expect(host.querySelector('.toolbar-group.document-actions')).toBeNull()
    const edit = element<HTMLButtonElement>('.native-actions > [data-toolbar-item="edit"] button')
    const shareMenu = element<HTMLDetailsElement>('.native-actions > [data-toolbar-item="share"] .share-menu')
    const shareTrigger = element<HTMLElement>('summary', shareMenu)
    const inspector = element<HTMLButtonElement>('.native-actions > [data-toolbar-item="inspector"] button')
    click(edit)
    click(shareTrigger)
    expect(shareMenu.open).toBe(true)
    click(element<HTMLButtonElement>('button', shareMenu))
    click(inspector)
    expect(props.onViewModeChange).toHaveBeenCalledExactlyOnceWith('edit')
    expect(props.onShare).toHaveBeenCalledOnce()
    expect(props.onToggleInspector).toHaveBeenCalledOnce()
  })

  it('macOS Tauri 上 Share 直接打开原生选择器，不再展开自定义弹层', () => {
    platformFlags.native = true
    const props = makeProps({ items: ['share'] })
    render(props)
    expect(host.querySelector('.share-menu')).toBeNull()
    const share = element<HTMLButtonElement>('.native-actions > [data-toolbar-item="share"] button')
    expect(share.getAttribute('aria-label')).toBe(t(props.locale, 'share'))
    click(share)
    expect(props.onShare).toHaveBeenCalledOnce()
  })

  it.each(['preview', 'edit'] as const)('documentActions 溢出后保留 info/share/edit 回调（%s 模式）', (viewMode) => {
    containerWidth = 28
    const props = makeProps({ items: ['documentActions'], viewMode })
    render(props)
    expect(slots()[0].style.display).toBe('none')
    const more = element<HTMLDetailsElement>('.more-menu')
    click(element('summary', more))
    expect(more.open).toBe(true)
    const editTitle = t(props.locale, 'edit')
    const labels = [t(props.locale, 'inspector'), t(props.locale, 'share'), editTitle]
    const buttons = labels.map((label) => {
      const button = Array.from(more.querySelectorAll<HTMLButtonElement>('.toolbar-overflow-controls button')).find(
        (candidate) => candidate.getAttribute('aria-label') === label,
      )
      expect(button).toBeDefined()
      expect(button!.closest('.toolbar-overflow-controls')).not.toBeNull()
      return button!
    })
    for (const button of buttons) click(button)
    expect(props.onToggleInspector).toHaveBeenCalledTimes(1)
    expect(props.onShare).toHaveBeenCalledTimes(1)
    expect(props.onViewModeChange).toHaveBeenCalledExactlyOnceWith(viewMode === 'edit' ? 'preview' : 'edit')
  })

  it('顶部下拉菜单在其他位置点击时收起且保留目标焦点', () => {
    render(makeProps({ items: ['openWith'] }))
    const menu = element<HTMLDetailsElement>('.open-with')
    click(element('summary', menu))
    expect(menu.open).toBe(true)

    const outside = document.createElement('button')
    host.append(outside)
    outside.focus()
    act(() => outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))

    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  it('顶部下拉菜单按 Escape 收起并将焦点返回菜单按钮', () => {
    render(makeProps({ items: ['openWith'] }))
    const menu = element<HTMLDetailsElement>('.open-with')
    const summary = element<HTMLElement>('summary', menu)
    click(summary)
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => document.dispatchEvent(escape))

    expect(escape.defaultPrevented).toBe(true)
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })

  it('按测得的 4px gap 与左右 padding 计算边界，并在窄→宽后恢复全部尾部项', () => {
    const props = makeProps({ items: ['inspector', 'share', 'edit'] })
    paddingLeft = 10
    paddingRight = 6
    // 28px 更多按钮 + 3 × (40px 项目 + 4px gap) + 16px padding = 176px。
    containerWidth = 176
    render(props)
    expect(visibleItems()).toEqual(props.items)

    resize(175)
    expect(visibleItems()).toEqual(['inspector', 'share'])
    expect(slots()[2].style.display).toBe('none')
    resize(175)
    expect(visibleItems()).toEqual(['inspector', 'share'])

    resize(88)
    expect(visibleItems()).toEqual(['inspector'])
    resize(176)
    expect(visibleItems()).toEqual(props.items)
    expect(slots().every((slot) => slot.style.display === '')).toBe(true)
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'inspector'))
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'share'))
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'edit'))
  })

  it('自定义顺序溢出时只隐藏无法容纳的尾项，并将准确动作放入更多菜单', () => {
    itemWidths = { search: 40, inspector: 90, share: 40 }
    containerWidth = 140
    const props = makeProps({ items: ['search', 'inspector', 'share'] })
    render(props)

    expect(visibleItems()).toEqual(['search'])
    const more = element<HTMLDetailsElement>('.more-menu')
    expect(more.textContent).toContain(t(props.locale, 'inspector'))
    expect(more.textContent).toContain(t(props.locale, 'share'))
    expect(more.textContent).not.toContain(t(props.locale, 'searchItem'))

    resize(250)
    expect(visibleItems()).toEqual(props.items)
    expect(more.textContent).not.toContain(t(props.locale, 'inspector'))
    expect(more.textContent).not.toContain(t(props.locale, 'share'))
  })

  it('首位侧栏跟随宽度，关闭与重新打开不残留旧宽度', () => {
    const props = makeProps({ items: ['sidebar', 'flexibleSpace', 'search'], sidebarVisible: true })
    render(props)
    const sidebar = slots()[0]
    expect(sidebar.dataset.sidebarTracking).toBe('true')
    // The tracked slot runs to the content pane's edge, past the 6px gutter.
    expect(sidebar.style.width).toBe('246px')
    render({ ...props, sidebarWidth: 400 })
    expect(sidebar.style.width).toBe('406px')
    render({ ...props, sidebarVisible: false })
    expect(sidebar.dataset.sidebarTracking).toBeUndefined()
    expect(sidebar.style.width).toBe('')
    render({ ...props, sidebarWidth: 320 })
    expect(sidebar.style.width).toBe('326px')
  })

  it('侧栏变窄时仍按内容区边缘锚定，不退回取景器后的固定空位', () => {
    // 取景器 + 17.5pt 间距 + 开关 = 240 的自然槽宽，跟随宽度 246 只比它宽 6pt。
    // 跟随只需要容纳两个控件加 7.5pt 内缩（240 − 17.5 + 11 = 233.5），
    // 而旧判定要求 240 + 10 = 250，于是这一档会静默丢掉跟随，把开关停在
    // 取景器后 17.5pt 处，比按边缘锚定偏 2.5pt。
    itemWidths = { sidebar: 240 }
    const props = makeProps({
      items: ['sidebar', 'flexibleSpace', 'search'],
      sidebarVisible: true,
      sidebarWidth: 240,
    })
    render(props)
    expect(slots()[0].dataset.sidebarTracking).toBe('true')
    expect(slots()[0].style.width).toBe('246px')
  })

  it('紧凑回退先释放跟随留白，放大后恢复，保留尾部搜索', () => {
    const props = makeProps({ items: ['sidebar', 'flexibleSpace', 'search'], sidebarVisible: true })
    render(props)
    resize(160)
    expect(slots()[0].dataset.sidebarTracking).toBeUndefined()
    expect(slots()[0].style.width).toBe('')
    expect(visibleItems()).toEqual(props.items)
    resize(1000)
    expect(slots()[0].dataset.sidebarTracking).toBe('true')
  })

  it('自定义移动或删除侧栏不强制分区，也不丢失重复间隔', () => {
    const props = makeProps({ items: ['sidebar', 'flexibleSpace', 'search'], sidebarVisible: true })
    render(props)
    const items = ['search', 'space', 'sidebar', 'space', 'flexibleSpace'] as ToolbarProps['items']
    render({ ...props, items })
    expect(visibleItems()).toEqual(items)
    expect(host.querySelector('[data-sidebar-tracking]')).toBeNull()
    render({ ...props, items: ['search', 'flexibleSpace'] })
    expect(host.querySelector('.sidebar-control')).toBeNull()
  })

  it('移动端隐藏实际侧栏时不保留顶部跟随区域', () => {
    vi.stubGlobal('innerWidth', 700)
    render(makeProps({ items: ['sidebar', 'flexibleSpace', 'search'], sidebarVisible: true }))
    expect(host.querySelector('[data-sidebar-tracking]')).toBeNull()
  })

  it('flexibleSpace 先收缩而不是挤掉尾部操作，固定 space 仍占用宽度', () => {
    itemWidths = { flexibleSpace: 200, space: 14 }
    containerWidth = 120
    const props = makeProps({ items: ['inspector', 'flexibleSpace', 'share'] })
    render(props)
    expect(visibleItems()).toEqual(props.items)

    render({ ...props, items: ['inspector', 'space', 'share'] })
    expect(visibleItems()).toEqual(['inspector', 'space'])
    resize(134)
    expect(visibleItems()).toEqual(['inspector', 'space', 'share'])
  })
})
