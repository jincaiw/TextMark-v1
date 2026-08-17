import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { headingInfoForLine } from './editorHeadings'

const stateFor = (source: string) => EditorState.create({ doc: source, extensions: [markdown()] })

describe('headingInfoForLine', () => {
  it('detects ATX heading levels and ignores body text', () => {
    const state = stateFor('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\nplain text')
    for (let level = 1; level <= 6; level += 1) {
      expect(headingInfoForLine(state, level)?.level).toBe(level)
    }
    expect(headingInfoForLine(state, 7)).toBeNull()
  })

  it('detects setext headings but not their underline line', () => {
    const state = stateFor('Title\n=====\n\nSection\n---')
    expect(headingInfoForLine(state, 1)?.level).toBe(1)
    expect(headingInfoForLine(state, 2)).toBeNull()
    expect(headingInfoForLine(state, 4)?.level).toBe(2)
    expect(headingInfoForLine(state, 5)).toBeNull()
  })

  it('flags headings that follow a blank line', () => {
    const state = stateFor('# First\n\n## Second\n### Third')
    expect(headingInfoForLine(state, 1)?.afterBlank).toBe(false)
    expect(headingInfoForLine(state, 3)?.afterBlank).toBe(true)
    expect(headingInfoForLine(state, 4)?.afterBlank).toBe(false)
  })

  it('ignores heading syntax inside fenced and inline code', () => {
    const fenced = stateFor('```\n# not a heading\n```')
    expect(headingInfoForLine(fenced, 2)).toBeNull()
    const inline = stateFor('code `# not` after')
    expect(headingInfoForLine(inline, 1)).toBeNull()
  })

  it('stylizes headings inside blockquotes', () => {
    const state = stateFor('> # Quote Heading')
    expect(headingInfoForLine(state, 1)?.level).toBe(1)
  })

  it('treats a horizontal rule as a plain line', () => {
    const state = stateFor('text\n\n---')
    expect(headingInfoForLine(state, 3)).toBeNull()
  })
})
