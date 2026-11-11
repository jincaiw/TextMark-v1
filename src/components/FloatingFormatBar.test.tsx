import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingFormatBar } from './FloatingFormatBar'

type BarProps = ComponentProps<typeof FloatingFormatBar>
const props = (over: Partial<BarProps> = {}): BarProps => ({
  locale: 'en',
  heading: 0,
  commands: [],
  onFormat: vi.fn(),
  onBlockStyle: vi.fn(),
  onListStyle: vi.fn(),
  onLink: vi.fn(),
  getBlockStyle: () => 'none',
  getListStyle: () => 'none',
  getLinkSelection: () => null,
  ...over,
})

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let resolved: BarProps

/** Minimal in-memory Storage: this jsdom build does not expose a usable localStorage global. */
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

const mount = (over: Partial<BarProps> = {}) => {
  resolved = props(over)
  act(() => root.render(<FloatingFormatBar {...resolved} />))
  return resolved
}

const bar = () => host.querySelector<HTMLElement>('.floating-format-bar')!
const button = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.ffb-btn')].find((element) => element.getAttribute('aria-label') === label)!
const rows = () => [...host.querySelectorAll<HTMLButtonElement>('.ffb-row')]
const openButton = (label: string) => {
  act(() => button(label).click())
}
const click = (element: Element | null | undefined) => {
  expect(element).not.toBeNull()
  act(() => (element as HTMLElement).click())
}

describe('FloatingFormatBar', () => {
  it('renders the five glass capsules in upstream order', () => {
    mount()
    expect(bar()).not.toBeNull()
    expect(host.querySelectorAll('.ffb-group')).toHaveLength(5)
    const labels = [...host.querySelectorAll('.ffb-btn')].map((element) => element.getAttribute('aria-label'))
    expect(labels).toEqual(['Text Style', 'Bold', 'Italic', 'Strikethrough', 'Link', 'Lists', 'More Formatting'])
  })

  it('labels the heading pill from live selection state', () => {
    mount({ heading: 0 })
    expect(button('Text Style').textContent).toContain('Body')
    act(() => root.render(<FloatingFormatBar {...resolved} heading={2} />))
    expect(button('Text Style').textContent).toContain('Heading 2')
  })

  it('tints emphasis and link pills when their marks are active', () => {
    mount({ commands: ['bold', 'link'] })
    expect(button('Bold').className).toContain('is-active')
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true')
    expect(button('Italic').className).not.toContain('is-active')
    expect(button('Link').className).toContain('is-active')
  })

  it('formats from the emphasis pills without opening a popover', () => {
    mount()
    click(button('Bold'))
    click(button('Strikethrough'))
    expect(resolved.onFormat).toHaveBeenCalledWith('bold')
    expect(resolved.onFormat).toHaveBeenCalledWith('strikethrough')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('lists Body plus Heading 1-6 and applies the chosen level', () => {
    mount({ heading: 2 })
    openButton('Text Style')
    const headingRows = rows()
    expect(headingRows).toHaveLength(7)
    expect(headingRows.map((row) => row.textContent)).toEqual([
      'Body',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Heading 5',
      'Heading 6',
    ])
    expect(headingRows[2].getAttribute('aria-pressed')).toBe('true')
    click(headingRows[0])
    expect(resolved.onFormat).toHaveBeenCalledWith('h0')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('omits a redundant format call when the current level is reselected', () => {
    mount({ heading: 2 })
    openButton('Text Style')
    click(rows()[2])
    expect(resolved.onFormat).not.toHaveBeenCalled()
  })

  it('opens the list popover with the live list style and applies a choice', () => {
    mount({ getListStyle: () => 'ordered' })
    openButton('Lists')
    expect(host.querySelector('.ffb-popover-title')?.textContent).toBe('List')
    const listRows = rows()
    expect(listRows.map((row) => row.textContent)).toEqual(['None', 'Bulleted List', 'Numbered List', 'Task List'])
    expect(listRows[2].getAttribute('aria-pressed')).toBe('true')
    click(listRows[3])
    expect(resolved.onListStyle).toHaveBeenCalledWith('task')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('opens styling from More and routes the fenced row to the language picker', () => {
    mount({ getBlockStyle: () => 'quote' })
    openButton('More Formatting')
    expect(host.querySelector('.ffb-popover-title')?.textContent).toBe('Styling')
    const stylingRows = rows()
    expect(stylingRows.map((row) => row.textContent)).toEqual(['None', 'Blockquote', 'Code', 'Plain Text Block', 'Code Block', 'Table'])
    expect(stylingRows[1].getAttribute('aria-pressed')).toBe('true')
    click(stylingRows[4])
    // Code Block swaps the popover for the language picker instead of applying.
    expect(resolved.onBlockStyle).not.toHaveBeenCalled()
    expect(host.querySelector('.ffb-language')).not.toBeNull()
    expect(host.querySelector('.ffb-popover-title')?.textContent).not.toBe('Styling')
  })

  it('applies a plain styling row and closes', () => {
    mount()
    openButton('More Formatting')
    click(rows()[5])
    expect(resolved.onBlockStyle).toHaveBeenCalledWith('table')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('filters languages, selects the first match on Enter and remembers it', () => {
    mount()
    openButton('More Formatting')
    click(rows().find((row) => row.textContent === 'Code Block'))
    const input = host.querySelector<HTMLInputElement>('.ffb-lang-filter input')!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input, 'rust')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const first = host.querySelector<HTMLButtonElement>('.ffb-lang-row')!
    expect(first.textContent).toContain('Rust')
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(resolved.onBlockStyle).toHaveBeenCalledWith('fenced', 'rust')
    expect(JSON.parse(localStorage.getItem('textmark.recentCodeLanguages') ?? '[]')).toContain('rust')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('reads the link selection text and gates Save on a trimmed URL', () => {
    const onLink = vi.fn()
    mount({ getLinkSelection: () => ({ text: 'docs', from: 0, to: 4 }), onLink })
    openButton('Link')
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.ffb-link-input')]
    expect(inputs[0].value).toBe('docs')
    const save = host.querySelector<HTMLButtonElement>('.ffb-primary')!
    expect(save.disabled).toBe(true)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(inputs[1], '  https://example.com  ')
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(save.disabled).toBe(false)
    act(() => {
      inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onLink).toHaveBeenCalledWith('docs', 'https://example.com')
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('cancels the link form without inserting', () => {
    mount()
    openButton('Link')
    click([...host.querySelectorAll('.ffb-link-actions button')][0])
    expect(resolved.onLink).not.toHaveBeenCalled()
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('closes an open popover on Escape and on outside pointerdown', () => {
    mount()
    openButton('Text Style')
    expect(host.querySelector('.ffb-popover')).not.toBeNull()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(host.querySelector('.ffb-popover')).toBeNull()
    openButton('Text Style')
    act(() => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(host.querySelector('.ffb-popover')).toBeNull()
  })

  it('toggles the same capsule closed and switches capsules open', () => {
    mount()
    openButton('Text Style')
    openButton('Text Style')
    expect(host.querySelector('.ffb-popover')).toBeNull()
    openButton('Text Style')
    openButton('Lists')
    expect(host.querySelector('.ffb-popover-title')?.textContent).toBe('List')
  })

  it('uses Simplified Chinese labels for the zh locale', () => {
    mount({ locale: 'zh-CN' })
    expect(button('文本样式')).toBeDefined()
    openButton('文本样式')
    expect(rows().map((row) => row.textContent)).toEqual(['正文', '标题 1', '标题 2', '标题 3', '标题 4', '标题 5', '标题 6'])
  })
})
