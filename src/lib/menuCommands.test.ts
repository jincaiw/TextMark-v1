import { describe, expect, it } from 'vitest'
import { externalMenuUrl, tabIndexForShortcut } from './menuCommands'

describe('external menu commands', () => {
  it.each([
    ['project-home', 'https://github.com/jincaiw/TextMark-v1'],
    ['github-releases', 'https://github.com/jincaiw/TextMark-v1/releases'],
    ['release-notes', 'https://github.com/jincaiw/TextMark-v1/releases'],
    ['report-issue', 'https://github.com/jincaiw/TextMark-v1/issues/new'],
  ])('maps %s to its GitHub URL', (command, url) => {
    expect(externalMenuUrl(command)).toBe(url)
  })

  it('does not open external URLs for unrelated commands', () => {
    expect(externalMenuUrl('help')).toBeUndefined()
    expect(externalMenuUrl('unknown-command')).toBeUndefined()
  })
})

describe('tab index for ⌘1–⌘9 shortcuts', () => {
  it('picks the matching tab for ⌘1–⌘8 when it exists', () => {
    expect(tabIndexForShortcut('1', 5)).toBe(0)
    expect(tabIndexForShortcut('5', 5)).toBe(4)
    expect(tabIndexForShortcut('8', 10)).toBe(7)
  })

  it('returns null when the numbered tab does not exist', () => {
    expect(tabIndexForShortcut('5', 3)).toBeNull()
    expect(tabIndexForShortcut('8', 2)).toBeNull()
  })

  it('always picks the last tab for ⌘9, Safari-style', () => {
    expect(tabIndexForShortcut('9', 1)).toBe(0)
    expect(tabIndexForShortcut('9', 3)).toBe(2)
    expect(tabIndexForShortcut('9', 12)).toBe(11)
  })

  it('ignores non-tab keys and empty tab lists', () => {
    expect(tabIndexForShortcut('0', 5)).toBeNull()
    expect(tabIndexForShortcut('f', 5)).toBeNull()
    expect(tabIndexForShortcut('1', 0)).toBeNull()
    expect(tabIndexForShortcut('9', 0)).toBeNull()
  })
})
