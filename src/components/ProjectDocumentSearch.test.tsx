// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectDocumentSearch } from './ProjectDocumentSearch'
import type { FileNode } from '../types'

const files: FileNode[] = [
  {
    name: 'notes',
    path: '/project/notes',
    isDirectory: true,
    children: [
      { name: 'Design.md', path: '/project/notes/Design.md', isDirectory: false, children: [] },
      { name: 'Draft.md', path: '/project/notes/Draft.md', isDirectory: false, children: [] },
      { name: 'cover.png', path: '/project/notes/cover.png', isDirectory: false, children: [] },
    ],
  },
]

describe('ProjectDocumentSearch', () => {
  let host: HTMLDivElement
  let root: Root
  const onOpenCurrent = vi.fn()
  const onOpenInTab = vi.fn()
  const onOpenInWindow = vi.fn()
  const onOpenFolder = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  const render = async (fileTree: FileNode[] = files) => {
    await act(async () =>
      root.render(
        <ProjectDocumentSearch
          files={fileTree}
          activePath="/project/notes/Design.md"
          locale="en"
          onOpenCurrent={onOpenCurrent}
          onOpenInTab={onOpenInTab}
          onOpenInWindow={onOpenInWindow}
          onOpenFolder={onOpenFolder}
          onClose={onClose}
        />,
      ),
    )
  }

  const setQuery = async (query: string) => {
    const input = host.querySelector('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, query)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    return input
  }

  it('filters nested Markdown files by fuzzy filename and opens the selected result in a new tab', async () => {
    await render()
    const input = host.querySelector('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'dsgn')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.textContent).toContain('Design.md')
    expect(host.textContent).not.toContain('Draft.md')
    expect(host.textContent).not.toContain('cover.png')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })))
    expect(onOpenInTab).toHaveBeenCalledWith('/project/notes/Design.md')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses Alt+Return for opening a result in a separate window', async () => {
    await render()
    const input = await setQuery('d')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true })))
    expect(onOpenInWindow).toHaveBeenCalledWith('/project/notes/Draft.md')
  })

  it('supports Home and End to select the first and last search results', async () => {
    await render()
    const input = await setQuery('d')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(host.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Design.md')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
    expect(host.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Draft.md')
  })

  it('moves selection by a visible page with PageUp and PageDown', async () => {
    const documents: FileNode[] = Array.from({ length: 12 }, (_, index) => ({
      name: `Page ${index + 1}.md`,
      path: `/project/Page ${index + 1}.md`,
      isDirectory: false,
      children: [],
    }))
    await render(documents)
    const input = await setQuery('page')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })))
    expect(host.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Page 6.md')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })))
    expect(host.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Page 1.md')
  })

  it('opens as a compact search field without showing results before typing', async () => {
    await render()
    expect(host.querySelector('.project-search-file-name')).toBeNull()
    expect(host.querySelector('.project-search-footer')).toBeNull()
  })

  it('does not match a file only because its parent folder contains the query', async () => {
    await render()
    await setQuery('notes')
    expect(host.textContent).toContain('No matching Markdown documents')
    expect(host.querySelector('.project-search-file-name')).toBeNull()
  })

  it('matches and highlights a fuzzy relative path when the query contains a slash', async () => {
    await render()
    await setQuery('notes/dsgn')
    expect(host.textContent).toContain('Design.md')
    expect(host.querySelectorAll('.project-search-file-name strong')).toHaveLength(0)
    expect(host.querySelectorAll('.project-search-file-path strong')).toHaveLength(10)
  })
})
