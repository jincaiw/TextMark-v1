/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module 'markdown-it-texmath' {
  import type { MarkdownIt } from 'markdown-it'
  const texmath: (md: MarkdownIt, options?: unknown) => void
  export default texmath
}

declare module '*.css'
