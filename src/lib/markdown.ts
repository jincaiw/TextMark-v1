import MarkdownIt, { type MarkdownIt as MarkdownItInstance, type RendererRule } from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import type { OutlineItem, RenderedMarkdown } from "../types";
import { splitFrontmatter } from "./frontmatter";
import { sanitizeRenderedMarkdown } from "./sanitize";
import { parseCodeFenceInfo } from "./codeFence";

const slugPattern = /[^\p{L}\p{N}\s-]/gu;
const remotePattern = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(slugPattern, "").replace(/\s+/g, "-") || "section";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function makeRenderer() {
  const md: MarkdownItInstance = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language): string {
      const normalized = parseCodeFenceInfo(language).highlightLanguage;
      return `<pre class="hljs"><code${normalized ? ` data-highlight-language="${escapeHtml(normalized)}" data-highlight-source="${encodeURIComponent(code)}"` : ""}>${escapeHtml(code)}</code></pre>`;
    },
  });

  md.use(footnote);
  md.use(taskLists, { enabled: true, label: true, labelAfter: true });

  const defaultFence = md.renderer.rules.fence;
  const fenceRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const language = parseCodeFenceInfo(token.info).language;
    if (language === "mermaid") {
      return `<figure class="diagram"><div class="mermaid" data-mermaid-source="${encodeURIComponent(token.content)}"></div></figure>`;
    }
    return defaultFence ? defaultFence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
  };
  md.renderer.rules.fence = fenceRule;

  const defaultImage = md.renderer.rules.image;
  const imageRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const source = String(token.attrGet("src") ?? "");
    if (source && !remotePattern.test(source)) {
      token.attrSet("data-local-src", source);
      token.attrSet("src", "");
      token.attrSet("loading", "lazy");
    }
    return defaultImage ? defaultImage(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
  };
  md.renderer.rules.image = imageRule;

  const defaultLinkOpen = md.renderer.rules.link_open;
  const linkOpenRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = String(token.attrGet("href") ?? "");
    if (/^https?:/i.test(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noreferrer noopener");
    }
    return defaultLinkOpen ? defaultLinkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
  };
  md.renderer.rules.link_open = linkOpenRule;

  md.renderer.rules.text = (tokens, index) => escapeHtml(tokens[index].content)
    .replace(/\t/g, '<span class="md-inline-tab">\t</span>');

  const headingOpenRule: RendererRule = (tokens, index, _options, env) => {
    const token = tokens[index];
    const inline = tokens[index + 1];
    const text = inline?.content ?? "Section";
    const state = env as { slugs?: Map<string, number>; outline?: OutlineItem[] };
    state.slugs ??= new Map();
    state.outline ??= [];
    const base = slugify(text);
    const count = state.slugs.get(base) ?? 0;
    state.slugs.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    const level = Number(token.tag.slice(1));
    state.outline.push({ id, text, level });
    return `<${token.tag} id="${id}">`;
  };
  md.renderer.rules.heading_open = headingOpenRule;

  md.core.ruler.after("block", "textmark_blank_lines", (state) => {
    const output: typeof state.tokens = [];
    let previousEnd = 0;
    for (const token of state.tokens) {
      if (token.level === 0 && token.map && token.nesting !== -1) {
        const gap = Math.max(0, token.map[0] - previousEnd);
        for (let blankIndex = 0; blankIndex < gap; blankIndex += 1) {
          const Token = state.Token as new (type: string, tag: string, nesting: number) => typeof token;
          const blank = new Token("textmark_blank", "div", 0);
          output.push(blank);
        }
        previousEnd = Math.max(previousEnd, token.map[1]);
      }
      output.push(token);
    }
    state.tokens = output;
  });
  md.renderer.rules.textmark_blank = () => '<div class="md-source-blank-line" aria-hidden="true"></div>';

  return md;
}

const renderer = makeRenderer();

function normalizeMath(source: string) {
  const protectedBlocks: string[] = [];
  const protect = (value: string) => `TEXTMARKPROTECTED${protectedBlocks.push(value) - 1}TOKEN`;
  const placeholder = (body: string, display: boolean) => `<${display ? "div" : "span"} class="textmark-math-placeholder" data-math-display="${display}" data-math-source="${encodeURIComponent(body.trim())}"></${display ? "div" : "span"}>`;
  let normalized = source.replace(/^(`{3,}|~{3,})[ \t]*([^\n`]*)\n([\s\S]*?)^\1[ \t]*$/gim, (full, _fence: string, info: string, body: string) => {
    if (parseCodeFenceInfo(info).language === "math") return placeholder(body, true);
    return protect(full);
  });
  normalized = normalized.replace(/(?<!`)(`+)(?!`)([^\n]*?)(?<!`)\1(?!`)/g, protect);
  normalized = normalized
    .replace(/(?<!\\)\\\\\[([\s\S]*?)\\\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/(?<!\\)\\\[([\s\S]*?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/(?<!\\)\\\\\(([^\n]*?)\\\\\)/g, (_match, body: string) => `$${body}$`)
    .replace(/(?<!\\)\\\(([^\n]*?)\\\)/g, (_match, body: string) => `$${body}$`);
  normalized = normalized
    .replace(/^\s*\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$\s*$/gm, (_match, body: string) => placeholder(body, true))
    .replace(/\$\$([^\n]+?)\$\$/g, (_match, body: string) => placeholder(body, true))
    .replace(/(^|[^\\$])\$([^\n$]+?)\$(?!\$)/g, (match, prefix: string, body: string) => {
      if (!body.trim() || body !== body.trim()) return match;
      return `${prefix}${placeholder(body, false)}`;
    });
  return normalized.replace(/TEXTMARKPROTECTED(\d+)TOKEN/g, (_match, index: string) => protectedBlocks[Number(index)] ?? "");
}

function buildSourceMaps(source: string) {
  const lines = source.split(/\r?\n/);
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  const sourceMap: RenderedMarkdown["sourceMap"] = [];
  const tables: RenderedMarkdown["tables"] = [];
  const tasks: RenderedMarkdown["tasks"] = [];
  let taskIndex = 0;
  let tableIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s{0,3}#{1,6}(?:\s+|$)/.test(line) || (index + 1 < lines.length && /^\s*(?:=+|-+)\s*$/.test(lines[index + 1]) && line.trim())) sourceMap.push({ kind: "heading", start: offsets[index], end: offsets[index] + line.length, line: index + 1 });
    if (/^\s{0,3}\[\^[^\]]+\]:/.test(line)) {
      let end = index + 1;
      while (end < lines.length && (/^(?: {2,}|\t)\S/.test(lines[end]) || !lines[end].trim())) end += 1;
      while (end > index + 1 && !lines[end - 1].trim()) end -= 1;
      sourceMap.push({ kind: "footnote", start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 });
    }
    const task = line.match(/^\s*(?:>\s*)?(?:\d+[.)]|[-+*])\s+\[([ xX])\]/);
    if (task) {
      sourceMap.push({ kind: "task", start: offsets[index], end: offsets[index] + line.length, line: index + 1 });
      tasks.push({ index: taskIndex++, line: index + 1, checked: task[1].toLowerCase() === "x" });
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      let end = index + 2;
      while (end < lines.length && lines[end].includes("|") && lines[end].trim()) end += 1;
      const columns = line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).length;
      const tableLines = [line, ...lines.slice(index + 2, end)];
      const cells = tableLines.flatMap((row, rowIndex) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/)
        .map((markdown, column) => ({ row: rowIndex, column, markdown: markdown.trim().replace(/\\\|/g, "|") })));
      tables.push({ index: tableIndex++, startLine: index + 1, endLine: end, rows: end - index - 1, columns, cells });
      sourceMap.push({ kind: "table", start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 });
      index = end - 1;
    } else if (/^\s*(`{3,}|~{3,})/.test(line)) {
      const fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1] ?? "```";
      let end = index + 1;
      while (end < lines.length && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[end])) end += 1;
      end = Math.min(lines.length, end + 1);
      sourceMap.push({ kind: "code", start: offsets[index], end: offsets[end - 1] + lines[end - 1].length, line: index + 1 });
      index = end - 1;
    } else if (line.trim() && !/^\s*(?:#{1,6}|>|[-+*]\s|\d+[.)]\s)/.test(line)) {
      sourceMap.push({ kind: "paragraph", start: offsets[index], end: offsets[index] + line.length, line: index + 1 });
    }
  }
  return { sourceMap, tables, tasks };
}

function frontmatterHtml(entries: RenderedMarkdown["frontmatter"]) {
  if (!entries.length) return "";
  return `<section class="md-frontmatter" aria-label="Frontmatter"><table><tbody>${entries.map((entry) => `<tr><th>${escapeHtml(entry.key)}</th><td>${entry.items?.length ? entry.items.map((item) => `<span class="md-fm-pill">${escapeHtml(item)}</span>`).join("") : entry.value ? escapeHtml(entry.value) : '<span class="md-fm-empty"></span>'}</td></tr>`).join("")}</tbody></table></section>`;
}

function convertRawRelativeImages(html: string) {
  return html.replace(/<img\b([^>]*?)\bsrc=(['"])([^'"]+)\2([^>]*)>/gi, (match, before: string, quote: string, source: string, after: string) => {
    if (!source || remotePattern.test(source) || /\bdata-local-src=/i.test(match)) return match;
    return `<img${before}src="" data-local-src=${quote}${escapeHtml(source)}${quote}${after}>`;
  });
}

function convertAlerts(html: string, locale: "zh-CN" | "en") {
  const labels = locale === "zh-CN"
    ? { NOTE: "注意", TIP: "提示", IMPORTANT: "重要", WARNING: "警告", CAUTION: "小心" }
    : { NOTE: "Note", TIP: "Tip", IMPORTANT: "Important", WARNING: "Warning", CAUTION: "Caution" };
  return html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi,
    (_match, rawKind: string, firstParagraph: string, remainder: string) => {
      const kind = rawKind.toUpperCase() as keyof typeof labels;
      const pieces = firstParagraph.replace(/^\s*<br\s*\/?>\s*/i, "").split(/<br\s*\/?>/i);
      const customTitle = pieces.length > 1 ? pieces.shift()?.trim() : "";
      const body = pieces.join("<br>").trim();
      const icons: Record<keyof typeof labels, string> = {
        NOTE: '<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM7.25 8v3.5h1.5V8h-1.5Z"/>',
        TIP: '<path d="M8 0a5.5 5.5 0 0 0-3.4 9.82c.38.3.65.7.73 1.15l.1.53h5.14l.1-.53c.08-.45.35-.85.73-1.15A5.5 5.5 0 0 0 8 0Zm-2 13v1h4v-1H6Z"/>',
        IMPORTANT: '<path d="M8 0a1 1 0 0 1 1 1v5.5a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1Zm0 10a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 8 10Z"/>',
        WARNING: '<path d="M7.1 1.4a1 1 0 0 1 1.8 0l6.2 12A1 1 0 0 1 14.2 15H1.8a1 1 0 0 1-.9-1.6l6.2-12ZM7.25 6v4h1.5V6h-1.5ZM8 11.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
        CAUTION: '<path d="M3.2.8h9.6l2.4 2.4v9.6l-2.4 2.4H3.2L.8 12.8V3.2L3.2.8ZM7.25 4v5h1.5V4h-1.5ZM8 10.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
      };
      const icon = `<svg class="markdown-alert-icon" viewBox="0 0 16 16" aria-hidden="true">${icons[kind]}</svg>`;
      return `<div class="markdown-alert markdown-alert-${kind.toLowerCase()}"><p class="markdown-alert-title">${icon}${customTitle || labels[kind]}</p>${body ? `<p>${body}</p>` : ""}${remainder}</div>`;
    });
}

export function renderMarkdownUnsafe(source: string, locale: "zh-CN" | "en" = "en"): RenderedMarkdown {
  const frontmatter = splitFrontmatter(source);
  const environment: { outline?: OutlineItem[]; slugs?: Map<string, number> } = {};
  // markdown-it-texmath handles dollar delimiters. Normalize the two canonical
  // LaTex delimiters before parsing so all renderers (including exports) agree.
  const mathNormalized = normalizeMath(frontmatter.body);
  let raw = renderer.render(mathNormalized, environment);
  const outline = environment.outline ?? [];
  const toc = `<nav class="table-of-contents" aria-label="${locale === "zh-CN" ? "目录" : "Table of contents"}"><ol>${outline.map((item) => `<li class="toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join("")}</ol></nav>`;
  raw = raw.replace(/<p>\s*\[TOC\]\s*<\/p>/gi, toc);
  raw = convertAlerts(convertRawRelativeImages(raw), locale);
  raw = `${frontmatterHtml(frontmatter.entries)}${raw}`;
  const maps = buildSourceMaps(source);
  const hasMermaid = /^(?:`{3,}|~{3,})\s*mermaid(?:\s|$)/im.test(source);
  const hasMath = /\$[^$]+\$|\$\$[\s\S]+?\$\$|\\\(|\\\[|```math/i.test(frontmatter.body);
  const hasHighlight = [...source.matchAll(/^\s*(?:`{3,}|~{3,})\s*([^\s`]*)/gm)]
    .some((match) => Boolean(match[1]) && !/^(?:mermaid|math)$/i.test(match[1]));
  const rtlCount = (frontmatter.body.match(/[\u0590-\u08ff]/g) ?? []).length;
  const letters = (frontmatter.body.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return {
    html: raw,
    outline,
    hasMermaid,
    hasMath,
    frontmatter: frontmatter.entries,
    optionalRenderers: [hasHighlight ? "highlight" : null, hasMath ? "katex" : null, hasMermaid ? "mermaid" : null].filter((value): value is "highlight" | "katex" | "mermaid" => Boolean(value)),
    direction: rtlCount > Math.max(4, letters * 0.3) ? "rtl" : "auto",
    ...maps,
  };
}

export function renderMarkdown(source: string, locale: "zh-CN" | "en" = "en"): RenderedMarkdown {
  return sanitizeRenderedMarkdown(renderMarkdownUnsafe(source, locale));
}

/**
 * Performs the complete, potentially expensive rendering pass without touching
 * browser-only sanitisation APIs. This is the entry point used by the render
 * worker; callers must sanitise the returned result before inserting it into a
 * document.
 */
export async function renderMarkdownEnhancedUnsafe(source: string, locale: "zh-CN" | "en" = "en"): Promise<RenderedMarkdown> {
  const result = renderMarkdownUnsafe(source, locale);
  let html = result.html;
  if (result.optionalRenderers.includes("highlight")) {
    const { highlightCode } = await import("./syntaxHighlight");
    html = html.replace(/<code\s+data-highlight-language="([^"]+)"\s+data-highlight-source="([^"]*)">[\s\S]*?<\/code>/g, (_match, language: string, encoded: string) => {
      const sourceCode = decodeURIComponent(encoded);
      return `<code class="hljs language-${escapeHtml(language)}">${highlightCode(sourceCode, language)}</code>`;
    });
  }
  if (result.optionalRenderers.includes("katex")) {
    const { renderMath } = await import("./mathRender");
    html = html.replace(/<(span|div) class="textmark-math-placeholder" data-math-display="(true|false)" data-math-source="([^"]*)"><\/\1>/g, (_match, _tag: string, display: string, encoded: string) => renderMath(decodeURIComponent(encoded), display === "true"));
  }
  return { ...result, html };
}

export async function renderMarkdownEnhanced(source: string, locale: "zh-CN" | "en" = "en"): Promise<RenderedMarkdown> {
  return sanitizeRenderedMarkdown(await renderMarkdownEnhancedUnsafe(source, locale));
}
