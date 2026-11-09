import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './platform'
import type { DocumentFont, Locale, ThemeColors, ThemePreset } from '../types'

export interface TableWindowAppearance {
  documentFont?: DocumentFont
  themePreset?: ThemePreset
  themeColors?: ThemeColors
}

/**
 * Opens a read-only snapshot of one table in its own window, matching upstream's
 * Expand Table affordance. The window lays the table out at its natural column
 * widths, so the document's own (possibly resized) widths are dropped, and the
 * page is handed to `table.html` through the same localStorage bridge the other
 * auxiliary windows use.
 */
export function openTableWindow(
  table: HTMLTableElement,
  locale: Locale,
  title: string | undefined,
  appearance: TableWindowAppearance,
): void {
  if (!isTauri()) return
  const clone = table.cloneNode(true) as HTMLTableElement
  clone.querySelectorAll('[data-table-column]').forEach((header) => {
    header.removeAttribute('data-table-column')
    header.removeAttribute('data-placeholder')
  })
  const id = `table-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(
    `textmark.${id}`,
    JSON.stringify({
      source: clone.outerHTML,
      documentFont: appearance.documentFont,
      themePreset: appearance.themePreset,
      themeColors: appearance.themeColors,
    }),
  )
  void invoke('open_table_window', { id, locale, title: title ?? '' }).catch(() => {
    localStorage.removeItem(`textmark.${id}`)
  })
}
