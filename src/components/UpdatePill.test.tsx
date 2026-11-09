// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdatePill } from './UpdatePill'
import type { UpdateStatus } from '../hooks/useUpdater'

describe('UpdatePill', () => {
  let host: HTMLDivElement
  let root: Root
  const onInstall = vi.fn()
  const onCheck = vi.fn()
  const onRelaunch = vi.fn()

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    onInstall.mockReset()
    onCheck.mockReset()
    onRelaunch.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  function render(status: UpdateStatus, props: Partial<ComponentProps<typeof UpdatePill>> = {}) {
    act(() =>
      root.render(<UpdatePill status={status} locale="en" onInstall={onInstall} onCheck={onCheck} onRelaunch={onRelaunch} {...props} />),
    )
  }

  it('renders nothing while idle', () => {
    render({ state: 'idle' })
    expect(host.textContent).toBe('')
  })

  it('shows the available state with a download action', () => {
    render({ state: 'available', version: '0.10.42' })
    expect(host.textContent).toContain('An update is available 0.10.42')
    const button = host.querySelector<HTMLButtonElement>('.update-pill-action')
    expect(button?.textContent).toBe('Download')
    act(() => button?.click())
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onRelaunch).not.toHaveBeenCalled()
  })

  it('shows download progress without a dismiss control', () => {
    render({ state: 'downloading', progress: 0.42 })
    expect(host.textContent).toContain('Downloading update 42%')
    expect(host.querySelector('.update-pill-close')).toBeNull()
  })

  it('offers Relaunch Now once the update is ready', () => {
    render({ state: 'ready', version: '0.10.42' })
    expect(host.textContent).toContain('Update ready — restart to apply')
    const button = host.querySelector<HTMLButtonElement>('.update-pill-action')
    expect(button?.textContent).toBe('Relaunch Now')
    act(() => button?.click())
    expect(onRelaunch).toHaveBeenCalledTimes(1)
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('reports a failed update with a retry action', () => {
    render({ state: 'error', errorCode: 'update_network' })
    expect(host.textContent).toContain('Update failed')
    const button = host.querySelector<HTMLButtonElement>('.update-pill-action')
    expect(button?.textContent).toBe('Retry')
    act(() => button?.click())
    expect(onCheck).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses the all-clear state after four seconds', () => {
    vi.useFakeTimers()
    try {
      render({ state: 'current' })
      expect(host.textContent).toContain('TextMark is up to date')
      act(() => vi.advanceTimersByTime(4000))
      expect(host.textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the current state until dismissed manually', () => {
    render({ state: 'current' })
    const close = host.querySelector<HTMLButtonElement>('.update-pill-close')
    act(() => close?.click())
    expect(host.textContent).toBe('')
  })

  it('titles the capsule with the version when one is known', () => {
    render({ state: 'available', version: '0.10.42' })
    expect(host.querySelector('.update-pill')?.getAttribute('title')).toContain('0.10.42')
  })
})
