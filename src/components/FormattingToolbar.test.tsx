// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormattingToolbar } from './FormattingToolbar'

type FormattingToolbarProps = ComponentProps<typeof FormattingToolbar>

const makeProps = (): FormattingToolbarProps => ({
  locale: 'en',
  onFormat: vi.fn(),
  onInsertLink: vi.fn(),
  state: {
    heading: 'h0',
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    link: false,
    highlight: false,
    bulletList: false,
    orderedList: false,
    taskList: false,
    quote: false,
  },
})

describe('FormattingToolbar menu dismissal', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    if (!globalThis.PointerEvent) vi.stubGlobal('PointerEvent', MouseEvent)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(<FormattingToolbar {...makeProps()} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('点击格式菜单外部收起菜单', () => {
    const menu = host.querySelector<HTMLDetailsElement>('.formatting-link-menu')!
    menu.open = true
    const outside = document.createElement('button')
    document.body.append(outside)
    act(() => outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    expect(menu.open).toBe(false)
    outside.remove()
  })

  it('按 Escape 收起菜单并将焦点返回触发按钮', () => {
    const menu = host.querySelector<HTMLDetailsElement>('.formatting-link-menu')!
    const summary = menu.querySelector<HTMLElement>('summary')!
    menu.open = true
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => document.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })
})
