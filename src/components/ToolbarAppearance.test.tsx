// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZOOM_STOPS } from '../constants'
import { t } from '../lib/i18n'
import { ToolbarAppearance } from './ToolbarAppearance'

type AppearanceProps = ComponentProps<typeof ToolbarAppearance>

const presets = [
  ['normal', 'Normal'],
  ['charcoal', 'Charcoal'],
  ['redGraphite', 'Red Graphite'],
  ['darkGraphite', 'Dark Graphite'],
  ['solarizedLight', 'Solarized Light'],
  ['solarizedDark', 'Solarized Dark'],
  ['dracula', 'Dracula'],
] as const

const makeProps = (overrides: Partial<AppearanceProps> = {}): AppearanceProps => ({
  locale: 'en',
  zoom: 100,
  theme: 'system',
  themePreset: 'normal',
  onZoomChange: vi.fn(),
  onThemeChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onCustomizeAppearance: vi.fn(),
  children: <span>aA</span>,
  ...overrides,
})

describe('ToolbarAppearance', () => {
  let host: HTMLDivElement
  let root: Root | null

  beforeEach(() => {
    vi.useFakeTimers()
    // 组件只读取事件目标；较旧 jsdom 缺少 PointerEvent 时复用 MouseEvent。
    if (!globalThis.PointerEvent) vi.stubGlobal('PointerEvent', MouseEvent)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root?.unmount())
    host.remove()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function render(props: AppearanceProps) {
    act(() => root!.render(<ToolbarAppearance {...props} />))
  }

  function element<T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = host): T {
    const result = scope.querySelector<T>(selector)
    expect(result, selector).not.toBeNull()
    return result!
  }

  function click(target: HTMLElement) {
    act(() => target.click())
    // details 的原生 toggle 异步派发；让 React 同步 open 状态并注册关闭监听器。
    act(() => vi.advanceTimersByTime(0))
  }

  function open() {
    const details = element<HTMLDetailsElement>('details')
    expect(details.open).toBe(false)
    click(element('summary', details))
    expectOpen(true)
    return details
  }

  function expectOpen(value: boolean) {
    expect(element<HTMLDetailsElement>('details').open).toBe(value)
    expect(element('summary').getAttribute('aria-expanded')).toBe(String(value))
  }

  function zoomButton(direction: 'zoomIn' | 'zoomOut') {
    return element<HTMLButtonElement>(`button[aria-label="${t('en', direction)}"]`)
  }

  it.each(['en', 'zh-CN'] as const)('受控主题在 %s 下按 system → light → dark → system 回调且保持展开', (locale) => {
    const props = makeProps({ locale })
    render(props)
    expectOpen(false)
    const label = t(locale, 'themesAndSettings')
    expect(element('summary').getAttribute('aria-label')).toBe(label)
    expect(element('[role="dialog"]').getAttribute('aria-label')).toBe(label)
    expect(element('summary').textContent).toBe('aA')
    open()
    const cycle = element<HTMLButtonElement>('.appearance-cycle')
    const transitions = [
      ['system', 'light'],
      ['light', 'dark'],
      ['dark', 'system'],
    ] as const
    for (const [index, [theme, next]] of transitions.entries()) {
      const currentLabel = `${t(locale, 'appearance')}: ${t(locale, theme === 'system' ? 'automatic' : theme)}`
      expect(cycle.getAttribute('aria-label')).toBe(currentLabel)
      click(cycle)
      expect(props.onThemeChange).toHaveBeenCalledTimes(index + 1)
      expect(props.onThemeChange).toHaveBeenNthCalledWith(index + 1, next)
      // 点击只发出请求，不应在父组件回传 props 前擅自更改主题。
      expect(cycle.getAttribute('aria-label')).toBe(currentLabel)
      expectOpen(true)
      render({ ...props, theme: next })
      expect(cycle.getAttribute('aria-label')).toBe(`${t(locale, 'appearance')}: ${t(locale, next === 'system' ? 'automatic' : next)}`)
      expectOpen(true)
    }
    expect(props.onThemePresetChange).not.toHaveBeenCalled()
    expect(props.onZoomChange).not.toHaveBeenCalled()
    expect(props.onCustomizeAppearance).not.toHaveBeenCalled()
  })

  it.each(presets)('七个预设中 %s 的 aria-pressed 受控更新，点击回调且不关闭浮层', (preset, name) => {
    const initialPreset = preset === 'normal' ? 'dracula' : 'normal'
    const props = makeProps({ themePreset: initialPreset })
    render(props)
    open()
    const group = element('[role="group"][aria-label="Theme presets"]')
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button'))
    expect(buttons).toHaveLength(7)
    expect(buttons.map((button) => [button.dataset.themePreset, button.getAttribute('aria-label')])).toEqual(presets)
    const assertSelection = (selected: AppearanceProps['themePreset']) => {
      for (const button of buttons) {
        expect(button.getAttribute('aria-pressed')).toBe(String(button.dataset.themePreset === selected))
      }
      expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1)
    }
    assertSelection(initialPreset)
    click(element<HTMLButtonElement>(`button[aria-label="${name}"]`, group))
    expect(props.onThemePresetChange).toHaveBeenCalledExactlyOnceWith(preset)
    assertSelection(initialPreset)
    expectOpen(true)
    render({ ...props, themePreset: preset })
    assertSelection(preset)
    expectOpen(true)
    // Toolbar 的普通菜单自动关闭选择器不应匹配这块浮层。
    expect(element('.appearance-popover').classList.contains('menu-popover')).toBe(false)
    expect(buttons.every((button) => button.closest('.menu-popover') === null)).toBe(true)
    expect(props.onThemeChange).not.toHaveBeenCalled()
    expect(props.onCustomizeAppearance).not.toHaveBeenCalled()
  })

  it.each([
    { zoom: 50, disabled: 'zoomOut', enabled: 'zoomIn', next: 67 },
    { zoom: 300, disabled: 'zoomIn', enabled: 'zoomOut', next: 250 },
  ] as const)('zoom=$zoom 时禁用越界按钮，另一方向按档位回调', ({ zoom, disabled, enabled, next }) => {
    const props = makeProps({ zoom })
    render(props)
    open()
    expect(zoomButton(disabled).disabled).toBe(true)
    expect(zoomButton(enabled).disabled).toBe(false)
    click(zoomButton(disabled))
    expect(props.onZoomChange).not.toHaveBeenCalled()
    expect(element('.appearance-zoom-scale').style.opacity).toBe('0')
    click(zoomButton(enabled))
    expect(props.onZoomChange).toHaveBeenCalledExactlyOnceWith(next)
    expectOpen(true)
    render({ ...props, zoom: next })
    expect(zoomButton('zoomIn').disabled).toBe(false)
    expect(zoomButton('zoomOut').disabled).toBe(false)
    expect(element('output').textContent).toBe(`${next}%`)
  })

  it.each([
    { zoom: 67, direction: 'zoomOut', next: 50 },
    { zoom: 250, direction: 'zoomIn', next: 300 },
    { zoom: 105, direction: 'zoomOut', next: 100 },
    { zoom: 105, direction: 'zoomIn', next: 110 },
  ] as const)('zoom=$zoom 点击 $direction 请求 $next，父组件回传后更新刻度与边界', ({ zoom, direction, next }) => {
    const props = makeProps({ zoom })
    render(props)
    open()
    click(zoomButton(direction))
    expect(props.onZoomChange).toHaveBeenCalledExactlyOnceWith(next)
    expect(element('output').textContent).toBe(`${zoom}%`)
    expectOpen(true)
    render({ ...props, zoom: next })
    expect(element('output').textContent).toBe(`${next}%`)
    expect(element('output').getAttribute('aria-live')).toBe('polite')
    const ticks = Array.from(host.querySelectorAll('.appearance-zoom-scale i'))
    expect(ticks).toHaveLength(ZOOM_STOPS.length)
    expect(ticks.map((tick) => tick.classList.contains('filled'))).toEqual(ZOOM_STOPS.map((stop) => stop <= next))
    expect(zoomButton('zoomOut').disabled).toBe(next === 50)
    expect(zoomButton('zoomIn').disabled).toBe(next === 300)
    expectOpen(true)
  })

  it('缩放反馈在 1999ms 仍显示、2000ms 隐藏，仅改变 opacity 而不移除占位节点', () => {
    render(makeProps())
    open()
    const panel = element('.appearance-popover')
    const scale = element('.appearance-zoom-scale')
    const nodes = Array.from(panel.querySelectorAll('*'))
    const initialMarkup = panel.outerHTML
    expect(scale.style.opacity).toBe('0')
    expect(scale.getAttribute('aria-hidden')).toBe('true')
    click(zoomButton('zoomIn'))
    expect(scale.style.opacity).toBe('1')
    // jsdom 不排版：验证 DOM/样式占位契约，不用恒为零的 rect 冒充布局测试。
    expect(panel.outerHTML).toBe(initialMarkup.replace('opacity: 0;', 'opacity: 1;'))
    act(() => vi.advanceTimersByTime(1999))
    expect(scale.style.opacity).toBe('1')
    act(() => vi.advanceTimersByTime(1))
    expect(scale.style.opacity).toBe('0')
    expect(panel.outerHTML).toBe(initialMarkup)
    const remainingNodes = Array.from(panel.querySelectorAll('*'))
    expect(remainingNodes).toHaveLength(nodes.length)
    nodes.forEach((node, index) => expect(remainingNodes[index]).toBe(node))
    expectOpen(true)
  })

  it('连续缩放会取消旧反馈计时器，从最后一次点击重新计满两秒', () => {
    const props = makeProps()
    render(props)
    open()
    click(zoomButton('zoomIn'))
    render({ ...props, zoom: 110 })
    act(() => vi.advanceTimersByTime(1500))
    click(zoomButton('zoomOut'))
    render(props)
    expect(props.onZoomChange).toHaveBeenNthCalledWith(1, 110)
    expect(props.onZoomChange).toHaveBeenNthCalledWith(2, 100)
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(500))
    expect(element('.appearance-zoom-scale').style.opacity).toBe('1')
    act(() => vi.advanceTimersByTime(1499))
    expect(element('.appearance-zoom-scale').style.opacity).toBe('1')
    act(() => vi.advanceTimersByTime(1))
    expect(element('.appearance-zoom-scale').style.opacity).toBe('0')
    expect(vi.getTimerCount()).toBe(0)
    expectOpen(true)
  })

  it('普通按键不关闭，Escape 关闭并恢复 summary 焦点，重新打开后仍生效', () => {
    render(makeProps())
    for (let attempt = 0; attempt < 2; attempt++) {
      open()
      const cycle = element<HTMLButtonElement>('.appearance-cycle')
      act(() => cycle.focus())
      expect(document.activeElement).toBe(cycle)
      act(() => cycle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
      expectOpen(true)
      expect(document.activeElement).toBe(cycle)
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      act(() => cycle.dispatchEvent(escape))
      act(() => vi.advanceTimersByTime(0))
      expect(escape.defaultPrevented).toBe(true)
      expectOpen(false)
      expect(document.activeElement).toBe(element('summary'))
    }
  })

  it('内部 pointerdown 不关闭，外部 pointerdown 关闭且不抢回 summary 焦点', () => {
    render(makeProps())
    open()
    act(() => element('.appearance-cycle').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expectOpen(true)
    act(() => element('summary').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expectOpen(true)
    const outside = document.createElement('button')
    host.append(outside)
    act(() => outside.focus())
    act(() => outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    act(() => vi.advanceTimersByTime(0))
    expectOpen(false)
    expect(document.activeElement).toBe(outside)
  })

  it('自定义外观先关闭 details 再调用回调', () => {
    const onCustomizeAppearance = vi.fn(() => expect(element<HTMLDetailsElement>('details').open).toBe(false))
    const props = makeProps({ onCustomizeAppearance })
    render(props)
    open()
    click(element<HTMLButtonElement>('.appearance-customize'))
    expect(onCustomizeAppearance).toHaveBeenCalledExactlyOnceWith()
    expectOpen(false)
    expect(props.onThemeChange).not.toHaveBeenCalled()
    expect(props.onThemePresetChange).not.toHaveBeenCalled()
    expect(props.onZoomChange).not.toHaveBeenCalled()
  })

  it('卸载时清除尚未到期的反馈 timer，移除 Escape 和外部点击监听器', () => {
    render(makeProps())
    const details = open()
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    click(zoomButton('zoomIn'))
    const timerIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 2000)
    expect(timerIndex).toBeGreaterThanOrEqual(0)
    const timer = setTimeoutSpy.mock.results[timerIndex].value
    expect(vi.getTimerCount()).toBe(1)
    clearTimeoutSpy.mockClear()
    const removeListener = vi.spyOn(document, 'removeEventListener')
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    act(() => root!.unmount())
    root = null
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer)
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function))
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      document.dispatchEvent(escape)
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      vi.advanceTimersByTime(2000)
    })
    expect(escape.defaultPrevented).toBe(false)
    expect(details.open).toBe(true)
    expect(host.childElementCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
