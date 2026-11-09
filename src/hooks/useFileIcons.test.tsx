import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileIcons } from './useFileIcons'

const iconInvoke = vi.hoisted(() => vi.fn())
vi.mock('../lib/platform', () => ({ fileIconDataUrl: iconInvoke }))

/** Renders the hook into a detached host and returns a state reader. */
function renderUseFileIcons() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let latest: ReturnType<typeof useFileIcons> | null = null
  function Probe() {
    latest = useFileIcons()
    return null
  }
  act(() => createRoot(host).render(<Probe />))
  return {
    requestIcon: (path: string) => act(() => latest!.requestIcon(path)),
    icons: () => latest!.icons,
    cleanup: () => {
      host.remove()
    },
  }
}

describe('useFileIcons', () => {
  beforeEach(() => {
    iconInvoke.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests each path once and caches the data URL', async () => {
    iconInvoke.mockResolvedValue('data:image/png;base64,AAA')
    const harness = renderUseFileIcons()
    try {
      harness.requestIcon('/a.md')
      harness.requestIcon('/a.md')
      expect(iconInvoke).toHaveBeenCalledTimes(1)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(harness.icons()['/a.md']).toBe('data:image/png;base64,AAA')
      // A repeat after resolution stays cached.
      harness.requestIcon('/a.md')
      expect(iconInvoke).toHaveBeenCalledTimes(1)
    } finally {
      harness.cleanup()
    }
  })

  it('stores empty string on failure without retrying', async () => {
    iconInvoke.mockRejectedValue(new Error('nope'))
    const harness = renderUseFileIcons()
    try {
      harness.requestIcon('/b.md')
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(harness.icons()['/b.md']).toBe('')
      harness.requestIcon('/b.md')
      expect(iconInvoke).toHaveBeenCalledTimes(1)
    } finally {
      harness.cleanup()
    }
  })
})
