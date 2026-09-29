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
            <p>{isChinese ? '编辑体验与桌面操作改进' : 'Improvements to editing and desktop workflows'}</p>
          </div>
          <button type="button" aria-label={isChinese ? '关闭' : 'Close'} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <ul>
          <li>
            <strong>{isChinese ? '目录跳转保留编辑位置' : 'Outline navigation keeps your edit position'}</strong>
            <span>
              {isChinese
                ? '编辑模式下点击目录只滚动到标题，不移动光标，也不打开展示 Markdown 标记的编辑状态。'
                : 'In Edit Mode, selecting an outline heading scrolls to it without moving the caret or revealing Markdown markers.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '阅读和导出保持只读' : 'Read-only task lists in previews and exports'}</strong>
            <span>
              {isChinese
                ? '预览与导出中的任务复选框不能意外修改文稿；文稿搜索路径也会在窄窗口中完整提示。'
                : 'Task checkboxes in previews and exports cannot unexpectedly modify documents; search paths remain discoverable in narrow windows.'}
            </span>
          </li>
          <li>
            <strong>{isChinese ? '中文输入更稳定' : 'More stable CJK input'}</strong>
            <span>
              {isChinese
                ? '在标题中使用中文输入法时，组合输入期间会保持 Markdown 标题标记稳定显示。'
                : 'Markdown heading markers stay stable while composing text with a Chinese or Japanese input method.'}
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
