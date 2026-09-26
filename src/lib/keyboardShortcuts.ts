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
