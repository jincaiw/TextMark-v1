import type { RenderedMarkdown } from '../types'

export async function loadOptionalRendererStyles(renderers: RenderedMarkdown['optionalRenderers']) {
  await Promise.all([renderers.includes('katex') ? import('katex/dist/katex.min.css') : Promise.resolve()])
}
