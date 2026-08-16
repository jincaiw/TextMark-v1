import { describe, expect, it } from 'vitest'
import { safeRelativeAssetPath } from './assets'

describe('system preview relative-asset boundary', () => {
  it.each([
    ['images/local.png', 'images/local.png'],
    ['images%20dir/two%20words.png', 'images dir/two words.png'],
    ['UPPER.JPG', 'UPPER.JPG'],
    ['./images/a.png?raw=1#x', 'images/a.png'],
  ])('accepts %s', (source, expected) => expect(safeRelativeAssetPath(source)).toBe(expected))

  it.each([
    'https://example.com/a.png',
    'http://example.com/a.png',
    'data:image/png;base64,iVBOR',
    'cid:already',
    'file:///etc/passwd',
    '/etc/passwd',
    '\\server\\share.png',
    '../secret.png',
    'images/../../secret.png',
    '%2Fetc%2Fpasswd',
    'file%3A%2F%2F%2Fetc%2Fpasswd',
    'C:%5CWindows%5Csecret.png',
  ])('rejects unsafe or non-local source %s', (source) => expect(safeRelativeAssetPath(source)).toBeNull())
})
