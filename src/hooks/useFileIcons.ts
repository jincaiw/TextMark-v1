import { useCallback, useRef, useState } from 'react'
import { fileIconDataUrl } from '../lib/platform'

/** Finder-icon data URLs keyed by path, loaded on demand. Mirrors the
 * upstream navigator's NSWorkspace.icon(forFile:) rows: menus request an
 * icon when they render, and the cache keeps repeat renders instant.
 * `size` is the icon's point size; the titlebar's default-editor tile draws
 * its icon at 20pt rather than the menus' 16, so the toolbar asks for the
 * larger raster and the menu rows downscale the same image. */
export function useFileIcons(size = 16) {
  const [icons, setIcons] = useState<Record<string, string>>({})
  // Paths with an in-flight request; prevents duplicate invokes without the
  // placeholder that would defeat the resolved-value guard below.
  const requested = useRef(new Set<string>())
  const requestIcon = useCallback(
    (path: string) => {
      if (requested.current.has(path)) return
      requested.current.add(path)
      void fileIconDataUrl(path, size)
        .then((url) => {
          setIcons((latest) => (latest[path] === undefined ? { ...latest, [path]: url } : latest))
        })
        .catch(() => {
          setIcons((latest) => (latest[path] === undefined ? { ...latest, [path]: '' } : latest))
        })
    },
    [size],
  )
  return { icons, requestIcon }
}
