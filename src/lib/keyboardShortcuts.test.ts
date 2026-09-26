import { describe, expect, it } from 'vitest'
import { isFormattingShortcut, isTextEntryControl } from './keyboardShortcuts'

describe('keyboard shortcut routing', () => {
  it('recognizes text fields without treating editor content as a form field', () => {
    expect(isTextEntryControl(document.createElement('input'))).toBe(true)
    expect(isTextEntryControl(document.createElement('textarea'))).toBe(true)
    expect(isTextEntryControl(document.createElement('div'))).toBe(false)
    expect(isTextEntryControl(null)).toBe(false)
  })

  it('identifies document-formatting shortcuts', () => {
    expect(isFormattingShortcut({ key: 'b', altKey: false, shiftKey: false })).toBe(true)
    expect(isFormattingShortcut({ key: '1', altKey: true, shiftKey: false })).toBe(true)
    expect(isFormattingShortcut({ key: 'm', altKey: false, shiftKey: true })).toBe(true)
    expect(isFormattingShortcut({ key: 'f', altKey: false, shiftKey: false })).toBe(false)
  })
})
