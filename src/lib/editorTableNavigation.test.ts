import { describe, expect, it } from 'vitest'
import { markdownTableNavigationPlan } from './editorTableNavigation'

const source = '| A | B |\n| --- | --- |\n| C | D |'

describe('Markdown table keyboard navigation', () => {
  it('moves forward and backward between cell contents', () => {
    expect(markdownTableNavigationPlan(source, source.indexOf('A'), 'next')).toMatchObject({
      handled: true,
      selection: source.indexOf('B'),
    })
    expect(markdownTableNavigationPlan(source, source.indexOf('B'), 'previous')).toMatchObject({
      handled: true,
      selection: source.indexOf('A'),
    })
  })

  it('skips the Markdown separator row when crossing rows', () => {
    expect(markdownTableNavigationPlan(source, source.indexOf('B'), 'next')).toMatchObject({
      handled: true,
      selection: source.indexOf('C'),
    })
    expect(markdownTableNavigationPlan(source, source.indexOf('| ---') + 1, 'previous')).toMatchObject({
      handled: true,
      selection: source.indexOf('B'),
    })
  })

  it('adds a blank row after the final cell and selects its first cell', () => {
    expect(markdownTableNavigationPlan(source, source.indexOf('D'), 'next')).toEqual({
      handled: true,
      change: { from: source.length, insert: '\n|  |  |' },
      selection: source.length + 3,
    })
  })

  it('keeps Shift-Tab at the first cell inside the table and ignores prose', () => {
    expect(markdownTableNavigationPlan(source, source.indexOf('A'), 'previous')).toEqual({ handled: true })
    expect(markdownTableNavigationPlan(`Before\n${source}\nAfter`, 0, 'next')).toEqual({ handled: false })
  })
})
