/**
 * Settings store the upstream-compatible minute value. -30 is the explicit
 * thirty-second option, 0 disables automatic saving.
 */
export function autoSaveDelayMs(minutes: number): number | null {
  if (minutes === -30) return 30_000
  if (minutes <= 0) return null
  return minutes * 60_000
}

export function shouldAutoSave(input: {
  delayMs: number | null
  hasPath: boolean
  dirty: boolean
  hasExternalChange: boolean
  saving: boolean
}): boolean {
  return Boolean(input.delayMs && input.hasPath && input.dirty && !input.hasExternalChange && !input.saving)
}
