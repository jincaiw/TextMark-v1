import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri } from '../lib/platform'

/** The phases the update capsule walks through, mirroring upstream's
 * UpdateModel.Phase. `current` is the up-to-date step (auto-hides), `error`
 * the failed step, and `updated` the post-relaunch "Updated to …" greeting. */
export type UpdateStatus = {
  state: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'preparing' | 'ready' | 'installing' | 'updated' | 'error'
  version?: string
  /** Whole percent (0–100) for the downloading/preparing steps. */
  progress?: number
  errorCode?: string
}

type UpdateCheck = {
  version: string
  date?: string
  notes?: string
}

type UpdateDownloadProgress = {
  channel: 'stable' | 'beta'
  downloadedBytes: number
  totalBytes?: number
  progress?: number
  finished: boolean
}

/** Steps that own the capsule until the user answers them; a background
 * check must not replace an update already on offer or installed. */
const SESSION_STATES: ReadonlySet<UpdateStatus['state']> = new Set(['downloading', 'preparing', 'ready', 'installing', 'updated'])

export function useUpdater(channel: 'stable' | 'beta', autoCheck: boolean, onChecked?: (timestamp: number) => void) {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const statusRef = useRef(status)
  const checkInFlightRef = useRef(false)
  const installInFlightRef = useRef(false)
  const onCheckedRef = useRef(onChecked)
  useEffect(() => {
    onCheckedRef.current = onChecked
  }, [onChecked])
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    return () => {
      checkInFlightRef.current = false
      installInFlightRef.current = false
    }
  }, [])
  useEffect(() => {
    setStatus({ state: 'idle' })
    checkInFlightRef.current = false
    installInFlightRef.current = false
  }, [channel])
  useEffect(() => {
    if (!isTauri()) return
    let active = true
    let unlisten: UnlistenFn | undefined
    void listen<UpdateDownloadProgress>('update-download-progress', (event) => {
      if (!active || event.payload.channel !== channel || !installInFlightRef.current) return
      // The finished callback marks the download complete and the install
      // (extraction) underway — upstream's "Preparing update" step.
      if (event.payload.finished) {
        setStatus((current) => ({ ...current, state: 'preparing', progress: 100 }))
        return
      }
      setStatus((current) => ({
        ...current,
        state: 'downloading',
        progress: event.payload.progress ?? current.progress ?? 0,
      }))
    }).then((cleanup) => {
      if (active) unlisten = cleanup
      else cleanup()
    })
    return () => {
      active = false
      unlisten?.()
    }
  }, [channel])
  const checkNow = useCallback(async () => {
    if (checkInFlightRef.current || installInFlightRef.current) return
    if (SESSION_STATES.has(statusRef.current.state)) return
    if (!isTauri()) {
      setStatus({ state: 'current' })
      return
    }
    checkInFlightRef.current = true
    setStatus({ state: 'checking' })
    try {
      const update = await invoke<UpdateCheck | null>('check_update_channel', { channel })
      setStatus(update ? { state: 'available', version: update.version } : { state: 'current' })
      onCheckedRef.current?.(Date.now())
    } catch (error) {
      const errorCode =
        typeof error === 'string' ? error : typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
      setStatus({ state: 'error', errorCode })
    } finally {
      checkInFlightRef.current = false
    }
  }, [channel])
  // Download and install, then wait for the reader to relaunch — upstream
  // shows "Update installed." with a Relaunch Now button rather than
  // restarting unasked.
  const install = useCallback(async () => {
    if (installInFlightRef.current || statusRef.current.state !== 'available') return
    installInFlightRef.current = true
    const version = statusRef.current.version
    setStatus({ state: 'downloading', version, progress: 0 })
    try {
      await invoke('install_update_channel', { channel })
      setStatus({ state: 'ready', version })
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
      setStatus({ state: 'error', version, errorCode })
      installInFlightRef.current = false
    }
  }, [channel])
  const relaunch = useCallback(async () => {
    if (statusRef.current.state !== 'ready') return
    const version = statusRef.current.version
    setStatus({ state: 'installing', version })
    try {
      const { relaunch: restart } = await import('@tauri-apps/plugin-process')
      await restart()
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
      setStatus({ state: 'error', version, errorCode })
      installInFlightRef.current = false
    }
  }, [])
  const dismiss = useCallback(() => {
    checkInFlightRef.current = false
    installInFlightRef.current = false
    setStatus({ state: 'idle' })
  }, [])
  const showUpdated = useCallback((version: string) => {
    setStatus({ state: 'updated', version })
  }, [])
  useEffect(() => {
    if (!autoCheck) return
    const timer = window.setTimeout(() => {
      void checkNow()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [autoCheck, checkNow])
  return { status, checkNow, install, relaunch, dismiss, showUpdated }
}
