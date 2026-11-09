import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { UpdateStatus } from '../hooks/useUpdater'
import { t } from '../lib/i18n'
import type { Locale } from '../types'

interface UpdatePillProps {
  status: UpdateStatus
  locale: Locale
  onInstall: () => void
  onCheck: () => void
  onRelaunch: () => void
}

/** Bottom-trailing update capsule mirroring the upstream UpdatePill: a status
 * line with an action button, floating over the document window. The "current"
 * state appears only after a manual check and dismisses itself. */
export function UpdatePill(props: UpdatePillProps) {
  const { status } = props
  const visible = status.state !== 'idle'
  const [dismissed, setDismissed] = useState(false)
  const [pulse, setPulse] = useState(false)
  const currentState = useRef(status.state)
  useEffect(() => {
    if (currentState.current !== status.state) {
      currentState.current = status.state
      setDismissed(false)
      setPulse(true)
      const animation = window.setTimeout(() => setPulse(false), 350)
      return () => window.clearTimeout(animation)
    }
  }, [status.state])
  // The all-clear answer to a manual check fades after four seconds, like the
  // upstream upToDate pill; anything else stays until resolved or dismissed.
  const autoDismiss = status.state === 'current'
  useEffect(() => {
    if (!autoDismiss) return
    const timer = window.setTimeout(() => setDismissed(true), 4000)
    return () => window.clearTimeout(timer)
  }, [autoDismiss])
  if (!visible || dismissed) return null
  let icon = <Loader2 className="spin" aria-hidden />
  let tint = ''
  let title = ''
  let action: { label: string; run: () => void } | null = null
  if (status.state === 'checking') {
    title = t(props.locale, 'updatePillChecking')
  } else if (status.state === 'available') {
    icon = <ArrowDownCircle aria-hidden />
    tint = 'accent'
    title = t(props.locale, 'updatePillAvailable', { version: status.version ?? '' })
    action = { label: t(props.locale, 'updatePillDownload'), run: props.onInstall }
  } else if (status.state === 'downloading') {
    title = `${t(props.locale, 'updatePillDownloading')}${typeof status.progress === 'number' ? ` ${Math.round(status.progress * 100)}%` : '…'}`
  } else if (status.state === 'ready') {
    icon = <ArrowDownCircle aria-hidden />
    tint = 'accent'
    title = t(props.locale, 'updatePillReady')
    action = { label: t(props.locale, 'updatePillRelaunchNow'), run: props.onRelaunch }
  } else if (status.state === 'current') {
    icon = <CheckCircle2 aria-hidden />
    title = t(props.locale, 'updatePillCurrent')
  } else if (status.state === 'error') {
    icon = <AlertTriangle aria-hidden />
    tint = 'warning'
    title = t(props.locale, 'updatePillFailed')
    action = { label: t(props.locale, 'updatePillRetry'), run: props.onCheck }
  }
  return (
    <div
      className={`update-pill ${tint} ${pulse ? 'enter' : ''}`}
      role="status"
      aria-live="polite"
      title={status.version ? `${title} (${status.version})` : title}
    >
      {icon}
      <span className="update-pill-title">{title}</span>
      {action ? (
        <button className="update-pill-action" onClick={action.run}>
          {action.label}
        </button>
      ) : null}
      {status.state !== 'downloading' ? (
        <button className="update-pill-close" aria-label={t(props.locale, 'close')} onClick={() => setDismissed(true)}>
          ×
        </button>
      ) : null}
    </div>
  )
}
