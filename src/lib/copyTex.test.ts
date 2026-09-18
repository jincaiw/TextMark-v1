import { describe, expect, it, vi } from 'vitest'
import { writeKatexSelectionToClipboard } from './copyTex'

function select(root: HTMLElement, start: Node, startOffset: number, end: Node, endOffset: number) {
  const range = document.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return root
}

function clipboardEvent() {
  const values = new Map<string, string>()
  return {
    event: {
      clipboardData: { setData: (type: string, value: string) => values.set(type, value) },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent,
    values,
  }
}

describe('KaTeX selection copy', () => {
  it('rewrites inline math to its original TeX while preserving HTML', () => {
    const root = document.createElement('article')
    root.innerHTML =
      'Before <span class="katex"><span class="katex-mathml"><math><annotation>x^2</annotation></math></span><span class="katex-html">visual</span></span> after'
    document.body.append(root)
    select(root, root.firstChild!, 0, root.lastChild!, root.lastChild!.textContent!.length)
    const { event, values } = clipboardEvent()

    expect(writeKatexSelectionToClipboard(event, root)).toBe(true)
    expect(values.get('text/plain')).toBe('Before $x^2$ after')
    expect(values.get('text/html')).toContain('katex-html')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    root.remove()
  })

  it('expands a partial display-math selection and uses display delimiters', () => {
    const root = document.createElement('article')
    root.innerHTML =
      '<span class="katex-display"><span class="katex"><span class="katex-mathml"><math><annotation>\\int_0^1 x dx</annotation></math></span><span class="katex-html"><span>visual</span></span></span></span>'
    document.body.append(root)
    const visual = root.querySelector('.katex-html span')!.firstChild!
    select(root, visual, 1, visual, 4)
    const { event, values } = clipboardEvent()

    expect(writeKatexSelectionToClipboard(event, root)).toBe(true)
    expect(values.get('text/plain')).toBe('$$\\int_0^1 x dx$$')
    root.remove()
  })

  it('leaves ordinary text selections to the browser', () => {
    const root = document.createElement('article')
    root.textContent = 'ordinary text'
    document.body.append(root)
    select(root, root.firstChild!, 0, root.firstChild!, 8)
    const { event, values } = clipboardEvent()

    expect(writeKatexSelectionToClipboard(event, root)).toBe(false)
    expect(values.size).toBe(0)
    expect(event.preventDefault).not.toHaveBeenCalled()
    root.remove()
  })
})
