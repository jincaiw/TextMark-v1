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
  return (
    <div className="document-tabs" role="tablist" aria-label="Documents">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`document-tab ${session.id === activeId ? 'active' : ''}`}
          role="tab"
          aria-selected={session.id === activeId}
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
