import { useEffect, useState } from 'react'
import type { ThemeMode } from '../types'

/**
 * Single source of truth for the effective appearance. The resolved mode is
 * derived from the persisted `AppSettings.theme` (controlled from the parent),
 * applied to `document.documentElement.dataset.theme`, and re-evaluated when
 * the OS appearance changes while in "system" mode.
 */
export function useTheme(theme: ThemeMode) {
  const [resolved, setResolved] = useState<'dark' | 'light'>(() =>
    theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const value = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = value
      setResolved(value)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return resolved
}
