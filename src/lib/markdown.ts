import MarkdownIt, { type MarkdownIt as MarkdownItInstance, type RendererRule } from 'markdown-it'
import { bare as emoji } from 'markdown-it-emoji'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import type { OutlineItem, RenderedMarkdown } from '../types'
import { splitFrontmatter } from './frontmatter'
import { sanitizeRenderedMarkdown } from './sanitize'
import { detectCodeFenceLanguage, parseCodeFenceInfo } from './codeFence'

const slugPattern = /[^\p{L}\p{N}\s-]/gu
const remotePattern = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i

interface RenderEnvironment {
  [key: string]: unknown
  [key: symbol]: unknown
  slugs?: Map<string, number>
  outline?: OutlineItem[]
  hasMermaid?: boolean
  hasHighlight?: boolean
}

function slugify(value: string): string {
  return value.toLowerCase().replace(slugPattern, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section'
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  )
}

function makeRenderer() {
  const md: MarkdownItInstance = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    // CommonMark soft line breaks are whitespace, while an explicit trailing
    // backslash or two spaces remains a <br>. This matters in imported prose
    // and keeps source wrapping separate from author-requested line breaks.
    breaks: false,
    highlight(code, language): string {
      const normalized = parseCodeFenceInfo(language).highlightLanguage
      const label = parseCodeFenceInfo(language).language || language
      return `<pre class="hljs"${label ? ` data-code-language="${escapeHtml(label)}"` : ''}><code${normalized ? ` data-highlight-language="${escapeHtml(normalized)}" data-highlight-source="${encodeURIComponent(code)}"` : ''}>${escapeHtml(code)}</code></pre>`
    },
  })

  // Only standard :shortcode: names are enabled. Do not replace plain-text emoticons
  // and do not introduce any custom image-based emoji surface.
  md.use(emoji, { defs: { smile: '😄', rocket: '🚀' }, shortcuts: {} })
  md.use(footnote)
  // The plugin's optional label wrapper reinjects raw source text. In a task
  // such as `- [ ] literal <script>`, that can turn escaped inline code back
  // into a real tag before DOMPurify sees it. The checkbox remains interactive
  // through PreviewPane, so omit the unsafe duplicate label markup.
  md.use(taskLists, { enabled: true, label: false })

  const defaultFence = md.renderer.rules.fence
  const fenceRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const parsed = parseCodeFenceInfo(token.info)
    const detectedLanguage = parsed.language ? null : detectCodeFenceLanguage(token.content)
    const language = parsed.language || detectedLanguage || ''
    const state = env as RenderEnvironment
    if (language === 'mermaid') {
      state.hasMermaid = true
      return `<figure class="diagram"><div class="mermaid" data-mermaid-source="${encodeURIComponent(token.content)}"></div></figure>`
    }
    if (detectedLanguage) token.info = detectedLanguage
    if (language && language !== 'math') state.hasHighlight = true
    return defaultFence ? defaultFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }
  md.renderer.rules.fence = fenceRule

  const defaultTableOpen = md.renderer.rules.table_open
  const tableOpenRule: RendererRule = (tokens, index, options, env, self) =>
    `<div class="md-table-scroll">${defaultTableOpen ? defaultTableOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options)}`
  md.renderer.rules.table_open = tableOpenRule
  const defaultTableClose = md.renderer.rules.table_close
  const tableCloseRule: RendererRule = (tokens, index, options, env, self) =>
    `${defaultTableClose ? defaultTableClose(tokens, index, options, env, self) : self.renderToken(tokens, index, options)}</div>`
  md.renderer.rules.table_close = tableCloseRule

  const defaultImage = md.renderer.rules.image
  const imageRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const source = String(token.attrGet('src') ?? '')
    if (source && !remotePattern.test(source)) {
      token.attrSet('data-local-src', source)
      token.attrSet('src', '')
      token.attrSet('loading', 'lazy')
    }
    return defaultImage ? defaultImage(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }
  md.renderer.rules.image = imageRule

  const defaultLinkOpen = md.renderer.rules.link_open
  const linkOpenRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const href = String(token.attrGet('href') ?? '')
    if (/^https?:/i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noreferrer noopener')
    }
    return defaultLinkOpen ? defaultLinkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
  }
  md.renderer.rules.link_open = linkOpenRule

  md.renderer.rules.text = (tokens, index) => escapeHtml(tokens[index].content).replace(/\t/g, '<span class="md-inline-tab">\t</span>')

  // markdown-preview supports ==highlight== as a small, readable inline
  // extension. Keep the transform conservative: code spans and raw HTML are
  // handled by MarkdownIt before this rule, while escaped markers remain text.
  md.inline.ruler.after('emphasis', 'textmark_highlight', (state, silent) => {
    const marker = '=='
    const start = state.pos
    if (state.src.slice(start, start + marker.length) !== marker) return false
    const end = state.src.indexOf(marker, start + marker.length)
    if (end < start + marker.length + 1) return false
    if (!silent) {
      const token = state.push('mark_open', 'mark', 1)
      token.markup = marker
      const content = state.src.slice(start + marker.length, end)
      const text = state.push('text', '', 0)
      text.content = content
      const close = state.push('mark_close', 'mark', -1)
      close.markup = marker
    }
    state.pos = end + marker.length
    return true
  })

  const headingOpenRule: RendererRule = (tokens, index, _options, env) => {
    const token = tokens[index]
    const inline = tokens[index + 1]
    const text = inline?.content ?? 'Section'
    const state = env as RenderEnvironment
    state.slugs ??= new Map()
    state.outline ??= []
    const base = slugify(text)
    const count = state.slugs.get(base) ?? 0
    state.slugs.set(base, count + 1)
    const id = count ? `${base}-${count + 1}` : base
    const level = Number(token.tag.slice(1))
    state.outline.push({ id, text, level, line: token.map ? token.map[0] + 1 : 0 })
    return `<${token.tag} id="${id}">`
  }
  md.renderer.rules.heading_open = headingOpenRule

  md.core.ruler.after('block', 'textmark_blank_lines', (state) => {
    const output: typeof state.tokens = []
    let previousEnd = 0
    for (const token of state.tokens) {
      if (token.level === 0 && token.map && token.nesting !== -1) {
        const gap = Math.max(0, token.map[0] - previousEnd)
        for (let blankIndex = 0; blankIndex < gap; blankIndex += 1) {
          const Token = state.Token as new (type: string, tag: string, nesting: number) => typeof token
          const blank = new Token('textmark_blank', 'div', 0)
          // The final blank in a run is deliberately compact. This preserves
          // authored vertical rhythm without doubling paragraph/heading gaps.
          if (blankIndex === gap - 1) blank.attrSet('class', 'md-source-blank-line-final')
          output.push(blank)
        }
        previousEnd = Math.max(previousEnd, token.map[1])
      }
      output.push(token)
    }
    state.tokens = output
  })
  md.renderer.rules.textmark_blank = (tokens, index) =>
    `<div class="md-source-blank-line${tokens[index].attrGet('class') ? ` ${tokens[index].attrGet('class')}` : ''}" aria-hidden="true"></div>`

  // Ordered-list gutter growth (upstream d0c6197 #622): a list whose widest
  // rendered marker reaches three digits gets `data-mdp-digits`, and the
  // stylesheet widens its gutter one `ch` per extra digit so "100." never
  // hangs past the page edge. Markers number sequentially from the list's
  // start (browsers ignore the authored value of every item but the first),
  // so the widest marker is `start + count - 1`. Each list owns its own
  // count, including nested lists, which markdown-it splits into their own
  // <ol> when renumbered.
  md.core.ruler.after('textmark_blank_lines', 'textmark_list_digits', (state) => {
    const stack: { ordered: boolean; start: number; count: number; token: (typeof state.tokens)[number] }[] = []
    for (const token of state.tokens) {
      if (token.type === 'ordered_list_open') {
        const start = Number(token.attrGet('start') ?? '1')
        stack.push({ ordered: true, start: Number.isFinite(start) ? start : 1, count: 0, token })
      } else if (token.type === 'bullet_list_open') {
        stack.push({ ordered: false, start: 1, count: 0, token })
      } else if (token.type === 'list_item_open') {
        const top = stack[stack.length - 1]
        if (top?.ordered) top.count += 1
      } else if (token.type === 'ordered_list_close' || token.type === 'bullet_list_close') {
        const top = stack.pop()
        if (!top?.ordered || top.count === 0) continue
        const widest = String(top.start + top.count - 1).length
        if (widest >= 3) top.token.attrSet('data-mdp-digits', String(Math.min(widest, 9)))
      }
    }
  })

  return md
}

const renderer = makeRenderer()
let lastRenderSource: string | undefined
let lastRenderLocale: 'zh-CN' | 'en' | undefined
let lastRenderResult: RenderedMarkdown | undefined

function looksLikeDelimitedMath(body: string) {
  const trimmed = body.trim()
  if (!trimmed) return false
  // CommonMark uses the same backslashes to escape literal brackets and
  // parentheses. Preserve prose such as \[draft\] or \(圆括号\), while still
  // accepting canonical LaTeX expressions and single-letter variables.
  const withoutTextCommands = trimmed.replace(/\\(?:text|mathrm|mathbf|operatorname)\{[^}]*\}/g, '')
  if (/[^\x00-\x7f]/.test(withoutTextCommands)) return false
  return /\\[A-Za-z]+|[_^=+*/<>]|(?:^|\s)-(?:\s|\d|[A-Za-z])|^[A-Za-z]$/.test(trimmed)
}

function containsMath(source: string) {
  // Escaped brackets in Markdown link labels are ordinary text. Removing
  // complete links here keeps the optional KaTeX chunk aligned with the
  // protected-link path in normalizeMath.
  const withoutLinks = source.replace(/(?<!!)\[(?:\\.|[^\]\\\n])*\](?:\[[^\]\n]*\]|\([^\)\n]*\))/g, '')
  if (/\$[^$\n]+\$|\$\$[\s\S]+?\$\$|^(?:`{3,}|~{3,})[ \t]*math(?:\s|$)/im.test(withoutLinks)) return true
  return [...withoutLinks.matchAll(/\\(?:\[|\()([\s\S]*?)\\(?:\]|\))/g)].some((match) => looksLikeDelimitedMath(match[1]))
}

function readingDirection(source: string): 'rtl' | 'auto' {
  let rtlCount = 0
  for (const _match of source.matchAll(/[\u0590-\u08ff]/g)) rtlCount += 1
  if (rtlCount <= 4) return 'auto'
  let letters = 0
  for (const _match of source.matchAll(/[\p{L}\p{N}]/gu)) letters += 1
  return rtlCount > letters * 0.3 ? 'rtl' : 'auto'
}

function normalizeMath(source: string) {
  const protectedBlocks: string[] = []
  const protect = (value: string) => `TEXTMARKPROTECTED${protectedBlocks.push(value) - 1}TOKEN`
  const placeholder = (body: string, display: boolean) =>
    `<${display ? 'div' : 'span'} class="textmark-math-placeholder" data-math-display="${display}" data-math-source="${encodeURIComponent(body.trim())}"></${display ? 'div' : 'span'}>`
  let normalized = source.replace(
    /^(`{3,}|~{3,})[ \t]*([^\n`]*)\n([\s\S]*?)^\1[ \t]*$/gim,
    (full, _fence: string, info: string, body: string) => {
      if (parseCodeFenceInfo(info).language === 'math') return placeholder(body, true)
      return protect(full)
    },
  )
  normalized = normalized.replace(/(?<!`)(`+)(?!`)([^\n]*?)(?<!`)\1(?!`)/g, protect)
  // A literal \[...\] in a Markdown link label is an escaped bracket, not a
  // display-math delimiter. Protect complete links before normalising LaTeX so
  // reference links such as [\[4\]][source] retain their Markdown meaning.
  normalized = normalized.replace(/(?<!!)\[(?:\\.|[^\]\\\n])*\](?:\[[^\]\n]*\]|\([^\)\n]*\))/g, protect)
  normalized = normalized
    .replace(/(?<!\\)\\\\\[([\s\S]*?)\\\\\]/g, (match, body: string) => (looksLikeDelimitedMath(body) ? `$$${body}$$` : match))
    .replace(/(?<!\\)\\\[([\s\S]*?)\\\]/g, (match, body: string) => (looksLikeDelimitedMath(body) ? `$$${body}$$` : match))
    .replace(/(?<!\\)\\\\\(([^\n]*?)\\\\\)/g, (match, body: string) => (looksLikeDelimitedMath(body) ? `$${body}$` : match))
    .replace(/(?<!\\)\\\(([^\n]*?)\\\)/g, (match, body: string) => (looksLikeDelimitedMath(body) ? `$${body}$` : match))
  normalized = normalized
    .replace(/^[ \t]*\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$[ \t]*$/gm, (_match, body: string) => placeholder(body, true))
    .replace(/\$\$([^\n]+?)\$\$/g, (_match, body: string) => placeholder(body, true))
    .replace(/(^|[^\\$])\$([^\n$]+?)\$(?!\$)/g, (match, prefix: string, body: string) => {
      if (!body.trim() || body !== body.trim()) return match
      return `${prefix}${placeholder(body, false)}`
    })
  // A protected link can itself contain a protected inline-code token. Restore
  // from the outside in until nested placeholders are exhausted.
  for (let pass = 0; pass <= protectedBlocks.length && /TEXTMARKPROTECTED\d+TOKEN/.test(normalized); pass += 1)
    normalized = normalized.replace(/TEXTMARKPROTECTED(\d+)TOKEN/g, (_match, index: string) => protectedBlocks[Number(index)] ?? '')
  return normalized
}

function buildSourceMaps(source: string) {
  const lines = source.split(/\r?\n/)
  const offsets: number[] = []
  let offset = 0
  for (const line of lines) {
    offsets.push(offset)
    offset += line.length + 1
  }
  const sourceMap: RenderedMarkdown['sourceMap'] = []
  const tables: RenderedMarkdown['tables'] = []
  const tasks: RenderedMarkdown['tasks'] = []
  let taskIndex = 0
  let tableIndex = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s{0,3}#{1,6}(?:\s+|$)/.test(line) || (index + 1 < lines.length && /^\s*(?:=+|-+)\s*$/.test(lines[index + 1]) && line.trim()))
      sourceMap.push({ kind: 'heading', start: offsets[index], end: offsets[index] + line.length, line: index + 1 })
    if (/^\s{0,3}\[\^[^\]]+\]:/.test(line)) {
      let end = index + 1
      while (end < lines.length && (/^(?: {2,}|\t)\S/.test(lines[end]) || !lines[end].trim())) end += 1
      while (end > index + 1 && !lines[end - 1].trim()) end -= 1
      sourceMap.push({ kind: 'footnote', start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 })
    }
    const task = line.match(/^\s*(?:>\s*)?(?:\d+[.)]|[-+*])\s+\[([ xX])\]/)
    if (task) {
      sourceMap.push({ kind: 'task', start: offsets[index], end: offsets[index] + line.length, line: index + 1 })
      tasks.push({ index: taskIndex++, line: index + 1, checked: task[1].toLowerCase() === 'x' })
    }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      let end = index + 2
      while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end += 1
      const columns = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/).length
      const tableLines = [line, ...lines.slice(index + 2, end)]
      const cells = tableLines.flatMap((row, rowIndex) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split(/(?<!\\)\|/)
          .map((markdown, column) => ({ row: rowIndex, column, markdown: markdown.trim().replace(/\\\|/g, '|') })),
      )
      tables.push({ index: tableIndex++, startLine: index + 1, endLine: end, rows: end - index - 1, columns, cells })
      sourceMap.push({ kind: 'table', start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 })
      index = end - 1
    } else if (/^\s*(`{3,}|~{3,})/.test(line)) {
      const fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1] ?? '```'
      let end = index + 1
      while (end < lines.length && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[end])) end += 1
      end = Math.min(lines.length, end + 1)
      sourceMap.push({ kind: 'code', start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 })
      index = end - 1
    } else if (line.trim() && !/^\s*(?:#{1,6}|>|[-+*]\s|\d+[.)]\s)/.test(line)) {
      sourceMap.push({ kind: 'paragraph', start: offsets[index], end: offsets[index] + line.length, line: index + 1 })
    }
  }
  return { sourceMap, tables, tasks }
}

/** Heading tokens are produced from the math-normalised source, so their
 * markdown-it line map can drift away from the authored document. Re-anchor
 * every outline entry to the real heading line by walking the original source
 * in document order. */
function anchorOutlineToSource(outline: OutlineItem[], source: string) {
  const lines = source.split(/\r?\n/)
  let cursor = 0
  return outline.map((item) => {
    const wanted = item.text.trim()
    for (let index = cursor; index < lines.length; index += 1) {
      // The content group is optional so a bare `#` (an empty heading) still
      // matches its own line instead of falling through to the next heading.
      const atx = lines[index].match(/^\s{0,3}#{1,6}(?:\s+(.*))?$/)
      // The `includes` fallback anchors a heading whose rendered text is a
      // substring of the source line (formatting markers, link labels). It is
      // skipped for an empty heading, where `includes('')` would match every
      // following heading and mis-anchor the outline.
      if (atx && (atx[1]?.trim() === wanted || (wanted !== '' && atx[1]?.includes(wanted)))) {
        cursor = index + 1
        return { ...item, line: index + 1 }
      }
      const underline = lines[index + 1]?.match(/^\s*(?:=+|-+)\s*$/)
      if (underline && lines[index].trim() === wanted && lines[index].trim()) {
        cursor = index + 1
        return { ...item, line: index + 1 }
      }
    }
    return item
  })
}

function frontmatterHtml(entries: RenderedMarkdown['frontmatter']) {
  if (!entries.length) return ''
  return `<section class="md-frontmatter" aria-label="Frontmatter"><table><tbody>${entries.map((entry) => `<tr><th>${escapeHtml(entry.key)}</th><td>${entry.items?.length ? entry.items.map((item) => `<span class="md-fm-pill">${escapeHtml(item)}</span>`).join('') : entry.value ? escapeHtml(entry.value) : '<span class="md-fm-empty"></span>'}</td></tr>`).join('')}</tbody></table></section>`
}

function convertRawRelativeImages(html: string) {
  return html.replace(
    /<img\b([^>]*?)\bsrc=(['"])([^'"]+)\2([^>]*)>/gi,
    (match, before: string, quote: string, source: string, after: string) => {
      if (!source || remotePattern.test(source) || /\bdata-local-src=/i.test(match)) return match
      return `<img${before}src="" data-local-src=${quote}${escapeHtml(source)}${quote}${after}>`
    },
  )
}

/**
 * markdown-it emits GFM column alignment as inline styles. Inline styles are
 * forbidden globally for untrusted Markdown, so convert this narrow,
 * renderer-owned value to classes before sanitisation rather than weakening
 * the HTML policy.
 */
function preserveTableAlignment(html: string) {
  return html.replace(
    /<(th|td)\b([^>]*?)\sstyle=(['"])text-align:\s*(left|right|center)\s*;?\3([^>]*)>/gi,
    (_match, tag: string, before: string, _quote: string, alignment: string, after: string) => {
      const attributes = `${before}${after}`
      const className = `md-table-align-${alignment.toLowerCase()}`
      if (/\bclass=(['"])(.*?)\1/i.test(attributes))
        return `<${tag}${attributes.replace(/\bclass=(['"])(.*?)\1/i, (_classMatch, quote: string, classes: string) => `class=${quote}${classes} ${className}${quote}`)}>`
      return `<${tag}${attributes} class="${className}">`
    },
  )
}

/** The fifteen callout kinds of upstream d0c6197 (#629): GitHub's five plus
 * Obsidian's kinds. Any `[!type]` blockquote is a callout; an unknown type
 * looks like a note. */
const CALLOUT_KINDS = new Set([
  'note',
  'tip',
  'important',
  'warning',
  'caution',
  'abstract',
  'info',
  'todo',
  'success',
  'question',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
])

/** Obsidian's aliases. `important` and `caution` are aliases in Obsidian, but
 * GitHub gives them their own look, so upstream keeps them as kinds. */
const CALLOUT_ALIASES: Record<string, string> = {
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
}

/** GitHub Octicons, the same path data upstream embeds per kind. */
const CALLOUT_ICONS: Record<string, string> = {
  note: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  info: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  tip: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  important:
    'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  warning:
    'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  caution:
    'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  abstract:
    'M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 0 1-1.5 0V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13.274 9.537v-.001l-4.557 4.45a.75.75 0 0 1-1.055-.008l-1.943-1.95a.75.75 0 0 1 1.062-1.058l1.419 1.425 4.026-3.932a.75.75 0 1 1 1.048 1.074ZM4.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h2a.75.75 0 0 1 0 1.5h-2A.75.75 0 0 1 4 7.75Z',
  todo: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm1.5 0a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l1.47 1.47 3.97-3.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z',
  success:
    'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z',
  question:
    'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 0 1 1.637.525c.503.377.863.965.863 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 0 0-.26.16.952.952 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25a.612.612 0 0 0-.262-.525A1.27 1.27 0 0 0 8 5.5c-.369 0-.595.09-.74.187a1.01 1.01 0 0 0-.34.398ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  failure:
    'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z',
  danger:
    'M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Zm1.047 1.074L3.286 8.571A.25.25 0 0 0 3.462 9H6.75a.75.75 0 0 1 .694 1.034l-1.713 4.188 6.982-6.793A.25.25 0 0 0 12.538 7H9.25a.75.75 0 0 1-.683-1.06l2.008-4.418.003-.006a.036.036 0 0 0-.004-.009l-.006-.006-.008-.001c-.003 0-.006.002-.009.004Z',
  bug: 'M4.72.22a.75.75 0 0 1 1.06 0l1 .999a3.488 3.488 0 0 1 2.441 0l.999-1a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.775.776c.616.63.995 1.493.995 2.444v.327c0 .1-.009.197-.025.292.408.14.764.392 1.029.722l1.968-.787a.75.75 0 0 1 .556 1.392L13 7.258V9h2.25a.75.75 0 0 1 0 1.5H13v.5c0 .409-.049.806-.141 1.186l2.17.868a.75.75 0 0 1-.557 1.392l-2.184-.873A4.997 4.997 0 0 1 8 16a4.997 4.997 0 0 1-4.288-2.427l-2.183.873a.75.75 0 0 1-.558-1.392l2.17-.868A5.036 5.036 0 0 1 3 11v-.5H.75a.75.75 0 0 1 0-1.5H3V7.258L.971 6.446a.75.75 0 0 1 .558-1.392l1.967.787c.265-.33.62-.583 1.03-.722a1.677 1.677 0 0 1-.026-.292V4.5c0-.951.38-1.814.995-2.444L4.72 1.28a.75.75 0 0 1 0-1.06Zm.53 6.28a.75.75 0 0 0-.75.75V11a3.5 3.5 0 1 0 7 0V7.25a.75.75 0 0 0-.75-.75ZM6.173 5h3.654A.172.172 0 0 0 10 4.827V4.5a2 2 0 1 0-4 0v.327c0 .096.077.173.173.173Z',
  example:
    'M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  quote:
    'M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z',
}

/** The `[!type]` tag that opens a callout, ported from upstream's AlertTag.
 * The type is case-insensitive; smart punctuation has already turned the `--`
 * and `---` the author typed into en and em dashes, so those count as the
 * hyphens they were. A `-` or `+` right after the `]` folds the callout. */
interface CalloutTag {
  kind: string
  fold: 'open' | 'closed' | null
  /** The type with a capital first letter, never localized: `[!faq]` reads
   * "Faq" and `[!NOTE]` reads "Note", exactly as upstream. */
  defaultTitle: string
  /** Characters the tag takes up at the start of the paragraph. */
  length: number
}

function parseCalloutTag(text: string): CalloutTag | null {
  if (!text.startsWith('[!')) return null
  const afterBang = text.slice(2)
  let end = 0
  while (end < afterBang.length) {
    const character = afterBang[end]!
    if (!/[A-Za-z0-9_-]/.test(character) && character !== '–' && character !== '—') break
    end += 1
  }
  const name = afterBang.slice(0, end)
  if (!/^[A-Za-z]/.test(name) || afterBang[end] !== ']') return null
  const type = name.toLowerCase().replace(/–/g, '--').replace(/—/g, '---')
  const marker = afterBang[end + 1]
  const fold = marker === '-' ? 'closed' : marker === '+' ? 'open' : null
  return {
    kind: CALLOUT_KINDS.has(type) ? type : (CALLOUT_ALIASES[type] ?? 'note'),
    fold,
    defaultTitle: type.charAt(0).toUpperCase() + type.slice(1),
    length: 2 + name.length + 1 + (fold ? 1 : 0),
  }
}

function calloutIcon(kind: string): string {
  return `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${CALLOUT_ICONS[kind]}"></path></svg>`
}

/** The end index of the `</blockquote>` closing the `<blockquote>` at
 * `open`, counting nested blockquotes (including raw-HTML ones with
 * attributes) so a remainder never cuts at an inner close. */
function findBlockquoteEnd(html: string, open: number): number {
  const pattern = /<\/?blockquote\b/g
  pattern.lastIndex = open
  let depth = 0
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[0][1] === '/' ? -1 : 1
    if (depth === 0) return match.index
  }
  return -1
}

/**
 * Converts every callout blockquote to upstream's alert markup (d0c6197
 * #629): any `[!type]` blockquote is a callout, kinds resolve through
 * Obsidian's aliases, unknown types look like a note, `[!x]-`/`[!x]+` fold
 * into `<details>`/`<summary>` carrying `data-md-fold`, the title is the
 * text after the tag or the capitalized type, and the body keeps the rest
 * of the first paragraph plus every following block. Default titles are
 * not localized — upstream renders "Note"/"Tip"/"Faq" in every language.
 */
function convertAlerts(html: string): string {
  let out = ''
  let cursor = 0
  for (;;) {
    const open = html.indexOf('<blockquote>', cursor)
    if (open < 0) break
    const end = findBlockquoteEnd(html, open)
    if (end < 0) break
    out += html.slice(cursor, open)
    const inner = html.slice(open + '<blockquote>'.length, end)
    const first = inner.match(/^(\s*)<p>([\s\S]*?)<\/p>/)
    const tag = first ? parseCalloutTag(first[2]) : null
    if (!tag) {
      out += `<blockquote>${convertAlerts(inner)}</blockquote>`
      cursor = end + '</blockquote>'.length
      continue
    }
    // Text on the tag line after the closing `]` is the title; the first
    // soft or hard break ends it, and everything after belongs to the body.
    // Upstream drops exactly one leading space after the tag.
    const rest = first![2].slice(tag.length).replace(/^ /, '')
    const breakMatch = rest.match(/\n|<br\s*\/?>\n?/)
    const titleHtml = breakMatch ? rest.slice(0, breakMatch.index) : rest
    const bodyHtml = breakMatch ? rest.slice((breakMatch.index ?? 0) + breakMatch[0].length) : ''
    const remainder = convertAlerts(inner.slice(first![0].length))
    const wrapper = tag.fold ? 'details' : 'div'
    const titleTag = tag.fold ? 'summary' : 'p'
    const foldAttribute = tag.fold === 'open' ? ' data-md-fold="open" open=""' : tag.fold === 'closed' ? ' data-md-fold="closed"' : ''
    out += `<${wrapper} class="markdown-alert markdown-alert-${tag.kind}"${foldAttribute}>`
    out += `<${titleTag} class="markdown-alert-title">${calloutIcon(tag.kind)} ${titleHtml.trim() ? titleHtml : tag.defaultTitle}</${titleTag}>`
    if (bodyHtml) out += `<p>${bodyHtml}</p>`
    out += remainder
    out += `</${wrapper}>`
    cursor = end + '</blockquote>'.length
  }
  return out + html.slice(cursor)
}

export function renderMarkdownUnsafe(source: string, locale: 'zh-CN' | 'en' = 'en'): RenderedMarkdown {
  // React development replays, export fallbacks and native preview hosts can
  // request the same immutable document more than once. Retaining only the
  // most recent parse avoids duplicate work without allowing cache growth.
  if (source === lastRenderSource && locale === lastRenderLocale && lastRenderResult) return lastRenderResult
  const frontmatter = splitFrontmatter(source)
  const environment: RenderEnvironment = {}
  // markdown-it-texmath handles dollar delimiters. Normalize the two canonical
  // LaTex delimiters before parsing so all renderers (including exports) agree.
  const hasMath = containsMath(frontmatter.body)
  const mathNormalized = hasMath ? normalizeMath(frontmatter.body) : frontmatter.body
  let raw = renderer.render(mathNormalized, environment)
  const outline = anchorOutlineToSource(environment.outline ?? [], source)
  const toc = `<nav class="table-of-contents" aria-label="${locale === 'zh-CN' ? '目录' : 'Table of contents'}"><ol>${outline.map((item) => `<li class="toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join('')}</ol></nav>`
  raw = raw.replace(/<p>\s*\[TOC\]\s*<\/p>/gi, toc)
  raw = preserveTableAlignment(convertAlerts(convertRawRelativeImages(raw)))
  raw = `${frontmatterHtml(frontmatter.entries)}${raw}`
  const maps = buildSourceMaps(source)
  const hasMermaid = environment.hasMermaid ?? false
  const hasHighlight = environment.hasHighlight ?? false
  const result: RenderedMarkdown = {
    html: raw,
    outline,
    hasMermaid,
    hasMath,
    frontmatter: frontmatter.entries,
    optionalRenderers: [hasHighlight ? 'highlight' : null, hasMath ? 'katex' : null, hasMermaid ? 'mermaid' : null].filter(
      (value): value is 'highlight' | 'katex' | 'mermaid' => Boolean(value),
    ),
    direction: readingDirection(frontmatter.body),
    ...maps,
  }
  lastRenderSource = source
  lastRenderLocale = locale
  lastRenderResult = result
  return result
}

export function renderMarkdown(source: string, locale: 'zh-CN' | 'en' = 'en'): RenderedMarkdown {
  return sanitizeRenderedMarkdown(renderMarkdownUnsafe(source, locale))
}

/**
 * Performs the complete, potentially expensive rendering pass without touching
 * browser-only sanitisation APIs. This is the entry point used by the render
 * worker; callers must sanitise the returned result before inserting it into a
 * document.
 */
export async function renderMarkdownEnhancedUnsafe(source: string, locale: 'zh-CN' | 'en' = 'en'): Promise<RenderedMarkdown> {
  const result = renderMarkdownUnsafe(source, locale)
  let html = result.html
  if (result.optionalRenderers.includes('highlight')) {
    const { highlightCode, prepareHighlightLanguages } = await import('./syntaxHighlight')
    const codeBlocks = [...html.matchAll(/<code\s+data-highlight-language="([^"]+)"\s+data-highlight-source="([^"]*)">[\s\S]*?<\/code>/g)]
    await prepareHighlightLanguages(codeBlocks.map((match) => match[1]))
    html = html.replace(
      /<code\s+data-highlight-language="([^"]+)"\s+data-highlight-source="([^"]*)">[\s\S]*?<\/code>/g,
      (_match, language: string, encoded: string) => {
        const sourceCode = decodeURIComponent(encoded)
        return `<code class="hljs language-${escapeHtml(language)}">${highlightCode(sourceCode, language)}</code>`
      },
    )
  }
  if (result.optionalRenderers.includes('katex')) {
    const { renderMath } = await import('./mathRender')
    html = html.replace(
      /<(span|div) class="textmark-math-placeholder" data-math-display="(true|false)" data-math-source="([^"]*)"><\/\1>/g,
      (_match, _tag: string, display: string, encoded: string) => renderMath(decodeURIComponent(encoded), display === 'true'),
    )
  }
  return { ...result, html }
}

export async function renderMarkdownEnhanced(source: string, locale: 'zh-CN' | 'en' = 'en'): Promise<RenderedMarkdown> {
  return sanitizeRenderedMarkdown(await renderMarkdownEnhancedUnsafe(source, locale))
}
