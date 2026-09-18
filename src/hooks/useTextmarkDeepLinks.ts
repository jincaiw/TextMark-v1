import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { useEffect, useRef } from 'react'
import { parseTextmarkFileUrl } from '../lib/deepLink'
import { isTauri } from '../lib/platform'

export function useTextmarkDeepLinks(openPath: (path: string) => Promise<void>, onInvalid: () => void) {
  const handlersRef = useRef({ openPath, onInvalid })
  handlersRef.current = { openPath, onInvalid }

  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    const openUrls = (urls: string[]) => {
      for (const url of urls) {
        const path = parseTextmarkFileUrl(url)
        if (path) void handlersRef.current.openPath(path)
        else handlersRef.current.onInvalid()
      }
    }
    void getCurrent().then((urls) => {
      if (!disposed && urls) openUrls(urls)
    })
    let unlisten: (() => void) | undefined
    void onOpenUrl(openUrls).then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])
}
