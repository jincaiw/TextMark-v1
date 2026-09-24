// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../lib/i18n'
import { Toolbar } from './Toolbar'

type ToolbarProps = ComponentProps<typeof Toolbar>

const makeProps = (overrides: Partial<ToolbarProps> = {}): ToolbarProps => ({
  fileName: 'guide.md',
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
    expect(host.querySelectorAll('.toolbar-document-name')).toHaveLength(1)
    expect(element('.toolbar-document-name').textContent).toBe(props.fileName)

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
    const outline = element<HTMLButtonElement>('button[aria-label="Outline"]', group)
    const files = element<HTMLButtonElement>('button[aria-label="Folders"]', group)
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
    click(buttons[1])
    click(buttons[2])
    expect(props.onViewModeChange).toHaveBeenCalledExactlyOnceWith('edit')
    expect(props.onShare).toHaveBeenCalledOnce()
    expect(props.onToggleInspector).toHaveBeenCalledOnce()
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
