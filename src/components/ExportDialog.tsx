import { FileDown, Image, Printer, X } from 'lucide-react'
import { t } from '../lib/i18n'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { Locale } from '../types'

interface ExportDialogProps {
  open: boolean
  locale: Locale
  onExportHtml: () => void
  onExportPng: () => void
  onExportPdf: () => void
  onClose: () => void
}

export function ExportDialog({ open, locale, onExportHtml, onExportPng, onExportPdf, onClose }: ExportDialogProps) {
  const backdropRef = useDialogAccessibility(open, onClose)
  if (!open) return null
  const item = (icon: React.ReactNode, label: string, hint: string, action: () => void) => (
    <button
      className="export-option"
      onClick={() => {
        action()
        onClose()
      }}
    >
      {icon}
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </button>
  )
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose} ref={backdropRef}>
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="export-title">{t(locale, 'export')}</h2>
          <button onClick={onClose} aria-label={t(locale, 'close')}>
            <X />
          </button>
        </header>
        {item(<Printer />, t(locale, 'exportPdf'), t(locale, 'print'), onExportPdf)}
        {item(<FileDown />, t(locale, 'exportHtml'), '', onExportHtml)}
        {item(<Image />, t(locale, 'exportPng'), '', onExportPng)}
      </section>
    </div>
  )
}
