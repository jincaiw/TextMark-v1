import { describe, expect, it } from 'vitest'
import { formattingCommandForShortcut, isFormattingShortcut, isTextEntryControl } from './keyboardShortcuts'

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

  it('maps every formatting shortcut to its matching command', () => {
    const shortcuts = [
      [{ key: '0', altKey: true, shiftKey: false }, 'h0'],
      [{ key: '1', altKey: true, shiftKey: false }, 'h1'],
      [{ key: '2', altKey: true, shiftKey: false }, 'h2'],
      [{ key: '3', altKey: true, shiftKey: false }, 'h3'],
      [{ key: 'b', altKey: false, shiftKey: false }, 'bold'],
      [{ key: 'i', altKey: false, shiftKey: false }, 'italic'],
      [{ key: 'k', altKey: false, shiftKey: false }, 'link'],
      [{ key: "'", altKey: false, shiftKey: false }, 'quote'],
      [{ key: 'm', altKey: false, shiftKey: true }, 'code'],
      [{ key: 'x', altKey: false, shiftKey: true }, 'strikethrough'],
      [{ key: '7', altKey: false, shiftKey: true }, 'bulletList'],
      [{ key: '9', altKey: false, shiftKey: true }, 'orderedList'],
      [{ key: 'l', altKey: false, shiftKey: true }, 'taskList'],
    ] as const

    for (const [event, command] of shortcuts) expect(formattingCommandForShortcut(event)).toBe(command)
    expect(formattingCommandForShortcut({ key: 'f', altKey: false, shiftKey: false })).toBeNull()
    expect(formattingCommandForShortcut({ key: 'b', altKey: false, shiftKey: true })).toBe('bold')
  })
})
