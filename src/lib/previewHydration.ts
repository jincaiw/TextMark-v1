/**
 * Export and print capture the *live* preview pane, so they have to wait until
 * that pane has finished its asynchronous work: Mermaid diagrams, local images
 * and web fonts all land in the DOM after the first paint.
 *
 * This gate answers one question: has the mounted preview reported itself ready
 * for this render key? The preview stays mounted behind the editor, so its
 * report remains valid across view-mode switches. A changed document produces
 * a new render key and must complete hydration before output actions proceed.
 */

/** Upper bound on the wait: a broken diagram or an image that never settles
 * must not trap a user action. The capture then uses the best available DOM. */
export const PREVIEW_HYDRATION_TIMEOUT_MS = 8_000

export interface PreviewHydrationGate {
  /** A pane is on screen and will report its hydration. */
  markMounted: () => void
  /** The pane left the screen: any report it made is no longer valid. */
  markUnmounted: () => void
  /** Called by the pane once diagrams, images and fonts have settled. */
  report: (renderKey: string) => void
  /** Resolves once the mounted pane has reported this exact render key. */
  wait: (renderKey: string, timeoutMs?: number) => Promise<void>
}

export function createPreviewHydrationGate(): PreviewHydrationGate {
  let reportedKey: string | null = null
  const waiters = new Set<{ key: string; settle: () => void }>()

  const invalidate = () => {
    reportedKey = null
  }
  const release = (key: string) => {
    for (const waiter of [...waiters]) if (waiter.key === key) waiter.settle()
  }

  return {
    markMounted: invalidate,
    markUnmounted: invalidate,
    report(renderKey) {
      reportedKey = renderKey
      release(renderKey)
    },
    wait(renderKey, timeoutMs = PREVIEW_HYDRATION_TIMEOUT_MS) {
      if (reportedKey === renderKey) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const waiter = {
          key: renderKey,
          settle: () => {
            waiters.delete(waiter)
            clearTimeout(timer)
            resolve()
          },
        }
        // `settle` can only run once the waiter is registered below, so the
        // closure never observes `timer` before it is assigned.
        const timer = setTimeout(() => waiter.settle(), timeoutMs)
        waiters.add(waiter)
      })
    },
  }
}
