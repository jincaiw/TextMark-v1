import { describe, expect, it } from 'vitest'
import { readSidebarWidth, SIDEBAR_WIDTH_RANGE } from './layoutState'

const storage = (value: number | string | null) => ({
  getItem: (key: string) => (key === 'textmark.sidebarWidth' ? (value === null ? null : String(value)) : null),
})

describe('sidebar width persistence', () => {
  it('seeds the width that puts the divider on the upstream 240pt edge', () => {
    // 234 stored + the 6pt drag handle = the 240pt pane the reference shows.
    expect(SIDEBAR_WIDTH_RANGE.default).toBe(234)
    expect(readSidebarWidth(storage(null))).toBe(234)
  })

  it('moves a profile that still carries an earlier seed onto the new one', () => {
    expect(readSidebarWidth(storage(240))).toBe(234)
    expect(readSidebarWidth(storage(230))).toBe(234)
    expect(readSidebarWidth(storage(260))).toBe(234)
  })

  it('keeps a width the reader chose', () => {
    expect(readSidebarWidth(storage(300))).toBe(300)
    expect(readSidebarWidth(storage(150))).toBe(SIDEBAR_WIDTH_RANGE.min)
  })
})
