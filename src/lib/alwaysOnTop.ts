export interface AlwaysOnTopTransition {
  nativePinned: boolean
  suspended: boolean
}

/**
 * Native full-screen spaces must not contain a floating window. Keep the
 * user's pin preference separately, then lower and restore only the native
 * level as the window moves in and out of full screen.
 */
export function resolveAlwaysOnTopTransition(preferred: boolean, fullscreen: boolean, suspended: boolean): AlwaysOnTopTransition {
  if (!preferred) return { nativePinned: false, suspended: false }
  if (fullscreen) return { nativePinned: false, suspended: true }
  if (suspended) return { nativePinned: true, suspended: false }
  return { nativePinned: true, suspended: false }
}
