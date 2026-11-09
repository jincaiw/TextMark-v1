// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppearanceSettings } from './AppearanceSettings'

type AppearanceProps = ComponentProps<typeof AppearanceSettings>

const makeProps = (overrides: Partial<AppearanceProps> = {}): AppearanceProps => ({
  locale: 'en',
  theme: 'system',
  themePreset: 'normal',
  themeColors: {},
  documentFont: 'system',
  readerLayout: {
    boldText: false,
    isCustomized: false,
    lineSpacing: 1.6,
    characterSpacingPercent: 0,
    wordSpacingPercent: 0,
    marginsPercent: 0,
  },
  onThemeChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onThemeColorChange: vi.fn(),
  onThemeColorsReset: vi.fn(),
  onDocumentFontChange: vi.fn(),
  onReaderLayoutChange: vi.fn(),
  ...overrides,
})

describe('AppearanceSettings', () => {
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

  function render(props: AppearanceProps) {
    act(() => root!.render(<AppearanceSettings {...props} />))
  }

  it('shows the live sample page with the look applied', () => {
    render(makeProps())
    const page = host.querySelector<HTMLElement>('.theme-sample-page')!
    expect(page).not.toBeNull()
    expect(page.querySelector('.theme-sample-title')!.textContent).toBe('Aa')
    const prose = page.querySelector<HTMLElement>('.theme-sample-prose')!
    expect(prose.style.lineHeight).toBe('1.6')
  })

  it('applies bold text and customized spacing to the sample prose', () => {
    render(
      makeProps({
        readerLayout: {
          boldText: true,
          isCustomized: true,
          lineSpacing: 1.8,
          characterSpacingPercent: 4,
          wordSpacingPercent: 10,
          marginsPercent: 50,
        },
      }),
    )
    const prose = host.querySelector<HTMLElement>('.theme-sample-prose')!
    expect(prose.style.lineHeight).toBe('1.8')
    expect(prose.style.letterSpacing).toBe('0.04em')
    expect(prose.style.wordSpacing).toBe('0.1em')
    // 50% margins add the upstream 0.9 * 50 inset inside the column.
    expect(prose.style.paddingInline).toBe('73px')
    expect(prose.style.fontWeight).toBe('600')
  })

  it('ignores slider values while Customize is off, as upstream does', () => {
    render(
      makeProps({
        readerLayout: {
          boldText: false,
          isCustomized: false,
          lineSpacing: 2,
          characterSpacingPercent: 12,
          wordSpacingPercent: 25,
          marginsPercent: 100,
        },
      }),
    )
    const prose = host.querySelector<HTMLElement>('.theme-sample-prose')!
    expect(prose.style.lineHeight).toBe('1.6')
    expect(prose.style.letterSpacing).toBe('0em')
    expect(prose.style.wordSpacing).toBe('0em')
  })

  it('switches sections through the segmented picker and gates sliders on Customize', () => {
    const onReaderLayoutChange = vi.fn()
    render(makeProps({ onReaderLayoutChange }))
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('.appearance-section-picker button')]
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Themes', 'Font', 'Layout', 'Colors'])
    expect(host.querySelector('.theme-preset-grid')).not.toBeNull()

    act(() => tabs[2]!.click())
    expect(host.querySelector('.theme-preset-grid')).toBeNull()
    const sliders = [...host.querySelectorAll<HTMLInputElement>('.appearance-section input[type="range"]')]
    expect(sliders).toHaveLength(4)
    expect(sliders.every((slider) => slider.disabled)).toBe(true)
    act(() => sliders[0]!.click())
    // A disabled slider never reports a change; the Customize toggle drives it.
    expect(onReaderLayoutChange).not.toHaveBeenCalled()
    const customize = host.querySelector<HTMLInputElement>('.appearance-section input[type="checkbox"]')!
    act(() => customize.click())
    expect(onReaderLayoutChange).toHaveBeenCalledWith({ isCustomized: true })
  })

  it('updates slider values and enables Reset Theme only off the default look', () => {
    const onReaderLayoutChange = vi.fn()
    render(makeProps({ onReaderLayoutChange }))
    // Reset is disabled on the default look.
    const reset = host.querySelector<HTMLButtonElement>('.appearance-reset-row button')!
    expect(reset.disabled).toBe(true)

    act(() => {
      const tabs = [...host.querySelectorAll<HTMLButtonElement>('.appearance-section-picker button')]
      tabs[2]!.click()
    })
    const lineSpacing = host.querySelector<HTMLInputElement>('.appearance-section input[type="range"]')!
    const setNativeValue = (element: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
    act(() => setNativeValue(lineSpacing, '1.66'))
    expect(onReaderLayoutChange).toHaveBeenCalledWith({ lineSpacing: 1.66 })
  })

  it('reset restores the upstream defaults and clears color overrides', () => {
    const onReaderLayoutChange = vi.fn()
    const onThemeColorsReset = vi.fn()
    render(
      makeProps({
        themeColors: { light: { linkColor: '#0066CC' } },
        readerLayout: {
          boldText: true,
          isCustomized: true,
          lineSpacing: 1.7,
          characterSpacingPercent: 3,
          wordSpacingPercent: 5,
          marginsPercent: 10,
        },
        onReaderLayoutChange,
        onThemeColorsReset,
      }),
    )
    const reset = host.querySelector<HTMLButtonElement>('.appearance-reset-row button')!
    expect(reset.disabled).toBe(false)
    act(() => reset.click())
    expect(onThemeColorsReset).toHaveBeenCalledExactlyOnceWith()
    expect(onReaderLayoutChange).toHaveBeenCalledWith({
      boldText: false,
      isCustomized: false,
      lineSpacing: 1.6,
      characterSpacingPercent: 0,
      wordSpacingPercent: 0,
      marginsPercent: 0,
    })
  })

  it('offers the twelve reading faces and the Bold Text toggle in the Font section', () => {
    const onDocumentFontChange = vi.fn()
    render(makeProps({ onDocumentFontChange }))
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('.appearance-section-picker button')]
    act(() => tabs[1]!.click())
    const select = host.querySelector<HTMLSelectElement>('.appearance-section select')!
    expect(select.options).toHaveLength(12)
    expect([...select.options].map((option) => option.value)).toEqual([
      'system',
      'athelas',
      'avenirNext',
      'charter',
      'georgia',
      'iowan',
      'newYork',
      'palatino',
      'rounded',
      'seravek',
      'timesNewRoman',
      'monospace',
    ])
    act(() => {
      select.value = 'iowan'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onDocumentFontChange).toHaveBeenCalledWith('iowan')
    const bold = [...host.querySelectorAll<HTMLInputElement>('.appearance-section input[type="checkbox"]')][0]!
    act(() => bold.click())
    // Bold Text is its own switch, not gated behind Customize.
    expect(onDocumentFontChange).toHaveBeenCalledTimes(1)
  })
})
