export type ToolbarVisibilityStorage = Pick<Storage, 'getItem' | 'setItem'>

export function toolbarVisibilityStorageKey(windowLabel: string): string {
  return `textmark.toolbarVisible.${windowLabel}`
}

export function readToolbarVisibility(storage: ToolbarVisibilityStorage, key: string): boolean {
  try {
    return storage.getItem(key) !== 'false'
  } catch {
    return true
  }
}

export function saveToolbarVisibility(storage: ToolbarVisibilityStorage, key: string, visible: boolean): void {
  try {
    storage.setItem(key, String(visible))
  } catch {
    // Keep toolbar toggling available when browser storage is unavailable.
  }
}
