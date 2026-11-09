import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import { isTauri } from '../lib/platform'
import { RELEASES_WEB_URL, fetchReleases, parseReleaseEntry, releaseTitle, releasesAfter, type Release } from '../lib/releaseNotes'
import type { Locale } from '../types'

interface WhatsNewDialogProps {
  locale: Locale
  /** The version the reader updated from; the empty string means unknown,
   * which offers the running version's notes alone, as upstream does. */
  previousVersion?: string
  currentVersion?: string
  onClose: () => void
}

/** Fallback highlights for offline readers and repos without matching
 * releases: the static content the dialog shipped with, keyed to the
 * current release's headline. */
const FALLBACK = {
  subtitle: { 'zh-CN': '编辑模式所见即所得体验优化', en: 'A more WYSIWYG Edit Mode' },
  items: [
    {
      title: { 'zh-CN': '格式标记按需显隐', en: 'Markdown syntax appears when you edit it' },
      text: {
        'zh-CN': '标题、格式符号、代码围栏和链接目标在阅读内容时收起；光标进入对应源码后再显示。',
        en: 'Headings, formatting delimiters, code fences, and link destinations stay out of the way until the caret enters their source.',
      },
    },
    {
      title: { 'zh-CN': '复杂 Markdown 区块更贴近成稿', en: 'Markdown blocks look closer to the final document' },
      text: {
        'zh-CN': '改进嵌套列表、引用、提示块、代码块、定义列表和段落留白；点击渲染区可回到对应源码。',
        en: 'Nested lists, quotes, alerts, code blocks, definition lists, and paragraph spacing are refined; clicking a rendered block returns to its source.',
      },
    },
    {
      title: { 'zh-CN': '表格与转义字符编辑更自然', en: 'Tables and escaped punctuation edit naturally' },
      text: {
        'zh-CN': '点击表格单元格可定位对应 Markdown 内容；转义标点显示为阅读效果，仍保留原始文稿。',
        en: 'Clicking a table cell selects its matching Markdown source; escaped punctuation displays cleanly while the document source stays intact.',
      },
    },
    {
      title: { 'zh-CN': '随时重看更新说明', en: 'Revisit release highlights' },
      text: {
        'zh-CN': '可从“帮助 → TextMark 更新内容”重新打开此窗口。',
        en: 'Open this window again from Help → What’s New in TextMark.',
      },
    },
  ],
}

const DATE_LOCALE = { 'zh-CN': 'zh-CN', en: 'en-US' } as const

function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(DATE_LOCALE[locale], { year: 'numeric', month: 'long', day: 'numeric' })
}

export function WhatsNewDialog({
  locale,
  previousVersion = '',
  currentVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
  onClose,
}: WhatsNewDialogProps) {
  const backdropRef = useDialogAccessibility(true, onClose)
  const isChinese = locale === 'zh-CN'
  const [releases, setReleases] = useState<Release[] | null>(null)

  // Download the releases while the dialog shows, like the capsule's
  // background download upstream; a failure keeps the fallback content.
  useEffect(() => {
    let active = true
    void fetchReleases()
      .then((next) => {
        if (active) setReleases(next)
      })
      // Offline or rate limited: stop loading and show the built-in
      // highlights, with the Previous releases link for the full list.
      .catch(() => {
        if (active) setReleases([])
      })
    return () => {
      active = false
    }
  }, [])

  const shown = releases ? releasesAfter(releases, previousVersion, currentVersion) : null
  const showFallback = shown !== null && shown.length === 0

  const openReleases = () => {
    if (isTauri()) void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(RELEASES_WEB_URL))
    else window.open(RELEASES_WEB_URL, '_blank', 'noopener')
  }

  return (
    <div
      className="dialog-backdrop whats-new-backdrop"
      role="presentation"
      ref={backdropRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="conflict-dialog whats-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="whats-new-title">{isChinese ? `TextMark ${currentVersion} 更新内容` : `What's New in TextMark ${currentVersion}`}</h2>
            <p>{shown && shown.length > 0 ? '' : FALLBACK.subtitle[locale]}</p>
          </div>
          <button type="button" aria-label={isChinese ? '关闭' : 'Close'} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {showFallback ? (
          <ul>
            {FALLBACK.items.map((item) => (
              <li key={item.title.en}>
                <strong>{item.title[locale]}</strong>
                <span>{item.text[locale]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="whats-new-releases">
            {(shown ?? []).map((release) => {
              const entry = parseReleaseEntry(release.body)
              return (
                <section key={release.version} className="whats-new-release">
                  <h3>{releaseTitle(release, entry)}</h3>
                  <p className="whats-new-release-meta">
                    <code>v{release.version}</code>
                    {formatDate(release.date, locale) ? <span>{formatDate(release.date, locale)}</span> : null}
                  </p>
                  {entry.intro ? <p className="whats-new-release-intro">{entry.intro}</p> : null}
                  {entry.items.length > 0 ? (
                    <ul>
                      {entry.items.map((item, index) => (
                        <li key={index}>
                          {item.title ? <strong>{item.title}</strong> : null}
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )
            })}
            {shown === null ? <p className="whats-new-loading">{isChinese ? '正在获取更新说明…' : 'Loading release notes…'}</p> : null}
          </div>
        )}
        <footer>
          <button type="button" className="secondary" onClick={openReleases}>
            <ExternalLink size={14} />
            {isChinese ? '往期版本' : 'Previous releases'}
          </button>
          <button type="button" className="primary" onClick={onClose}>
            {isChinese ? '完成' : 'Done'}
          </button>
        </footer>
      </section>
    </div>
  )
}
