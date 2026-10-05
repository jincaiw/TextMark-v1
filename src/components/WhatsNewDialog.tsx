import { X } from 'lucide-react'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { Locale } from '../types'

interface WhatsNewDialogProps {
  locale: Locale
  onClose: () => void
}

export function WhatsNewDialog({ locale, onClose }: WhatsNewDialogProps) {
  const backdropRef = useDialogAccessibility(true, onClose)
  const isChinese = locale === 'zh-CN'

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
            <h2 id="whats-new-title">{isChinese ? 'TextMark 更新内容' : "What's New in TextMark"}</h2>
            <p>{isChinese ? '编辑模式所见即所得体验优化' : 'A more WYSIWYG Edit Mode'}</p>
          </div>
          <button type="button" aria-label={isChinese ? '关闭' : 'Close'} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <ul>
          <li>
            <strong>{isChinese ? '格式标记按需显隐' : 'Markdown syntax appears when you edit it'}</strong>
            <span>
              {isChinese
                ? '标题、格式符号、代码围栏和链接目标在阅读内容时收起；光标进入对应源码后再显示。'
                : 'Headings, formatting delimiters, code fences, and link destinations stay out of the way until the caret enters their source.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '复杂 Markdown 区块更贴近成稿' : 'Markdown blocks look closer to the final document'}</strong>
            <span>
              {isChinese
                ? '改进嵌套列表、引用、提示块、代码块、定义列表和段落留白；点击渲染区可回到对应源码。'
                : 'Nested lists, quotes, alerts, code blocks, definition lists, and paragraph spacing are refined; clicking a rendered block returns to its source.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '表格与转义字符编辑更自然' : 'Tables and escaped punctuation edit naturally'}</strong>
            <span>
              {isChinese
                ? '点击表格单元格可定位对应 Markdown 内容；转义标点显示为阅读效果，仍保留原始文稿。'
                : 'Clicking a table cell selects its matching Markdown source; escaped punctuation displays cleanly while the document source stays intact.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '随时重看更新说明' : 'Revisit release highlights'}</strong>
            <span>
              {isChinese ? '可从“帮助 → TextMark 更新内容”重新打开此窗口。' : 'Open this window again from Help → What’s New in TextMark.'}
            </span>
          </li>
        </ul>
        <footer>
          <button type="button" className="primary" onClick={onClose}>
            {isChinese ? '完成' : 'Done'}
          </button>
        </footer>
      </section>
    </div>
  )
}
