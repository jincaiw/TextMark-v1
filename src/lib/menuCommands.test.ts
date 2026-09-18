import { describe, expect, it } from 'vitest'
import { externalMenuUrl } from './menuCommands'

describe('external menu commands', () => {
  it.each([
    ['project-home', 'https://github.com/jincaiw/TextMark-v1'],
    ['github-releases', 'https://github.com/jincaiw/TextMark-v1/releases'],
    ['report-issue', 'https://github.com/jincaiw/TextMark-v1/issues/new'],
  ])('maps %s to its GitHub URL', (command, url) => {
    expect(externalMenuUrl(command)).toBe(url)
  })

  it('does not open external URLs for unrelated commands', () => {
    expect(externalMenuUrl('help')).toBeUndefined()
    expect(externalMenuUrl('unknown-command')).toBeUndefined()
  })
})
