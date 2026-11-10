import { useEffect, type ReactNode } from 'react'
import { ArrowDownToLine, CheckCircle2, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { t, type TranslationKey } from '../lib/i18n'
import type { UpdateStatus } from '../hooks/useUpdater'
import type { Locale } from '../types'

/** Upstream's up-to-date capsule has nothing to act on and goes away by
 * itself after four seconds. */
const UP_TO_DATE_HIDE_MS = 4000

/** The download/preparing ring: a faint track with an accent arc that grows
 * with the fraction (UpdatePill.ProgressRing). */
function ProgressRing({ fraction }: { fraction: number }) {
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0.02, Math.min(1, fraction))
  return (
    <svg className="update-pill-ring" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <circle className="update-pill-ring-track" cx="9" cy="9" r={radius} />
      <circle
        className="update-pill-ring-value"
        cx="9"
        cy="9"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
      />
    </svg>
  )
}

function Spinner() {
  return <LoaderCircle className="update-pill-spinner" aria-hidden="true" />
}

/** The update capsule at the bottom trailing corner of the document window
 * (upstream UpdatePill): an icon, one short line, an optional percent, and at
 * most one action plus a close button. It replaces the About-pane update UI
 * as the place an update shows. */
export function UpdatePill({
  status,
  locale,
  onDownload,
  onRelaunch,
  onWhatsNew,
  onClose,
}: {
  status: UpdateStatus
  locale: Locale
  onDownload: () => void
  onRelaunch: () => void
  onWhatsNew: () => void
  onClose: () => void
}) {
  const { state } = status
  useEffect(() => {
    if (state !== 'current') return
    const timer = window.setTimeout(onClose, UP_TO_DATE_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [state, onClose])
  if (state === 'idle') return null

  let titleKey: TranslationKey
  let tint: 'accent' | 'positive' | 'failed' | null = null
  let action: { label: TranslationKey; onClick: () => void } | null = null
  let showsClose = false
  let fraction: number | null = null
  let icon: ReactNode
  switch (state) {
    case 'checking':
      titleKey = 'updateChecking'
      icon = <Spinner />
      break
    case 'available':
      titleKey = 'updateAvailablePill'
      tint = 'accent'
      icon = <ArrowDownToLine aria-hidden="true" />
      action = { label: 'download', onClick: onDownload }
      showsClose = true
      break
    case 'downloading':
      titleKey = 'updateDownloading'
      fraction = status.progress == null ? null : status.progress / 100
      icon = fraction == null ? <Spinner /> : <ProgressRing fraction={fraction} />
      showsClose = true
      break
    case 'preparing':
      titleKey = 'updatePreparing'
      fraction = (status.progress ?? 100) / 100
      icon = <ProgressRing fraction={fraction} />
      break
    case 'ready':
      titleKey = 'updateInstalled'
      tint = 'positive'
      icon = <CheckCircle2 aria-hidden="true" />
      action = { label: 'relaunchNow', onClick: onRelaunch }
      showsClose = true
      break
    case 'installing':
      titleKey = 'updateInstalling'
      icon = <Spinner />
      break
    case 'current':
      titleKey = 'updateUpToDate'
      icon = <CheckCircle2 aria-hidden="true" />
      showsClose = true
      break
    case 'updated':
      titleKey = 'updatedTo'
      tint = 'positive'
      icon = <CheckCircle2 aria-hidden="true" />
      action = { label: 'whatsNew', onClick: onWhatsNew }
      break
    case 'error':
      titleKey = 'updateFailed'
      tint = 'failed'
      icon = <TriangleAlert aria-hidden="true" />
      showsClose = true
      break
  }
  const title = state === 'updated' ? t(locale, titleKey, { version: status.version ?? '' }) : t(locale, titleKey)
  // The capsule's tooltip: the version on offer, or the failure reason.
  const detail =
    state === 'error' ? t(locale, 'updateError') : status.version ? t(locale, 'versionLabel', { version: status.version }) : undefined
  return (
    <div className="update-pill" data-phase={state} data-tint={tint ?? undefined} role="status" title={detail}>
      <span className="update-pill-icon">{icon}</span>
      <span className="update-pill-title" aria-live="polite">
        {title}
      </span>
      {fraction == null ? null : <span className="update-pill-percent">{Math.round(fraction * 100)}%</span>}
      {action || showsClose ? (
        <span className="update-pill-buttons">
          {action ? (
            <button type="button" className="update-pill-action" onClick={action.onClick}>
              {t(locale, action.label)}
            </button>
          ) : null}
          {showsClose ? (
            <button
              type="button"
              className="update-pill-close"
              aria-label={t(locale, 'close')}
              title={t(locale, 'close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
