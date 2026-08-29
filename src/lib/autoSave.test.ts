import { describe, expect, it } from 'vitest'
import { autoSaveDelayMs, shouldAutoSave } from './autoSave'

describe('automatic saving policy', () => {
  it('maps disabled, thirty-second, and minute settings to safe delays', () => {
    expect(autoSaveDelayMs(0)).toBeNull()
    expect(autoSaveDelayMs(-30)).toBe(30_000)
    expect(autoSaveDelayMs(1)).toBe(60_000)
    expect(autoSaveDelayMs(60)).toBe(3_600_000)
  })

  it('never schedules an unsaved, clean, conflicted, or in-flight document', () => {
    const ready = { delayMs: 30_000, hasPath: true, dirty: true, hasExternalChange: false, saving: false }
    expect(shouldAutoSave(ready)).toBe(true)
    expect(shouldAutoSave({ ...ready, hasPath: false })).toBe(false)
    expect(shouldAutoSave({ ...ready, dirty: false })).toBe(false)
    expect(shouldAutoSave({ ...ready, hasExternalChange: true })).toBe(false)
    expect(shouldAutoSave({ ...ready, saving: true })).toBe(false)
  })
})
