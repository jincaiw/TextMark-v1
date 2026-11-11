// The floating format controls shown while editing, replicating upstream
// markdown-preview's macOS 26 glass cluster (DocumentWindowController+
// FormattingBar.swift): five independently-shaped capsules pinned to the
// editor's top-trailing edge — Text Style, Emphasis (B/I/S), Link, Lists, and
// More Formatting — each disclosure opening a transient popover. The bar is a
// click-through overlay: only the capsules take pointer events, so the document
// stays editable everywhere else. Selection state feeds the pills live (the
// heading label, the B/I/S/link tint) the way updateFormattingSelection does.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignLeft,
  Bold,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Plus,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
} from 'lucide-react'
import { t } from '../lib/i18n'
import type { Locale } from '../types'
import type { FormatCommand } from '../types'
import type { BlockStyle, LinkSelection, ListStyle } from '../lib/formatState'
import {
  allLanguages,
  commonLanguages,
  matchingLanguages,
  recentLanguages,
  rememberLanguage,
  type CodeLanguageOption,
} from '../lib/codeLanguages'

interface FloatingFormatBarProps {
  locale: Locale
  /** Heading level of the selection (0 = body); drives the Text Style label. */
  heading: number
  /** Active marks under the selection; tints the emphasis and link pills. */
  commands: string[]
  onFormat: (command: FormatCommand) => void
  /** Apply a block style from the More Formatting popover. */
  onBlockStyle: (style: BlockStyle, language?: string) => void
  /** Apply a list style from the Lists popover. */
  onListStyle: (style: Exclude<ListStyle, 'mixed'>) => void
  /** Insert a link over the current link selection. */
  onLink: (text: string, url: string) => void
  /** Read the caret's block style when a popover opens. */
  getBlockStyle: () => BlockStyle | null
  /** Read the selected lines' list style when a popover opens. */
  getListStyle: () => ListStyle | null
  /** Read the range/text the link form edits. */
  getLinkSelection: () => LinkSelection | null
}

type PopoverKind = 'heading' | 'list' | 'styling' | 'language' | 'link' | null

/** A transient popover anchored below its button, right-aligned to the button
 * edge (upstream NSPopover .maxY). Dismisses on outside click and Escape. */
function Popover(props: { anchorRef: React.RefObject<HTMLElement | null>; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const anchor = props.anchorRef.current
    const panel = ref.current
    if (!anchor || !panel) return
    const a = anchor.getBoundingClientRect()
    // Keep the panel inside the window; it hangs from the button's trailing
    // edge, the way the transient NSPopover (.maxY) sits under its pill.
    const right = Math.max(8, Math.min(a.right, window.innerWidth - 8))
    setStyle({ position: 'fixed', top: a.bottom + 6, right: window.innerWidth - right, visibility: 'visible' })
  }, [props.anchorRef])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node) || props.anchorRef.current?.contains(event.target as Node)) return
      props.onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        props.onClose()
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', key, true)
    }
  }, [props])
  return (
    <div ref={ref} className={`ffb-popover${props.wide ? ' is-wide' : ''}`} style={style} role="dialog">
      {props.children}
    </div>
  )
}

function PopoverRow(props: { selected: boolean; icon: ReactNode; label: ReactNode; trailing?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="ffb-row" onClick={props.onClick} aria-pressed={props.selected}>
      <span className="ffb-check">{props.selected ? <Check aria-hidden="true" /> : null}</span>
      <span className="ffb-row-icon">{props.icon}</span>
      <span className="ffb-row-label">{props.label}</span>
      <span className="ffb-row-trailing">{props.trailing}</span>
    </button>
  )
}

const HEADING_SIZES = [13, 22, 20, 17, 15, 13, 12]

function HeadingPopover(props: { selected: number; onSelect: (level: number) => void; locale: Locale }) {
  return (
    <>
      <div className="ffb-popover-title">{t(props.locale, 'format')}</div>
      {[0, 1, 2, 3, 4, 5, 6].map((level) => (
        <button
          key={level}
          type="button"
          className="ffb-row ffb-heading-row"
          style={{ height: level === 1 ? 32 : 26 }}
          onClick={() => props.onSelect(level)}
          aria-pressed={props.selected === level}
        >
          <span className="ffb-check">{props.selected === level ? <Check aria-hidden="true" /> : null}</span>
          <span className="ffb-row-label" style={{ fontSize: HEADING_SIZES[level], fontWeight: level === 0 ? 400 : 700 }}>
            {level === 0 ? t(props.locale, 'body') : t(props.locale, `heading${level}` as 'heading1')}
          </span>
        </button>
      ))}
    </>
  )
}

function ListPopover(props: { selected: string; onSelect: (style: Exclude<ListStyle, 'mixed'>) => void; locale: Locale }) {
  const rows: Array<{ id: Exclude<ListStyle, 'mixed'>; label: string; icon: ReactNode }> = [
    { id: 'none', label: t(props.locale, 'none'), icon: <Pilcrow aria-hidden="true" /> },
    { id: 'bullet', label: t(props.locale, 'bulletedList'), icon: <List aria-hidden="true" /> },
    { id: 'ordered', label: t(props.locale, 'numberedList'), icon: <ListOrdered aria-hidden="true" /> },
    { id: 'task', label: t(props.locale, 'taskList'), icon: <ListChecks aria-hidden="true" /> },
  ]
  return (
    <>
      <div className="ffb-popover-title">{t(props.locale, 'listPopover')}</div>
      {rows.map((row) => (
        <PopoverRow
          key={row.id}
          selected={props.selected === row.id}
          icon={row.icon}
          label={row.label}
          onClick={() => props.onSelect(row.id)}
        />
      ))}
    </>
  )
}

function StylingPopover(props: {
  selected: string
  onSelect: (style: BlockStyle, language?: string) => void
  onOpenLanguages: () => void
  locale: Locale
}) {
  const rows: Array<{ id: BlockStyle; label: string; icon: ReactNode; chevron?: boolean }> = [
    { id: 'none', label: t(props.locale, 'none'), icon: <Pilcrow aria-hidden="true" /> },
    { id: 'quote', label: t(props.locale, 'blockquote'), icon: <Quote aria-hidden="true" /> },
    { id: 'code', label: t(props.locale, 'code'), icon: <Braces aria-hidden="true" /> },
    { id: 'plain', label: t(props.locale, 'plainTextBlock'), icon: <AlignLeft aria-hidden="true" /> },
    { id: 'fenced', label: t(props.locale, 'codeBlock'), icon: <SquareCode aria-hidden="true" />, chevron: true },
    { id: 'table', label: t(props.locale, 'table'), icon: <Table aria-hidden="true" /> },
  ]
  return (
    <>
      <div className="ffb-popover-title">{t(props.locale, 'styling')}</div>
      {rows.map((row) => (
        <PopoverRow
          key={row.id}
          selected={props.selected === row.id}
          icon={row.icon}
          label={row.label}
          trailing={row.chevron ? <ChevronRight aria-hidden="true" /> : undefined}
          onClick={() => (row.id === 'fenced' ? props.onOpenLanguages() : props.onSelect(row.id))}
        />
      ))}
    </>
  )
}

function LanguagePopover(props: { onSelect: (id: string) => void; locale: Locale }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const blank = query.trim() === ''
  const recent = recentLanguages()
  const select = (id: string) => {
    rememberLanguage(id)
    props.onSelect(id)
  }
  const section = (title: string, languages: CodeLanguageOption[], key: string) =>
    languages.length ? (
      <div className="ffb-lang-section" key={key}>
        <div className="ffb-lang-title">{title}</div>
        {languages.map((language) => (
          <button type="button" key={language.id} className="ffb-lang-row" onClick={() => select(language.id)}>
            <span className="ffb-lang-glyph">{language.id === 'swift' ? 'Sw' : language.glyph}</span>
            <span className="ffb-lang-name">{language.name}</span>
          </button>
        ))}
      </div>
    ) : null
  const matches = matchingLanguages(query)
  return (
    <div className="ffb-language">
      <div className="ffb-lang-filter">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={t(props.locale, 'filter')}
          aria-label="Filter code languages"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.trim() && matches[0]) select(matches[0].id)
          }}
        />
      </div>
      <div className="ffb-lang-scroll">
        {blank ? (
          <>
            {section(t(props.locale, 'recent'), recent, 'recent')}
            {section(t(props.locale, 'common'), commonLanguages, 'common')}
            {section(t(props.locale, 'allLanguages'), allLanguages, 'all')}
          </>
        ) : matches.length ? (
          section(t(props.locale, 'allLanguages'), matches, 'filter')
        ) : (
          <div className="ffb-lang-empty">{t(props.locale, 'noMatchingLanguages')}</div>
        )}
      </div>
    </div>
  )
}

function LinkPopover(props: { initialText: string; onSave: (text: string, url: string) => void; onCancel: () => void; locale: Locale }) {
  const [text, setText] = useState(props.initialText)
  const [url, setUrl] = useState('')
  const textRef = useRef<HTMLInputElement>(null)
  // Upstream focuses the Text field on appear (textFocused = true); the URL
  // field is reached with Tab.
  useEffect(() => textRef.current?.focus(), [])
  const destination = url.trim()
  const canSave = destination !== '' && !/[\r\n]/.test(destination)
  return (
    <div className="ffb-link-form">
      <div className="ffb-popover-title">{t(props.locale, 'link')}</div>
      <label className="ffb-link-row">
        <span className="ffb-link-label">Text:</span>
        <input
          ref={textRef}
          className="ffb-link-input"
          type="text"
          value={text}
          placeholder={t(props.locale, 'displayTextOptional')}
          aria-label="Display text"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSave) props.onSave(text, destination)
          }}
        />
      </label>
      <label className="ffb-link-row">
        <span className="ffb-link-label">URL:</span>
        <input
          className="ffb-link-input"
          type="text"
          value={url}
          placeholder="https://example.com"
          aria-label="URL"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSave) props.onSave(text, destination)
          }}
        />
      </label>
      <div className="ffb-link-actions">
        <button type="button" onClick={props.onCancel}>
          {t(props.locale, 'cancel')}
        </button>
        <button type="button" className="ffb-primary" disabled={!canSave} onClick={() => props.onSave(text, destination)}>
          {t(props.locale, 'save')}
        </button>
      </div>
    </div>
  )
}

export function FloatingFormatBar(props: FloatingFormatBarProps) {
  const { locale, heading, commands } = props
  const [popover, setPopover] = useState<PopoverKind>(null)
  const headingRef = useRef<HTMLButtonElement>(null)
  const listsRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const linkRef = useRef<HTMLButtonElement>(null)
  const [blockStyleValue, setBlockStyleValue] = useState<BlockStyle>('none')
  const [listStyleValue, setListStyleValue] = useState<ListStyle>('none')
  const [linkInitial, setLinkInitial] = useState('')

  const toggle = useCallback((kind: PopoverKind, read?: () => void) => {
    setPopover((current) => {
      if (current === kind) return null
      read?.()
      return kind
    })
  }, [])

  const emphasis = (command: 'bold' | 'italic' | 'strikethrough', Icon: typeof Bold, label: string) => (
    <button
      type="button"
      className={`ffb-btn${commands.includes(command) ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={commands.includes(command)}
      onClick={() => props.onFormat(command)}
    >
      <Icon aria-hidden="true" />
    </button>
  )

  const headingLabel = heading === 0 ? t(locale, 'body') : t(locale, `heading${heading}` as 'heading1')

  return (
    <div className="floating-format-bar">
      <div className="ffb-groups">
        <div className="ffb-group">
          <button
            ref={headingRef}
            type="button"
            className="ffb-btn ffb-menu-btn"
            title={t(locale, 'textStyle')}
            aria-label={t(locale, 'textStyle')}
            aria-haspopup="menu"
            aria-expanded={popover === 'heading'}
            onClick={() => toggle('heading')}
          >
            <span className="ffb-menu-label">{headingLabel}</span>
            <ChevronDown className="ffb-chevron" aria-hidden="true" />
          </button>
        </div>
        <div className="ffb-group">
          {emphasis('bold', Bold, t(locale, 'bold'))}
          {emphasis('italic', Italic, t(locale, 'italic'))}
          {emphasis('strikethrough', Strikethrough, t(locale, 'strikethrough'))}
        </div>
        <div className="ffb-group">
          <button
            ref={linkRef}
            type="button"
            className={`ffb-btn ffb-btn-link${commands.includes('link') ? ' is-active' : ''}`}
            title={t(locale, 'link')}
            aria-label={t(locale, 'link')}
            aria-haspopup="dialog"
            aria-expanded={popover === 'link'}
            onClick={() =>
              toggle('link', () => {
                const selection = props.getLinkSelection()
                setLinkInitial(selection?.text ?? '')
              })
            }
          >
            <LinkIcon aria-hidden="true" />
          </button>
        </div>
        <div className="ffb-group">
          <button
            ref={listsRef}
            type="button"
            className="ffb-btn ffb-menu-btn ffb-btn-lists"
            title={t(locale, 'lists')}
            aria-label={t(locale, 'lists')}
            aria-haspopup="menu"
            aria-expanded={popover === 'list'}
            onClick={() =>
              toggle('list', () => {
                setListStyleValue(props.getListStyle() ?? 'none')
              })
            }
          >
            <List aria-hidden="true" />
            <ChevronDown className="ffb-chevron" aria-hidden="true" />
          </button>
        </div>
        <div className="ffb-group">
          <button
            ref={moreRef}
            type="button"
            className="ffb-btn ffb-menu-btn ffb-btn-more"
            title={t(locale, 'moreFormatting')}
            aria-label={t(locale, 'moreFormatting')}
            aria-haspopup="menu"
            aria-expanded={popover === 'styling' || popover === 'language'}
            onClick={() =>
              toggle('styling', () => {
                setBlockStyleValue(props.getBlockStyle() ?? 'none')
              })
            }
          >
            <Plus aria-hidden="true" />
            <ChevronDown className="ffb-chevron" aria-hidden="true" />
          </button>
        </div>
      </div>
      {popover === 'heading' ? (
        <Popover anchorRef={headingRef} onClose={() => setPopover(null)}>
          <HeadingPopover
            selected={heading}
            locale={locale}
            onSelect={(level) => {
              setPopover(null)
              if (level !== heading) props.onFormat(`h${level}` as FormatCommand)
            }}
          />
        </Popover>
      ) : null}
      {popover === 'list' ? (
        <Popover anchorRef={listsRef} onClose={() => setPopover(null)}>
          <ListPopover
            selected={listStyleValue}
            locale={locale}
            onSelect={(style) => {
              setPopover(null)
              props.onListStyle(style)
            }}
          />
        </Popover>
      ) : null}
      {popover === 'styling' ? (
        <Popover anchorRef={moreRef} onClose={() => setPopover(null)}>
          <StylingPopover
            selected={blockStyleValue}
            locale={locale}
            onSelect={(style) => {
              setPopover(null)
              props.onBlockStyle(style)
            }}
            onOpenLanguages={() => setPopover('language')}
          />
        </Popover>
      ) : null}
      {popover === 'language' ? (
        <Popover anchorRef={moreRef} onClose={() => setPopover(null)} wide>
          <LanguagePopover
            locale={locale}
            onSelect={(id) => {
              setPopover(null)
              props.onBlockStyle('fenced', id)
            }}
          />
        </Popover>
      ) : null}
      {popover === 'link' ? (
        <Popover anchorRef={linkRef} onClose={() => setPopover(null)} wide>
          <LinkPopover
            initialText={linkInitial}
            locale={locale}
            onCancel={() => setPopover(null)}
            onSave={(text, url) => {
              setPopover(null)
              props.onLink(text, url)
            }}
          />
        </Popover>
      ) : null}
    </div>
  )
}
