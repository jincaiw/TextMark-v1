import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../lib/platform'

export type UpdateStatus = {
  state: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'error'
  version?: string
  progress?: number
}

export function useUpdater(channel: 'stable' | 'beta') {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const checkNow = useCallback(async () => {
    if (!isTauri()) {
      setStatus({ state: 'current' })
      return
    }
    setStatus({ state: 'checking' })
    try {
      const update = await invoke<{ version: string } | null>('check_update_channel', { channel })
      setStatus(update ? { state: 'available', version: update.version } : { state: 'current' })
    } catch {
      setStatus({ state: 'error' })
    }
  }, [channel])
  const install = useCallback(async () => {
    if (status.state !== 'available') return
    setStatus({ state: 'downloading', version: status.version, progress: 0 })
    try {
      await invoke('install_update_channel', { channel })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      setStatus({ state: 'error' })
    }
  }, [channel, status.state, status.version])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkNow()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [checkNow])
  return { status, checkNow, install }
}
