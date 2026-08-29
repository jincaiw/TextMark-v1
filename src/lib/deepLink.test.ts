import { describe, expect, it } from 'vitest'
import { parseTextmarkFileUrl } from './deepLink'

describe('TextMark file URL scheme', () => {
  it('accepts percent-encoded POSIX and Windows Markdown paths', () => {
    expect(parseTextmarkFileUrl('textmark://file/Users/me/My%20Notes.md')).toBe('/Users/me/My Notes.md')
    expect(parseTextmarkFileUrl('textmark://file/C:/Notes/Readme.md')).toBe('C:/Notes/Readme.md')
  })

  it('accepts absolute directory paths and leaves target classification to the native boundary', () => {
    expect(parseTextmarkFileUrl('textmark://file/Users/me/My%20Project')).toBe('/Users/me/My Project')
    expect(parseTextmarkFileUrl('textmark://file/C:/Work/project.with.dots')).toBe('C:/Work/project.with.dots')
  })

  it.each([
    'https://file/Users/me/Notes.md',
    'textmark://folder/Users/me/Notes.md',
    'textmark://file/Users/me/../secret.md',
    'textmark://file',
    'textmark://file/Users/me/Notes.md?open=1',
    'textmark://file/Users/me/Notes.md#anchor',
    'textmark://file/%E0%A4%A.md',
  ])('rejects invalid or unsafe URL %s', (url) => expect(parseTextmarkFileUrl(url)).toBeNull())
})
