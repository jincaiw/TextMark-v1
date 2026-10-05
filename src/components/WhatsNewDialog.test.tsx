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
    expect(host.textContent).toContain('编辑模式所见即所得体验优化')
    expect(host.textContent).toContain('格式标记按需显隐')
    expect(host.textContent).toContain('复杂 Markdown 区块更贴近成稿')
    act(() => host.querySelector<HTMLButtonElement>('footer button')!.click())
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the matching search highlights in English', () => {
    render('en')
    expect(host.textContent).toContain('A more WYSIWYG Edit Mode')
    expect(host.textContent).toContain('Markdown syntax appears when you edit it')
    expect(host.textContent).toContain('Tables and escaped punctuation edit naturally')
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
