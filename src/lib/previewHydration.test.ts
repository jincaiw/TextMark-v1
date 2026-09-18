import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewHydrationGate, PREVIEW_HYDRATION_TIMEOUT_MS } from './previewHydration'

// Fake timers are installed for the timeout cases, so let the microtask queue
// drain instead of waiting on a real timer to observe "not settled yet".
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('preview hydration gate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when the pane on screen already reported that key', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    gate.report('doc:contents')
    await expect(gate.wait('doc:contents')).resolves.toBeUndefined()
  })

  it('does not let a report outlive the pane that made it', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    gate.report('doc:contents')
    gate.markUnmounted()

    let settled = false
    const pending = gate.wait('doc:contents').then(() => {
      settled = true
    })
    await flush()
    expect(settled).toBe(false)

    gate.markMounted()
    gate.report('doc:contents')
    await pending
    expect(settled).toBe(true)
  })

  it('treats a fresh mount as un-hydrated even without an explicit unmount', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    gate.report('doc:contents')
    gate.markMounted()

    let settled = false
    const pending = gate.wait('doc:contents').then(() => {
      settled = true
    })
    await flush()
    expect(settled).toBe(false)
    gate.report('doc:contents')
    await pending
  })

  it('keeps waiting while the reported key does not match', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    gate.report('doc:first')

    let settled = false
    const pending = gate.wait('doc:second').then(() => {
      settled = true
    })
    await flush()
    expect(settled).toBe(false)
    gate.report('doc:second')
    await pending
    expect(settled).toBe(true)
  })

  it('releases the wait after the timeout so a broken asset cannot trap an export', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    const pending = gate.wait('doc:contents')
    let settled = false
    void pending.then(() => {
      settled = true
    })
    vi.advanceTimersByTime(PREVIEW_HYDRATION_TIMEOUT_MS)
    await pending
    expect(settled).toBe(true)
  })

  it('clears the timeout once the report arrives', async () => {
    const gate = createPreviewHydrationGate()
    gate.markMounted()
    const pending = gate.wait('doc:contents')
    gate.report('doc:contents')
    await pending
    expect(vi.getTimerCount()).toBe(0)
  })
})
