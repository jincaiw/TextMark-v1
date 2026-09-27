import type { FormatCommand } from '../types'

/** Inputs that should keep native text-editing shortcuts instead of document formatting commands. */
export function isTextEntryControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches('input, textarea, select')
}

/** Format commands are global in preview mode, but must not hijack a search/settings field. */
export function isFormattingShortcut(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey'>): boolean {
  const key = event.key.toLowerCase()
  if (event.altKey && ['0', '1', '2', '3'].includes(key)) return true
  if (['b', 'i', 'k'].includes(key) || key === "'") return true
  return event.shiftKey && ['m', 'x', '7', '9', 'l'].includes(key)
}

/** Resolves the formatting key combinations advertised by the native menus. */
export function formattingCommandForShortcut(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey'>): FormatCommand | null {
  const key = event.key.toLowerCase()
  if (event.altKey && ['0', '1', '2', '3'].includes(key)) return (key === '0' ? 'h0' : `h${key}`) as FormatCommand
  if (key === 'b') return 'bold'
  if (key === 'i') return 'italic'
  if (key === 'k') return 'link'
  if (key === "'") return 'quote'
  if (!event.shiftKey) return null
  if (key === 'm') return 'code'
  if (key === 'x') return 'strikethrough'
  if (key === '7') return 'bulletList'
  if (key === '9') return 'orderedList'
  if (key === 'l') return 'taskList'
  return null
}
