// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../lib/i18n'
import { DEFAULT_TOOLBAR } from '../lib/settings'
import { Toolbar } from './Toolbar'

type ToolbarProps = ComponentProps<typeof Toolbar>

const makeProps = (overrides: Partial<ToolbarProps> = {}): ToolbarProps => ({
  busy: false,
  viewMode: 'preview',
  sidebarVisible: false,
  sidebarWidth: 240,
  sidebarMode: 'outline',
  inspectorVisible: false,
  alwaysOnTop: false,
  zoom: 100,
  theme: 'system',
  themePreset: 'original',
  onThemeChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onCustomizeAppearance: vi.fn(),
  searchQuery: '',
  documentName: 'guide.md',
  wordCount: 4,
  sizeBytes: 24,
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
  onSearchDocument: vi.fn(),
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
    { sidebarVisible: true, sidebarMode: 'outline' as const },
    { sidebarVisible: true, sidebarMode: 'files' as const },
  ])('边栏状态 %j 的 pressed 正确，模式按钮不额外切换边栏', (state) => {
    const props = makeProps({ items: ['sidebar'], ...state })
    render(props)
    const group = element('[role="group"][aria-label="Choose sidebar mode"]')
    const outline = element<HTMLButtonElement>(`button[aria-label="${t('en', 'tableOfContents')}"]`, group)
    const files = element<HTMLButtonElement>(`button[aria-label="${t('en', 'projectNavigator')}"]`, group)
    expect(group.querySelectorAll('button')).toHaveLength(2)
    expect(element('button[aria-label="Toggle Sidebar"]').getAttribute('aria-pressed')).toBe(String(state.sidebarVisible))
    expect(outline.getAttribute('aria-pressed')).toBe(String(state.sidebarVisible && state.sidebarMode === 'outline'))
    expect(files.getAttribute('aria-pressed')).toBe(String(state.sidebarVisible && state.sidebarMode === 'files'))

    click(outline)
    click(files)
    expect(props.onSidebarModeChange).toHaveBeenCalledTimes(2)
    expect(props.onSidebarModeChange).toHaveBeenNthCalledWith(1, 'outline')
    expect(props.onSidebarModeChange).toHaveBeenNthCalledWith(2, 'files')
    expect(props.onToggleSidebar).not.toHaveBeenCalled()

    // 模拟 App 父回调更新受控 props；模式按钮本身不负责额外 toggle。
    render({ ...props, sidebarVisible: true, sidebarMode: 'files' })
    expect(outline.getAttribute('aria-pressed')).toBe('false')
    expect(files.getAttribute('aria-pressed')).toBe('true')
    const toggle = element<HTMLButtonElement>('button[aria-label="Toggle Sidebar"]')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    click(toggle)
    expect(props.onToggleSidebar).toHaveBeenCalledTimes(1)
    expect(props.onSidebarModeChange).toHaveBeenCalledTimes(2)
  })

  it.each(['en', 'zh-CN'] as const)('在 %s 下提供 aA 图标入口与有名称、可交互的搜索控件', (locale) => {
    const props = makeProps({ locale, items: ['themesAndSettings', 'search'] })
    render(props)
    const summary = element<HTMLElement>('[data-toolbar-item="themesAndSettings"] summary')
    expect(summary.title).toBe(t(locale, 'themesAndSettings'))
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
    expect(props.onSearchOpen).toHaveBeenCalledTimes(1)
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
  })

  it.each(['en', 'zh-CN'] as const)('在 %s 下渲染 Search for Document 工具栏项', (locale) => {
    const props = makeProps({ locale, items: ['search', 'searchDocument'] })
    render(props)
    // Upstream NSToolbarItem: label "Search for Document", tooltip distinct.
    const button = element<HTMLButtonElement>('[data-toolbar-item="searchDocument"] button')
    expect(button.getAttribute('aria-label')).toBe(t(locale, 'searchForDocumentItem'))
    expect(button.title).toBe(t(locale, 'searchForDocumentTooltip'))
    expect(button.querySelector('svg.lucide-file-search')).not.toBeNull()
    click(button)
    expect(props.onSearchDocument).toHaveBeenCalledTimes(1)
    // The in-document find field stays a separate item; the two never merge.
    expect(host.querySelector('.document-search')).not.toBeNull()
  })

  it('Search for Document 不在默认工具栏中（upstream 仅加入 allowed 集合）', () => {
    expect(DEFAULT_TOOLBAR).not.toContain('searchDocument')
    const props = makeProps({ items: DEFAULT_TOOLBAR })
    render(props)
    expect(host.querySelector('[data-toolbar-item="searchDocument"]')).toBeNull()
  })

  // Upstream hasLLMTargetsAvailable: the openInLLM item is removed entirely
  // while no LLM app is installed, and named after the resolved default.
  it('无已安装 LLM 应用时整体隐藏 openInLlm 工具栏项', () => {
    const props = makeProps({
      items: ['search', 'openInLlm'],
      applications: [
        { id: 'system', name: 'System Default', kind: 'system', available: true },
        { id: 'codex', name: 'Codex', kind: 'llm', available: false },
      ],
    })
    render(props)
    expect(host.querySelector('[data-toolbar-item="openInLlm"]')).toBeNull()
    // Remaining slots keep their layout positions; nothing shifts or blanks.
    expect(slots().map((slot) => slot.dataset.toolbarItem)).toEqual(['search'])
  })

  it('openInLlm 以默认应用命名并持久化选择', () => {
    // This jsdom build exposes no usable localStorage; stub one so the
    // persisted-pick path is observable.
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      length: values.size,
    })
    const props = makeProps({
      items: ['openInLlm'],
      displayMode: 'iconAndLabel',
      applications: [
        { id: 'claude', name: 'Claude', kind: 'llm', available: true },
        { id: 'chatgpt', name: 'ChatGPT', kind: 'llm', available: true },
        { id: 'codex', name: 'Codex', kind: 'llm', available: false },
      ],
    })
    render(props)
    const summary = element<HTMLElement>('[data-toolbar-item="openInLlm"] summary')
    // First installed candidate (upstream resolveDefaultLLM falls back to it).
    expect(summary.title).toBe('Open in Claude')
    expect(summary.textContent).toContain('Open in Claude')
    click(summary)
    const chatgpt = Array.from(host.querySelectorAll<HTMLButtonElement>('.menu-popover button')).find((button) =>
      button.textContent?.includes('ChatGPT'),
    )
    expect(chatgpt).toBeDefined()
    expect(chatgpt!.disabled).toBe(false)
    click(chatgpt!)
    expect(props.onOpenInLlm).toHaveBeenCalledExactlyOnceWith('chatgpt')
    // The pick persists (upstream setDefaultLLM → UserDefaults) and the label
    // follows the new default.
    expect(values.get('textmark.lastLlmTarget')).toBe('chatgpt')
    expect(element<HTMLElement>('[data-toolbar-item="openInLlm"] summary').title).toBe('Open in ChatGPT')
    // Uninstalled targets never appear in the menu (upstream llmCandidates).
    expect(host.textContent).not.toContain('Codex')
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
    const openActions = element<HTMLDetailsElement>('[data-toolbar-item="openActions"] details')
    const defaultButton = Array.from(openActions.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(t(props.locale, 'openWithDefault')),
    )
    expect(defaultButton).toBeDefined()
    click(defaultButton!)
    expect(props.onOpenWith).toHaveBeenCalledExactlyOnceWith('system')
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
    const defaultButton = Array.from(openActions.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(t(props.locale, 'openWithDefault')),
    )
    expect(defaultButton).toBeDefined()
    click(defaultButton!)
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
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.native-actions > [data-toolbar-item] button'))
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      t(props.locale, 'edit'),
      t(props.locale, 'shareSource'),
      t(props.locale, 'getInfo'),
    ])
    click(buttons[0])
    // The share button opens the upstream share popover; its Share row shares.
    click(buttons[1])
    const shareRow = Array.from(host.querySelectorAll<HTMLButtonElement>('.share-popover .share-row')).find(
      (row) => row.textContent === t(props.locale, 'share'),
    )!
    expect(shareRow).toBeDefined()
    click(shareRow)
    click(buttons[2])
    expect(props.onViewModeChange).toHaveBeenCalledExactlyOnceWith('edit')
    expect(props.onShare).toHaveBeenCalledOnce()
    expect(props.onToggleInspector).toHaveBeenCalledOnce()
  })

  it('共享弹出框展示文稿头部与导出/打印/共享/拷贝行，Escape 关闭', () => {
    const props = makeProps({ items: ['share'] })
    render(props)
    const trigger = element<HTMLButtonElement>('[data-toolbar-item="share"] button')
    expect(host.querySelector('.share-popover')).toBeNull()
    const open = () => {
      if (!host.querySelector('.share-popover')) click(trigger)
    }
    open()
    const popover = element('.share-popover')
    expect(element('.share-header-text strong', popover).textContent).toBe('guide.md')
    // The byte unit's plural form differs between ICU variants (node "byte",
    // Chrome "bytes"); assert the count and word label, not the plural.
    const subtitle = element('.share-header-subtitle', popover).textContent ?? ''
    expect(subtitle.startsWith('4 words · ')).toBe(true)
    expect(subtitle).toContain('24')
    const rows = Array.from(popover.querySelectorAll<HTMLButtonElement>('.share-row'))
    expect(rows.map((row) => row.textContent)).toEqual([
      t(props.locale, 'exportItem'),
      t(props.locale, 'printItem'),
      t(props.locale, 'share'),
      t(props.locale, 'copySource'),
    ])
    const clickRow = (label: string) => {
      open()
      const pop = element('.share-popover')
      const row = Array.from(pop.querySelectorAll<HTMLButtonElement>('.share-row')).find((r) => r.textContent === label)!
      click(row)
    }
    clickRow(t(props.locale, 'exportItem'))
    expect(props.onExport).toHaveBeenCalledOnce()
    clickRow(t(props.locale, 'printItem'))
    expect(props.onPrint).toHaveBeenCalledOnce()
    clickRow(t(props.locale, 'share'))
    expect(props.onShare).toHaveBeenCalledOnce()
    clickRow(t(props.locale, 'copySource'))
    expect(props.onCopy).toHaveBeenCalledOnce()
    // Each action closes the popover; Escape closes it without acting.
    open()
    expect(host.querySelector('.share-popover')).not.toBeNull()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(host.querySelector('.share-popover')).toBeNull()
  })

  it.each(['preview', 'edit'] as const)('documentActions 溢出后保留 info/share/edit 回调（%s 模式）', (viewMode) => {
    containerWidth = 28
    const props = makeProps({ items: ['documentActions'], viewMode })
    render(props)
    expect(slots()[0].style.display).toBe('none')
    const more = element<HTMLDetailsElement>('.more-menu')
    click(element('summary', more))
    expect(more.open).toBe(true)
    const editTitle = t(props.locale, viewMode === 'edit' ? 'stopEditing' : 'edit')
    const labels = [t(props.locale, 'getInfo'), t(props.locale, 'shareSource'), editTitle]
    const buttons = labels.map((label) => {
      const button = Array.from(more.querySelectorAll<HTMLButtonElement>('.toolbar-overflow-controls button')).find(
        (candidate) => candidate.getAttribute('aria-label') === label,
      )
      expect(button).toBeDefined()
      expect(button!.closest('.toolbar-overflow-controls')).not.toBeNull()
      return button!
    })
    for (const button of buttons) click(button)
    // The share trigger opened the popover; its Share row performs the share.
    const shareRow = Array.from(more.querySelectorAll<HTMLButtonElement>('.share-popover .share-row')).find(
      (row) => row.textContent === t(props.locale, 'share'),
    )!
    expect(shareRow).toBeDefined()
    click(shareRow)
    expect(props.onToggleInspector).toHaveBeenCalledTimes(1)
    expect(props.onShare).toHaveBeenCalledTimes(1)
    expect(props.onViewModeChange).toHaveBeenCalledExactlyOnceWith(viewMode === 'edit' ? 'preview' : 'edit')
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
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'getInfo'))
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'shareSource'))
    expect(element('.more-menu').textContent).not.toContain(t(props.locale, 'edit'))
  })

  it('自定义顺序溢出时只隐藏无法容纳的尾项，并将准确动作放入更多菜单', () => {
    itemWidths = { search: 40, inspector: 90, share: 40 }
    containerWidth = 140
    const props = makeProps({ items: ['search', 'inspector', 'share'] })
    render(props)

    expect(visibleItems()).toEqual(['search'])
    const more = element<HTMLDetailsElement>('.more-menu')
    expect(more.textContent).toContain(t(props.locale, 'getInfo'))
    expect(more.textContent).toContain(t(props.locale, 'shareSource'))
    expect(more.textContent).not.toContain(t(props.locale, 'searchItem'))

    resize(250)
    expect(visibleItems()).toEqual(props.items)
    expect(more.textContent).not.toContain(t(props.locale, 'getInfo'))
    expect(more.textContent).not.toContain(t(props.locale, 'shareSource'))
  })

  it('首位侧栏跟随宽度，关闭与重新打开不残留旧宽度', () => {
    const props = makeProps({ items: ['sidebar', 'flexibleSpace', 'search'], sidebarVisible: true })
    render(props)
    const sidebar = slots()[0]
    expect(sidebar.dataset.sidebarTracking).toBe('true')
    expect(sidebar.style.width).toBe('243px')
    render({ ...props, sidebarWidth: 400 })
    expect(sidebar.style.width).toBe('403px')
    render({ ...props, sidebarVisible: false })
    expect(sidebar.dataset.sidebarTracking).toBeUndefined()
    expect(sidebar.style.width).toBe('')
    render({ ...props, sidebarWidth: 320 })
    expect(sidebar.style.width).toBe('323px')
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
