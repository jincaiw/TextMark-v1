// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomizeThemeSheet, type ReadingLook } from './CustomizeThemeSheet'
import { READER_LAYOUT_RANGES } from '../lib/settings'

type SheetProps = ComponentProps<typeof CustomizeThemeSheet>

const makeLook = (overrides: Partial<ReadingLook> = {}): ReadingLook => ({
  documentFont: 'system',
  themeColors: {},
  boldText: false,
  readerCustomized: false,
  characterSpacingPercent: 0,
  wordSpacingPercent: 0,
  marginsPercent: 0,
  ...overrides,
})

const makeProps = (overrides: Partial<SheetProps> = {}): SheetProps => ({
  open: true,
  locale: 'en',
  theme: 'system',
  themePreset: 'original',
  look: makeLook(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
  onResetTheme: vi.fn(),
  ...overrides,
})

describe('CustomizeThemeSheet', () => {
  let host: HTMLDivElement
  let root: Root | null

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root?.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  function render(props: SheetProps) {
    act(() => root!.render(<CustomizeThemeSheet {...props} />))
  }

  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const result = host.querySelector<T>(selector)
    expect(result, selector).not.toBeNull()
    return result!
  }

  it('renders the header with cancel on the left and a prominent Done on the right', () => {
    const html = renderToStaticMarkup(<CustomizeThemeSheet {...makeProps()} />)
    expect(html).toContain('Customize Theme')
    const sheet = document.createElement('div')
    sheet.innerHTML = html
    const header = sheet.querySelector('header')!
    const buttons = Array.from(header.querySelectorAll('button'))
    expect(buttons[0].className).toContain('customize-theme-cancel')
    expect(buttons[buttons.length - 1].className).toContain('customize-theme-done')
  })

  it('holds edits in a draft until Done applies them', () => {
    const onApply = vi.fn()
    const onResetTheme = vi.fn()
    const props = makeProps({ onApply, onResetTheme })
    render(props)
    // Bold Text is ungated: flipping it changes the draft, not the saved look.
    act(() => element<HTMLInputElement>('.customize-theme-toggle input[type="checkbox"]').click())
    expect(onApply).not.toHaveBeenCalled()
    act(() => element<HTMLButtonElement>('.customize-theme-done').click())
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ ...props.look, boldText: true })
    expect(onResetTheme).not.toHaveBeenCalled()
  })

  it('Cancel discards the draft and reopens from the saved look', () => {
    const props = makeProps()
    render(props)
    act(() => element<HTMLInputElement>('.customize-theme-toggle input[type="checkbox"]').click())
    act(() => element<HTMLButtonElement>('.customize-theme-cancel').click())
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onApply).not.toHaveBeenCalled()
    // Reopening repopulates from the unchanged saved look.
    render({ ...props, look: makeLook({ boldText: true }) })
    expect(element<HTMLInputElement>('.customize-theme-toggle input[type="checkbox"]').checked).toBe(true)
  })

  it('lists every reading face rendered in its own typeface with a checkmark on the current one', () => {
    const props = makeProps({ look: makeLook({ documentFont: 'newYork' }) })
    render(props)
    act(() => element<HTMLButtonElement>('.customize-theme-font-header').click())
    const options = Array.from(host.querySelectorAll<HTMLButtonElement>('.customize-theme-fonts button'))
    expect(options).toHaveLength(12)
    expect(options.map((option) => option.textContent)).toEqual([
      'Original',
      'Athelas',
      'Avenir Next',
      'Charter',
      'Georgia',
      'Iowan',
      'New York',
      'Palatino',
      'SF Rounded',
      'Seravek',
      'Times New Roman',
      'Monospace',
    ])
    expect(options[0].style.fontFamily).not.toBe(options[6].style.fontFamily)
    const checked = options.filter((option) => option.querySelector('svg'))
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toBe('New York')
    act(() => options[3].click())
    expect(options[6].querySelector('svg')).toBeNull()
  })

  it('gates the spacing sliders behind the Customize switch', () => {
    const props = makeProps({ look: makeLook({ readerCustomized: true, characterSpacingPercent: 4 }) })
    render(props)
    const sliders = Array.from(host.querySelectorAll<HTMLInputElement>('.customize-slider input[type="range"]'))
    expect(sliders).toHaveLength(3)
    const [character, word, margins] = sliders
    expect(character.min).toBe(String(READER_LAYOUT_RANGES.characterSpacing.min))
    expect(character.max).toBe(String(READER_LAYOUT_RANGES.characterSpacing.max))
    expect(word.max).toBe(String(READER_LAYOUT_RANGES.wordSpacing.max))
    expect(margins.min).toBe(String(READER_LAYOUT_RANGES.margins.min))
    // The gate hides the sliders when turned off.
    const gate = host.querySelectorAll<HTMLInputElement>('.customize-theme-toggle input[type="checkbox"]')[1]
    act(() => gate.click())
    expect(host.querySelectorAll('.customize-slider')).toHaveLength(0)
    act(() => element<HTMLButtonElement>('.customize-theme-done').click())
    expect(props.onApply).toHaveBeenCalledExactlyOnceWith({ ...props.look, readerCustomized: false })
  })

  it('shows separate Light and Dark wells in the automatic appearance, and one pinned well otherwise', () => {
    render(makeProps({ theme: 'system' }))
    expect(host.querySelectorAll('.customize-theme-color input[type="color"]')).toHaveLength(8)
    const labels = Array.from(host.querySelectorAll('.customize-theme-well small')).map((small) => small.textContent)
    expect(labels).toEqual(['Light', 'Dark', 'Light', 'Dark', 'Light', 'Dark', 'Light', 'Dark'])
    expect(host.querySelector('.customize-theme-note')!.textContent).toBe(
      'Each color has a separate value for the Light and Dark appearance. Picking the default color removes the override.',
    )
    render(makeProps({ theme: 'light' }))
    expect(host.querySelectorAll('.customize-theme-color input[type="color"]')).toHaveLength(4)
    expect(host.querySelector('.customize-theme-note')!.textContent).toBe(
      'Colors apply to the current appearance. Start with Original and choose Automatic to set Light and Dark separately.',
    )
  })

  it('exposes the four upstream color rows with the current palette values', () => {
    const html = renderToStaticMarkup(<CustomizeThemeSheet {...makeProps({ theme: 'dark' })} />)
    const sheet = document.createElement('div')
    sheet.innerHTML = html
    const rows = Array.from(sheet.querySelectorAll('.customize-theme-color'))
    expect(rows.map((row) => row.querySelector('span')!.textContent)).toEqual([
      'Window background',
      'Code block background',
      'Text',
      'Link',
    ])
    const values = Array.from(sheet.querySelectorAll<HTMLInputElement>('.customize-theme-color input[type="color"]')).map(
      (input) => input.value,
    )
    expect(values).toEqual(['#1c1c1c', '#2a2828', '#f5f5f7', '#2997ff'])
  })

  it('colors the live sample page from the draft, including unsaved edits', () => {
    render(makeProps({ theme: 'light', themePreset: 'calm' }))
    const sample = element<HTMLElement>('.customize-theme-sample')
    expect(sample.style.background).toBe('rgb(253, 246, 227)')
    const first = element<HTMLInputElement>('.customize-theme-color input[type="color"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set
    act(() => {
      setter!.call(first, '#123456')
      first.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(first.value).toBe('#123456')
    expect(element<HTMLElement>('.customize-theme-sample').style.background).toBe('rgb(18, 52, 86)')
  })

  it('Reset Theme asks the parent to restore the preset look', () => {
    const props = makeProps({ look: makeLook({ boldText: true, readerCustomized: true }) })
    render(props)
    const reset = element<HTMLButtonElement>('.customize-theme-reset')
    expect(reset.disabled).toBe(false)
    act(() => reset.click())
    expect(props.onResetTheme).toHaveBeenCalledTimes(1)
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    const { open: _open, ...rest } = makeProps({ open: false })
    render({ open: false, ...rest })
    expect(host.childElementCount).toBe(0)
  })

  it('localizes the sheet into Simplified Chinese like upstream', () => {
    const html = renderToStaticMarkup(
      <CustomizeThemeSheet {...makeProps({ locale: 'zh-CN', look: makeLook({ readerCustomized: true }) })} />,
    )
    expect(html).toContain('自定主题')
    expect(html).toContain('字体')
    expect(html).toContain('粗体文本')
    expect(html).toContain('辅助功能与布局选项')
    expect(html).toContain('自定')
    expect(html).toContain('字间距')
    expect(html).toContain('词间距')
    expect(html).toContain('页边距')
    expect(html).toContain('重置主题')
    expect(html).toContain('窗口背景')
    expect(html).toContain('正文')
  })
})
