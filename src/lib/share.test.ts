import { describe, expect, it, vi } from 'vitest'
import { shareMarkdownSource } from './share'

const source = '# TextMark'

describe('Markdown sharing', () => {
  it('prefers the native picker when available', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined)
    const clipboard = { writeText: vi.fn() }
    expect(await shareMarkdownSource({ source, name: 'readme.md', environment: { clipboard }, nativeShare })).toBe('shared')
    expect(nativeShare).toHaveBeenCalledOnce()
    expect(clipboard.writeText).not.toHaveBeenCalled()
  })

  it('falls back to Web Share and sends a Markdown file when supported', async () => {
    const nativeShare = vi.fn().mockRejectedValue(new Error('unsupported'))
    const share = vi.fn().mockResolvedValue(undefined)
    const clipboard = { writeText: vi.fn() }
    expect(
      await shareMarkdownSource({
        source,
        name: 'readme.md',
        environment: { clipboard, share, canShare: () => true },
        nativeShare,
      }),
    ).toBe('shared')
    expect(share.mock.calls[0][0].files?.[0]).toBeInstanceOf(File)
  })

  it('copies the source when sharing is unavailable or fails', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    expect(await shareMarkdownSource({ source, name: 'readme.md', environment: { clipboard } })).toBe('copied')
    expect(clipboard.writeText).toHaveBeenCalledWith(source)

    const share = vi.fn().mockRejectedValue(new Error('failed'))
    expect(await shareMarkdownSource({ source, name: 'readme.md', environment: { clipboard, share } })).toBe('copied')
  })

  it('does not copy after the user cancels a share sheet', async () => {
    const clipboard = { writeText: vi.fn() }
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    expect(await shareMarkdownSource({ source, name: 'readme.md', environment: { clipboard, share } })).toBe('cancelled')
    expect(clipboard.writeText).not.toHaveBeenCalled()
  })
})
