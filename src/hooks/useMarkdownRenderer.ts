import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import { loadOptionalRendererStyles } from '../lib/optionalStyles'
import type { Locale, RenderedMarkdown } from '../types'

const EMPTY_RENDER: RenderedMarkdown = {
  html: '',
  outline: [],
  hasMermaid: false,
  hasMath: false,
  frontmatter: [],
  sourceMap: [],
  tables: [],
  tasks: [],
  optionalRenderers: [],
  direction: 'auto',
}

/** Keeps Markdown parsing outside the document shell's interaction state. The
 * source is deferred, parsing happens in a Worker, and optional renderers are
 * loaded only when the result requests them. */
export function useMarkdownRenderer(source: string, locale: Locale) {
  const deferredSource = useDeferredValue(source)
  const [rendered, setRendered] = useState<RenderedMarkdown>(EMPTY_RENDER)
  const sequenceRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  const requestsRef = useRef(new Map<number, { source: string; locale: Locale }>())

  useEffect(() => {
    if (typeof Worker === 'undefined') return
    const worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), { type: 'module', name: 'textmark-renderer' })
    workerRef.current = worker
    const renderInMain = (id: number) => {
      const request = requestsRef.current.get(id)
      if (!request) return
      void import('../lib/markdown').then(async ({ renderMarkdownEnhanced }) => {
        const result = await renderMarkdownEnhanced(request.source, request.locale)
        await loadOptionalRendererStyles(result.optionalRenderers)
        if (id === sequenceRef.current) {
          document.documentElement.dataset.renderer = 'main'
          startTransition(() => setRendered(result))
        }
      })
    }
    worker.addEventListener('message', (event: MessageEvent<{ id: number; result?: RenderedMarkdown }>) => {
      const { id, result } = event.data
      if (id !== sequenceRef.current) return
      if (!result) {
        renderInMain(id)
        return
      }
      void Promise.all([import('../lib/sanitize'), loadOptionalRendererStyles(result.optionalRenderers)]).then(
        ([{ sanitizeRenderedMarkdown }]) => {
          if (id === sequenceRef.current) {
            document.documentElement.dataset.renderer = 'worker'
            startTransition(() => setRendered(sanitizeRenderedMarkdown(result)))
          }
        },
      )
    })
    worker.addEventListener('error', () => {
      workerRef.current = null
      renderInMain(sequenceRef.current)
    })
    return () => {
      if (workerRef.current === worker) workerRef.current = null
      worker.terminate()
    }
  }, [])

  useEffect(() => {
    const id = ++sequenceRef.current
    requestsRef.current.set(id, { source: deferredSource, locale })
    for (const previousId of requestsRef.current.keys()) if (previousId < id) requestsRef.current.delete(previousId)
    const renderInMain = () => {
      void import('../lib/markdown').then(async ({ renderMarkdownEnhanced }) => {
        const result = await renderMarkdownEnhanced(deferredSource, locale)
        await loadOptionalRendererStyles(result.optionalRenderers)
        if (id === sequenceRef.current) {
          document.documentElement.dataset.renderer = 'main'
          startTransition(() => setRendered(result))
        }
      })
    }
    const worker = workerRef.current
    if (worker) worker.postMessage({ id, source: deferredSource, locale })
    else renderInMain()
  }, [deferredSource, locale])

  return rendered
}
