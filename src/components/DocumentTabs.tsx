import { X } from 'lucide-react'
import { t } from '../lib/i18n'
import type { DocumentSession, Locale } from '../types'

export function DocumentTabs({
  sessions,
  activeId,
  locale,
  onActivate,
  onClose,
}: {
  sessions: DocumentSession[]
  activeId: string
  locale: Locale
  onActivate: (id: string) => void
  onClose: (id: string) => void
}) {
  if (sessions.length < 2) return null
  const moveTo = (index: number) => {
    const target = (index + sessions.length) % sessions.length
    onActivate(sessions[target].id)
  }
  return (
    <div className="document-tabs" role="tablist" aria-label="Documents">
      {sessions.map((session, index) => (
        <div
          key={session.id}
          className={`document-tab ${session.id === activeId ? 'active' : ''}`}
          role="tab"
          aria-selected={session.id === activeId}
          tabIndex={session.id === activeId ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') moveTo(index + 1)
            else if (event.key === 'ArrowLeft') moveTo(index - 1)
            else if (event.key === 'Home') moveTo(0)
            else if (event.key === 'End') moveTo(sessions.length - 1)
            else if (event.key === 'Enter' || event.key === ' ') onActivate(session.id)
            else if (event.key === 'Delete' || event.key === 'Backspace') onClose(session.id)
            else return
            event.preventDefault()
          }}
        >
          <button className="tab-label" onClick={() => onActivate(session.id)} title={session.path ?? session.name}>
            {session.name}
            {session.dirty ? ' •' : ''}
          </button>
          <button className="tab-close" aria-label={`${t(locale, 'closeTab')} ${session.name}`} onClick={() => onClose(session.id)}>
            <X />
          </button>
        </div>
      ))}
    </div>
  )
}
