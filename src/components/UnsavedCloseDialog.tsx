import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { t } from '../lib/i18n'
import type { Locale } from '../types'

/** Native window-close guard. `window.confirm` can only offer discard/cancel,
 * so a dirty document had no way to be saved from the close prompt. */
export function UnsavedCloseDialog({
  locale,
  dirtyCount,
  canSaveAll,
  onSave,
  onDiscard,
  onCancel,
}: {
  locale: Locale
  dirtyCount: number
  canSaveAll: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  const backdropRef = useDialogAccessibility(true, onCancel)
  return (
    <div className="dialog-backdrop" role="presentation" ref={backdropRef}>
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="conflict-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-close-title"
        aria-describedby="unsaved-close-body"
      >
        <h2 id="unsaved-close-title">{t(locale, 'unsavedCloseTitle')}</h2>
        <p id="unsaved-close-body">
          {dirtyCount > 1 ? `${t(locale, 'unsavedCloseCount', { count: dirtyCount })} ` : ''}
          {t(locale, 'unsavedCloseBody')}
          {canSaveAll ? '' : ` ${t(locale, 'unsavedCloseNeedsPath')}`}
        </p>
        <div>
          <button onClick={onCancel}>{t(locale, 'cancel')}</button>
          <button onClick={onDiscard} className="destructive">
            {t(locale, 'discardChanges')}
          </button>
          <button onClick={onSave} disabled={!canSaveAll} title={canSaveAll ? undefined : t(locale, 'unsavedCloseNeedsPath')}>
            {t(locale, 'saveAndClose')}
          </button>
        </div>
      </section>
    </div>
  )
}
