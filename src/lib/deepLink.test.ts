import { describe, expect, it } from 'vitest'
import { parseTextmarkFileUrl } from './deepLink'

describe('TextMark file URL scheme', () => {
  it('accepts percent-encoded POSIX and Windows Markdown paths', () => {
    expect(parseTextmarkFileUrl('textmark://file/Users/me/My%20Notes.md')).toBe('/Users/me/My Notes.md')
    expect(parseTextmarkFileUrl('textmark://file/C:/Notes/Readme.md')).toBe('C:/Notes/Readme.md')
  })

  it.each([
    'https://file/Users/me/Notes.md',
    'textmark://folder/Users/me/Notes.md',
    'textmark://file/Users/me/Notes.pdf',
    'textmark://file/Users/me/../secret.md',
    'textmark://file/relative',
    'textmark://file/Users/me/Notes.md?open=1',
    'textmark://file/Users/me/Notes.md#anchor',
    'textmark://file/%E0%A4%A.md',
  ])('rejects invalid or unsafe URL %s', (url) => expect(parseTextmarkFileUrl(url)).toBeNull())
})
