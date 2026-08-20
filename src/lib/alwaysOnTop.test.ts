import { describe, expect, it } from 'vitest'
import { resolveAlwaysOnTopTransition } from './alwaysOnTop'

describe('always-on-top full-screen policy', () => {
  it('lowers a pinned window while full screen is active', () =>
    expect(resolveAlwaysOnTopTransition(true, true, false)).toEqual({ nativePinned: false, suspended: true }))
  it('restores a previously suspended pin after leaving full screen', () =>
    expect(resolveAlwaysOnTopTransition(true, false, true)).toEqual({ nativePinned: true, suspended: false }))
  it('does not restore a preference that was disabled while full screen', () =>
    expect(resolveAlwaysOnTopTransition(false, false, true)).toEqual({ nativePinned: false, suspended: false }))
})
