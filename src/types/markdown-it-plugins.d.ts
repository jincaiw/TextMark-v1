declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const plugin: PluginSimple
  export default plugin
}

declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>
  export default plugin
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it'

  export const full: MarkdownIt.PluginWithOptions<{ shortcuts?: Record<string, string> }>
  export const light: MarkdownIt.PluginWithOptions<{ shortcuts?: Record<string, string>; enabled?: string[] }>
  export const bare: MarkdownIt.PluginWithOptions<{ defs?: Record<string, string>; shortcuts?: Record<string, string> }>
}

declare module 'markdown-it-emoji/lib/light.mjs' {
  import type MarkdownIt from 'markdown-it'

  const plugin: MarkdownIt.PluginWithOptions<{ shortcuts?: Record<string, string> }>
  export default plugin
}
