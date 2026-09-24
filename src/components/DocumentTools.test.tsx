// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentTools } from './DocumentTools'

const heightProperty = '--document-tools-height'

describe('DocumentTools', () => {
  let host: HTMLDivElement
  let workspace: HTMLDivElement
  let root: Root | undefined
  let measuredHeight: number
  let observers: MockResizeObserver[]

  class MockResizeObserver implements ResizeObserver {
    readonly targets = new Set<Element>()
    readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
      observers.push(this)
    }

    observe = vi.fn((target: Element) => {
      this.targets.add(target)
    })

    unobserve = vi.fn((target: Element) => {
      this.targets.delete(target)
    })

    disconnect = vi.fn(() => {
      this.targets.clear()
    })

    notify() {
      if (this.targets.size) this.callback([], this)
    }
  }

  beforeEach(() => {
    measuredHeight = 43.75
    observers = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    // jsdom 不排版：只控制工具层的实际测量输入，不模拟其更新逻辑。
    const getRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('document-tools')) return new DOMRect(0, 0, 320, measuredHeight)
      return getRect.call(this)
    })
    host = document.createElement('div')
    workspace = document.createElement('div')
    workspace.className = 'workspace'
    host.append(workspace)
    document.body.append(host)
    root = createRoot(workspace)
  })

  afterEach(() => {
    unmount()
    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function render(children: ReactNode, showTools = true) {
    act(() => {
      root!.render(
        <>
          {showTools && <DocumentTools>{children}</DocumentTools>}
          <div className="editor-pane">
            <div className="cm-scroller" />
          </div>
          <div className="preview-pane" />
        </>,
      )
    })
  }

  function unmount() {
    act(() => root?.unmount())
    root = undefined
  }

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const result = workspace.querySelector<T>(selector)
    expect(result, selector).not.toBeNull()
    return result!
  }

  function resize(height: number) {
    measuredHeight = height
    expect(observers).toHaveLength(1)
    act(() => observers[0].notify())
  }

  it('首次布局即把实测小数高度写入直接父 workspace，而不是工具层或更外层', () => {
    render(<button>格式</button>)

    const tools = element('.document-tools')
    expect(tools.parentElement).toBe(workspace)
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('43.75px')
    expect(tools.style.getPropertyValue(heightProperty)).toBe('')
    expect(host.style.getPropertyValue(heightProperty)).toBe('')
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledExactlyOnceWith(tools)
    expect(observers[0].disconnect).not.toHaveBeenCalled()
  })

  it('ResizeObserver 重新读取高度，支持变高、变零及恢复，相同高度不重复写入', () => {
    render(<button>格式</button>)
    const setProperty = vi.spyOn(workspace.style, 'setProperty')

    for (const height of [96.5, 0, 28.25]) {
      resize(height)
      expect(workspace.style.getPropertyValue(heightProperty)).toBe(`${height}px`)
      expect(setProperty).toHaveBeenLastCalledWith(heightProperty, `${height}px`)
      const writes = setProperty.mock.calls.length
      resize(height)
      expect(setProperty).toHaveBeenCalledTimes(writes)
    }
    expect(setProperty).toHaveBeenCalledTimes(3)
  })

  it('初始化、变高、变零及卸载均不写入编辑器或预览区的 scrollTop', () => {
    render(null, false)
    const scrollers = [element('.cm-scroller'), element('.preview-pane')]
    const setters = scrollers.map((scroller, index) => {
      let scrollTop = 137 + index * 211
      const setter = vi.fn((value: number) => {
        scrollTop = value
      })
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: setter,
      })
      return setter
    })
    const expectUnchanged = () => {
      expect(scrollers.map((scroller) => scroller.scrollTop)).toEqual([137, 348])
      setters.forEach((setter) => expect(setter).not.toHaveBeenCalled())
    }

    render(<button>格式</button>)
    expect(element('.cm-scroller')).toBe(scrollers[0])
    expect(element('.preview-pane')).toBe(scrollers[1])
    expectUnchanged()
    for (const height of [120.5, 0, 43.75]) {
      resize(height)
      expectUnchanged()
    }
    unmount()
    expectUnchanged()
  })

  it('测量和父级重新渲染不重挂载 children，保留输入值与焦点', () => {
    const mounted = vi.fn()
    const disposed = vi.fn()
    function Control({ label }: { label: string }) {
      useEffect(() => {
        mounted()
        return () => disposed()
      }, [])
      return <input aria-label={label} defaultValue="初始值" />
    }
    render(<Control label="查找" />)
    const tools = element('.document-tools')
    const input = element<HTMLInputElement>('input')
    act(() => {
      input.focus()
      input.value = '尚未提交的查找文本'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const expectPreserved = () => {
      expect(element('.document-tools')).toBe(tools)
      expect(element('input')).toBe(input)
      expect(input.value).toBe('尚未提交的查找文本')
      expect(document.activeElement).toBe(input)
      expect(mounted).toHaveBeenCalledTimes(1)
      expect(disposed).not.toHaveBeenCalled()
    }

    for (const height of [101.25, 0, 43.75]) {
      resize(height)
      expectPreserved()
    }
    render(<Control label="替换" />)
    expect(input.getAttribute('aria-label')).toBe('替换')
    expectPreserved()
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledTimes(1)
    expect(observers[0].disconnect).not.toHaveBeenCalled()
    unmount()
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  it('unmount 清除高度变量并断开 observer，同时保留父容器的其他样式', () => {
    workspace.style.setProperty('--unrelated', '12px')
    render(<button>格式</button>)
    resize(88.5)
    const observer = observers[0]
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('88.5px')

    unmount()

    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    expect(observer.targets.size).toBe(0)
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('')
    expect(workspace.style.getPropertyValue('--unrelated')).toBe('12px')
    expect(workspace.querySelector('.document-tools')).toBeNull()
    const setProperty = vi.spyOn(workspace.style, 'setProperty')
    act(() => observer.notify())
    expect(setProperty).not.toHaveBeenCalled()
  })

  it.each([null, false])('初始无工具（%s）且测量为零时不产生非零占位，后续仍能测量工具高度', (children) => {
    measuredHeight = 0
    render(children)

    expect(element('.document-tools').childNodes.length).toBe(0)
    // 初始零高度不写变量，由消费端 var(--document-tools-height, 0px) 回退为零。
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('')
    resize(0)
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('')

    render(<button>格式</button>)
    resize(40)
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('40px')
    render(children)
    resize(0)
    expect(element('.document-tools').childNodes.length).toBe(0)
    expect(workspace.style.getPropertyValue(heightProperty)).toBe('0px')
  })
})
