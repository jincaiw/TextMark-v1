import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri } from '../lib/platform'

export type UpdateStatus = {
  state: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'error'
  version?: string
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
      if (!active || event.payload.channel !== channel) return
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
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
      setStatus({ state: 'error', errorCode })
    } finally {
      checkInFlightRef.current = false
    }
  }, [channel])
  const install = useCallback(async () => {
    if (installInFlightRef.current || statusRef.current.state !== 'available') return
    installInFlightRef.current = true
    const version = statusRef.current.version
    setStatus({ state: 'downloading', version, progress: 0 })
    try {
      await invoke('install_update_channel', { channel })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
      setStatus({ state: 'error', version, errorCode })
      installInFlightRef.current = false
    }
  }, [channel])
  useEffect(() => {
    if (!autoCheck) return
    const timer = window.setTimeout(() => {
      void checkNow()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [autoCheck, checkNow])
  return { status, checkNow, install }
}
