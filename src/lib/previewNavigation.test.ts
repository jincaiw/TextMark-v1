// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollPreviewToFragment } from './previewNavigation'

afterEach(() => document.body.replaceChildren())

describe('preview fragment navigation', () => {
  it('scrolls only the preview pane to an encoded in-document target', () => {
    const pane = document.createElement('section')
    const root = document.createElement('article')
    const target = document.createElement('li')
    target.id = 'foot note'
    pane.append(root)
    root.append(target)
    document.body.append(pane)
    pane.scrollTop = 24
    pane.scrollTo = vi.fn()
    pane.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    target.getBoundingClientRect = () => ({ top: 190 }) as DOMRect

    expect(scrollPreviewToFragment(pane, root, '#foot%20note')).toBe(true)
    expect(pane.scrollTo).toHaveBeenCalledWith({ top: 114, behavior: 'smooth' })
  })

  it('ignores malformed, missing, and out-of-preview fragments', () => {
    const pane = document.createElement('section')
    const root = document.createElement('article')
    const outside = document.createElement('p')
    outside.id = 'outside'
    document.body.append(pane, root, outside)
    pane.scrollTo = vi.fn()

    expect(scrollPreviewToFragment(pane, root, '#bad%ZZ')).toBe(false)
    expect(scrollPreviewToFragment(pane, root, '#missing')).toBe(false)
    expect(scrollPreviewToFragment(pane, root, '#outside')).toBe(false)
    expect(pane.scrollTo).not.toHaveBeenCalled()
  })
})
