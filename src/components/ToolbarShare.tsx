import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Clipboard, FileDown, FileText, Printer, Share } from 'lucide-react'
import { t } from '../lib/i18n'
import type { Locale } from '../types'

export interface ToolbarShareProps {
  locale: Locale
  documentName: string
  wordCount: number
  sizeBytes: number
  onShare: () => void
  onCopy: () => void
  onPrint: () => void
  onExport: () => void
  /** Extra classes for the trigger button so it matches its toolbar slot. */
  triggerClassName?: string
  children: ReactNode
}

const formatBytes = (bytes: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: bytes < 1024 ? 'byte' : 'kilobyte', maximumFractionDigits: 1 }).format(
    bytes < 1024 ? bytes : bytes / 1024,
  )

/** The share popover (upstream NSSharingServicePickerToolbarItem): a header
 * with the document icon, its name and a gray "N words · size" subtitle, then
 * Export and Print rows above the share/copy services. */
export function ToolbarShare(props: ToolbarShareProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const tx = (key: Parameters<typeof t>[1]) => t(props.locale, key)
  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const position = () => {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return
      const anchor = trigger.getBoundingClientRect()
      const panelWidth = panel.getBoundingClientRect().width
      const left = Math.max(8, Math.min(anchor.right - panelWidth, window.innerWidth - panelWidth - 8))
      panel.style.left = `${left - anchor.left}px`
    }
    const outside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    position()
    window.addEventListener('resize', position)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', position)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const run = (action: () => void) => {
    close()
    action()
  }
  const wordsKey = props.wordCount === 1 ? 'wordCountLabelSingular' : 'wordCountLabel'
  const subtitle = `${t(props.locale, wordsKey, { count: props.wordCount })} · ${formatBytes(props.sizeBytes, props.locale)}`
  return (
    <div className="toolbar-group share-popover-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={props.triggerClassName}
        title={tx('shareSource')}
        aria-label={tx('shareSource')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {props.children}
      </button>
      {open ? (
        <div className="share-popover" ref={panelRef} role="dialog" aria-label={tx('shareDocument')}>
          <div className="share-header">
            <span className="share-header-icon">
              <FileText />
            </span>
            <span className="share-header-text">
              <strong>{props.documentName}</strong>
              <span className="share-header-subtitle">{subtitle}</span>
            </span>
          </div>
          <div className="share-section">
            <button type="button" className="share-row" onClick={() => run(props.onExport)}>
              <FileDown />
              {tx('exportItem')}
            </button>
            <button type="button" className="share-row" onClick={() => run(props.onPrint)}>
              <Printer />
              {tx('printItem')}
            </button>
          </div>
          <div className="share-section">
            <button type="button" className="share-row" onClick={() => run(props.onShare)}>
              <Share />
              {tx('share')}
            </button>
            <button type="button" className="share-row" onClick={() => run(props.onCopy)}>
              <Clipboard />
              {tx('copySource')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
