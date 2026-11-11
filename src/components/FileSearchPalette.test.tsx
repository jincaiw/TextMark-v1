import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileSearchPalette } from './FileSearchPalette'
import type { IndexedFile } from '../lib/fileSearchIndex'

const project = (name: string, path: string): IndexedFile => ({
  name,
  path,
  absolutePath: `/proj/${path}`,
  isRecent: false,
})
const recent = (name: string, absolutePath: string): IndexedFile => ({
  name,
  path: absolutePath,
  absolutePath,
  isRecent: true,
})

type PaletteProps = ComponentProps<typeof FileSearchPalette>
const props = (over: Partial<PaletteProps> = {}): PaletteProps => ({
  open: true,
  locale: 'en',
  projectFiles: [],
  recents: [],
  projectName: null,
  truncated: false,
  onOpen: vi.fn(),
  onOpenFolder: vi.fn(),
  onClose: vi.fn(),
  ...over,
})

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const mount = async (over: Partial<PaletteProps> = {}) => {
  const resolved = props(over)
  await act(async () => root.render(<FileSearchPalette {...resolved} />))
  // Flush the requestAnimationFrame that focuses the field on open.
  await act(async () => vi.advanceTimersByTime(20))
  return resolved
}

const type = async (text: string) => {
  const input = host.querySelector<HTMLInputElement>('.file-search-input')!
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // Non-blank queries are debounced 100ms like upstream.
  await act(async () => vi.advanceTimersByTime(120))
}

const press = async (init: KeyboardEventInit) => {
  await act(async () => {
    host.querySelector<HTMLElement>('.file-search-palette')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  })
}

const fileRows = () => Array.from(host.querySelectorAll<HTMLElement>('.file-search-file'))
const selectedIndex = () => fileRows().findIndex((row) => row.dataset.selected === 'true')

describe('FileSearchPalette', () => {
  it('renders nothing while closed', async () => {
    await mount({ open: false, recents: [recent('README.md', '/a/README.md')] })
    expect(host.querySelector('.file-search-palette')).toBeNull()
  })

  it('lists recent files under a Recent Files header with the first selected', async () => {
    await mount({
      recents: [recent('README.md', '/a/README.md'), recent('notes.md', '/a/notes.md')],
    })
    expect(host.querySelector('.file-search-header')?.textContent).toBe('Recent Files')
    expect(fileRows()).toHaveLength(2)
    expect(selectedIndex()).toBe(0)
    expect(fileRows()[0].querySelector('.file-search-file-name')?.textContent).toBe('README.md')
  })

  it('shows only recents on a blank query even when a project is mounted', async () => {
    await mount({
      projectName: 'proj',
      projectFiles: [project('guide.md', 'docs/guide.md')],
      recents: [recent('README.md', '/a/README.md')],
    })
    expect(host.querySelectorAll('.file-search-header')).toHaveLength(1)
    expect(host.querySelector('.file-search-header')?.textContent).toBe('Recent Files')
    expect(fileRows()).toHaveLength(1)
  })

  it('offers Open Folder from the empty recents-only state', async () => {
    const onOpenFolder = vi.fn()
    await mount({ onOpenFolder })
    expect(host.querySelector('.file-search-empty')?.textContent).toContain('No recent files')
    const button = host.querySelector<HTMLButtonElement>('.file-search-open-folder')!
    expect(button.textContent).toBe('Open Folder…')
    await act(async () => button.click())
    expect(onOpenFolder).toHaveBeenCalledTimes(1)
  })

  it('ranks project files for a query, bolds the match and opens with Return', async () => {
    const onOpen = vi.fn()
    await mount({
      projectName: 'proj',
      projectFiles: [project('guide.md', 'docs/guide.md'), project('README.md', 'README.md')],
      onOpen,
    })
    await type('read')
    expect(host.querySelector('.file-search-header')?.textContent).toBe('File Results')
    const rows = fileRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].querySelector('.file-search-file-name')?.textContent).toBe('README.md')
    expect(rows[0].querySelector('.file-search-file-name strong')).not.toBeNull()
    await press({ key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith('/proj/README.md', 'current')
  })

  it('shows No matching files without an Open Folder button when a project is mounted', async () => {
    await mount({ projectName: 'proj', projectFiles: [project('README.md', 'README.md')] })
    await type('zzzz')
    expect(host.querySelector('.file-search-empty')?.textContent).toContain('No matching files')
    expect(host.querySelector('.file-search-open-folder')).toBeNull()
  })

  it('still offers Open Folder for a no-match query when no project is mounted', async () => {
    await mount({ recents: [recent('a.md', '/a/a.md')] })
    await type('zzzz')
    expect(host.querySelector('.file-search-empty')?.textContent).toContain('No matching files')
    expect(host.querySelector('.file-search-open-folder')).not.toBeNull()
  })

  it('moves the selection with arrows and opens in the requested target', async () => {
    const onOpen = vi.fn()
    const recents = [recent('a.md', '/a/a.md'), recent('b.md', '/a/b.md'), recent('c.md', '/a/c.md')]
    await mount({ recents, onOpen })
    await press({ key: 'ArrowDown' })
    expect(selectedIndex()).toBe(1)
    await press({ key: 'Enter' })
    expect(onOpen).toHaveBeenLastCalledWith('/a/b.md', 'current')
    await press({ key: 'Enter', metaKey: true })
    expect(onOpen).toHaveBeenLastCalledWith('/a/b.md', 'tab')
    await press({ key: 'Enter', altKey: true })
    expect(onOpen).toHaveBeenLastCalledWith('/a/b.md', 'window')
    await press({ key: 'ArrowUp' })
    expect(selectedIndex()).toBe(0)
  })

  it('jumps with Home/End and pages with PageDown/PageUp', async () => {
    const recents = Array.from({ length: 10 }, (_, i) => recent(`f${i}.md`, `/a/f${i}.md`))
    await mount({ recents })
    await press({ key: 'End' })
    expect(selectedIndex()).toBe(9)
    await press({ key: 'Home' })
    expect(selectedIndex()).toBe(0)
    await press({ key: 'PageDown' })
    expect(selectedIndex()).toBe(7)
    await press({ key: 'PageUp' })
    expect(selectedIndex()).toBe(0)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    await mount({ recents: [recent('a.md', '/a/a.md')], onClose })
    await press({ key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens the displayed row on double-click', async () => {
    const onOpen = vi.fn()
    await mount({ recents: [recent('a.md', '/a/a.md'), recent('b.md', '/a/b.md')], onOpen })
    await act(async () => {
      fileRows()[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(onOpen).toHaveBeenCalledWith('/a/b.md', 'current')
  })

  it('notes a truncated project index once a query is active', async () => {
    await mount({
      projectName: 'proj',
      truncated: true,
      projectFiles: [project('README.md', 'README.md')],
    })
    expect(host.querySelector('.file-search-truncated')).toBeNull()
    await type('read')
    expect(host.querySelector('.file-search-truncated')?.textContent).toContain('Showing the first 1 files')
  })

  it('resets the field and selection each time it opens', async () => {
    const over = props({ recents: [recent('a.md', '/a/a.md'), recent('b.md', '/a/b.md')] })
    await act(async () => root.render(<FileSearchPalette {...over} />))
    await act(async () => vi.advanceTimersByTime(20))
    await type('b')
    expect(host.querySelector<HTMLInputElement>('.file-search-input')?.value).toBe('b')
    // Close then reopen: the field clears and the selection returns to the top.
    await act(async () => root.render(<FileSearchPalette {...over} open={false} />))
    await act(async () => root.render(<FileSearchPalette {...over} open />))
    await act(async () => vi.advanceTimersByTime(20))
    expect(host.querySelector<HTMLInputElement>('.file-search-input')?.value).toBe('')
    expect(selectedIndex()).toBe(0)
  })
})
