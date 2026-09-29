// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WhatsNewDialog } from './WhatsNewDialog'

describe('WhatsNewDialog', () => {
  let host: HTMLDivElement
  let root: Root
  const onClose = vi.fn()

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    onClose.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  function render(locale: ComponentProps<typeof WhatsNewDialog>['locale'] = 'en') {
    act(() => root.render(<WhatsNewDialog locale={locale} onClose={onClose} />))
  }

  it('shows localized update highlights and closes from the Done button', () => {
    render('zh-CN')
    expect(host.textContent).toContain('TextMark 更新内容')
    expect(host.textContent).toContain('长文档目录跳转更可靠')
    expect(host.textContent).toContain('工具栏查找不再重复显示')
    expect(host.textContent).toContain('快捷键查找保留完整操作')
    act(() => host.querySelector<HTMLButtonElement>('footer button')!.click())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the matching search highlights in English', () => {
    render('en')
    expect(host.textContent).toContain('More reliable outline navigation in long documents')
    expect(host.textContent).toContain('Toolbar search has a single query field')
    expect(host.textContent).toContain('Keyboard search keeps full find controls')
  })

  it('closes from Escape and clicking outside the dialog', () => {
    render()
    act(() =>
      host
        .querySelector<HTMLElement>('[role="presentation"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(onClose).toHaveBeenCalledOnce()
    onClose.mockClear()
    act(() => host.querySelector<HTMLElement>('[role="presentation"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
