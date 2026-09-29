import { renderMarkdownEnhancedUnsafe } from '../lib/markdown'

self.addEventListener(
  'message',
  async (event: MessageEvent<{ id: number; source: string; locale?: 'zh-CN' | 'en'; strictLineBreaks?: boolean }>) => {
    const { id, source, locale, strictLineBreaks } = event.data
    try {
      self.postMessage({ id, result: await renderMarkdownEnhancedUnsafe(source, locale, strictLineBreaks) })
    } catch {
      self.postMessage({ id, error: 'render_failed' })
    }
  },
)
