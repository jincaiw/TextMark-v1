// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WhatsNewDialog } from './WhatsNewDialog'
import { fetchReleases, parseReleaseEntry, releaseTitle, releasesAfter, numericCompare } from '../lib/releaseNotes'

// The dialog downloads release notes in the background; tests replace the
// network so the fallback or a canned document renders deterministically.
const fetchMock = vi.fn<typeof fetch>()

vi.stubGlobal('fetch', fetchMock)

const RELEASE_BODY = `A more WYSIWYG Edit Mode.

### Added
- **Format on demand.** Markdown syntax hides while reading. ([#12](https://github.com/jincaiw/TextMark-v1/pull/12))
### Fixed
- **Table edits.** Clicking a cell selects its source. ([#13](https://github.com/jincaiw/TextMark-v1/issues/13), [#14](https://github.com/jincaiw/TextMark-v1/issues/14))

### Contributors
- [@octocat](https://github.com/octocat)
`

function githubRelease(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v0.10.41',
    name: 'A more WYSIWYG Edit Mode',
    body: RELEASE_BODY,
    draft: false,
    prerelease: false,
    published_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

describe('releaseNotes parsing', () => {
  it('parses an intro, titled items with trailing links, and contributors', () => {
    const entry = parseReleaseEntry(RELEASE_BODY)
    expect(entry.intro).toBe('A more WYSIWYG Edit Mode.')
    expect(entry.items).toEqual([
      {
        title: 'Format on demand',
        text: 'Markdown syntax hides while reading.',
        links: ['[#12](https://github.com/jincaiw/TextMark-v1/pull/12)'],
      },
      {
        title: 'Table edits',
        text: 'Clicking a cell selects its source.',
        links: ['[#13](https://github.com/jincaiw/TextMark-v1/issues/13)', '[#14](https://github.com/jincaiw/TextMark-v1/issues/14)'],
      },
    ])
    expect(entry.contributors).toEqual(['[@octocat](https://github.com/octocat)'])
  })

  it('keeps a bullet continuation line in one item', () => {
    const entry = parseReleaseEntry('- **Long item.** First half\nsecond half ([#1](https://x/pull/1))')
    expect(entry.items[0].text).toBe('First half second half.')
  })

  it('keeps summary prose under the first heading as the intro, then drops later prose', () => {
    // This repo's releases open "# Title" then the summary; upstream bodies
    // open with the intro. Both must yield the intro and drop thank-you prose.
    const entry = parseReleaseEntry(
      '# TextMark v1.0\n\nSummary EN.\n\nSummary ZH.\n\n## Highlights\n\n- **A.** Text.\n\n## Notes\n\nDropped prose.\n',
    )
    expect(entry.intro).toBe('Summary EN. Summary ZH.')
    expect(entry.items).toHaveLength(1)
    expect(JSON.stringify(entry)).not.toContain('Dropped prose.')
  })

  it('compares versions numerically', () => {
    expect(numericCompare('0.10.9', '0.10.10')).toBe(-1)
    expect(numericCompare('0.9', '0.10')).toBe(-1)
    expect(numericCompare('0.10.41', '0.10.41')).toBe(0)
  })

  it('selects the releases a reader has not seen, or the current one alone', () => {
    const releases = [
      { version: '0.10.40', name: null, date: '2026-10-01', body: '' },
      { version: '0.10.41', name: null, date: '2026-11-01', body: '' },
      { version: '0.10.42', name: null, date: '2026-11-02', body: '' },
    ]
    expect(releasesAfter(releases, '0.10.39', '0.10.41').map((release) => release.version)).toEqual(['0.10.40', '0.10.41'])
    // An unknown previous version, or a rebuild, gives the current version alone.
    expect(releasesAfter(releases, '', '0.10.41').map((release) => release.version)).toEqual(['0.10.41'])
    expect(releasesAfter(releases, '0.10.41', '0.10.41').map((release) => release.version)).toEqual(['0.10.41'])
  })

  it('falls back to item titles when a release predates titles', () => {
    const entry = parseReleaseEntry('### Added\n- **First.** Text.\n- **Second.** Text.\n')
    expect(releaseTitle({ version: '1.0', name: null, date: '', body: '' }, entry)).toBe('First, Second')
  })

  it('fetches stable v-tagged releases and drops drafts, prereleases and odd tags', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          githubRelease(),
          githubRelease({ tag_name: 'v0.10.42', draft: true }),
          githubRelease({ tag_name: 'v0.10.43', prerelease: true }),
          githubRelease({ tag_name: 'nightly' }),
          githubRelease({ tag_name: 'v0.10.44', published_at: null }),
        ]),
        { status: 200 },
      ),
    )
    const releases = await fetchReleases(fetchMock)
    expect(releases.map((release) => release.version)).toEqual(['0.10.41'])
  })

  it('throws on a non-ok response so the dialog keeps its fallback', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 403 }))
    await expect(fetchReleases(fetchMock)).rejects.toThrow('release_notes_http_403')
  })
})

describe('WhatsNewDialog', () => {
  let host: HTMLDivElement
  let root: Root
  const onClose = vi.fn()

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    onClose.mockReset()
    fetchMock.mockReset()
    fetchMock.mockRejectedValue(new Error('offline'))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  function render(props: Partial<ComponentProps<typeof WhatsNewDialog>> = {}) {
    act(() => root.render(<WhatsNewDialog locale="en" currentVersion="0.10.41" onClose={onClose} {...props} />))
  }

  it('shows release notes fetched from GitHub, with a link to previous releases', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([githubRelease()]), { status: 200 }))
    render({ previousVersion: '0.10.40' })
    await act(async () => undefined)
    expect(host.textContent).toContain("What's New in TextMark 0.10.41")
    expect(host.textContent).toContain('A more WYSIWYG Edit Mode')
    expect(host.textContent).toContain('Format on demand')
    expect(host.textContent).toContain('November 1, 2026')
    expect(host.querySelector('footer button.secondary')!.textContent).toContain('Previous releases')
  })

  it('shows the fallback highlights when the download fails or has no releases', async () => {
    render({ previousVersion: '0.10.40' })
    await act(async () => undefined)
    expect(host.textContent).toContain('Markdown syntax appears when you edit it')
    expect(host.textContent).toContain('Tables and escaped punctuation edit naturally')

    fetchMock.mockResolvedValue(new Response(JSON.stringify([githubRelease()]), { status: 200 }))
    render({ previousVersion: '0.10.41' })
    await act(async () => undefined)
    // The reader is current: nothing unseen, fallback content again.
    expect(host.textContent).toContain('Revisit release highlights')
  })

  it('keeps the localized Chinese fallback and closes from the Done button', async () => {
    render({ locale: 'zh-CN' })
    await act(async () => undefined)
    expect(host.textContent).toContain('TextMark 0.10.41 更新内容')
    expect(host.textContent).toContain('编辑模式所见即所得体验优化')
    act(() => host.querySelector<HTMLButtonElement>('footer button.primary')!.click())
    expect(onClose).toHaveBeenCalledOnce()
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
