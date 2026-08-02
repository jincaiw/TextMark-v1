import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import MarkdownIt, { type MarkdownIt as MarkdownItInstance, type RendererRule } from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import texmath from "markdown-it-texmath";
import katex from "katex";
import type { OutlineItem, RenderedMarkdown } from "../types";
import { splitFrontmatter } from "./frontmatter";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("xml", xml);
// highlight.js does not ship an HCL grammar in its core distribution. Bash
// preserves comments, strings and braces safely until the optional grammar is
// available, rather than treating Terraform as untrusted raw HTML.
hljs.registerLanguage("hcl", bash);
hljs.registerLanguage("terraform", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);

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
    highlight(code, language): string {
      if (language && hljs.getLanguage(language)) {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
      }
      return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
    },
  });

  md.use(texmath, { engine: katex, delimiters: "dollars", katexOptions: { throwOnError: false } });
  md.use(footnote);
  md.use(taskLists, { enabled: true, label: true, labelAfter: true });

  const defaultFence = md.renderer.rules.fence;
  const fenceRule: RendererRule = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token.info.trim().toLowerCase() === "mermaid") {
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

  return md;
}

const renderer = makeRenderer();

export function renderMarkdown(source: string): RenderedMarkdown {
  const frontmatter = splitFrontmatter(source);
  const environment: { outline?: OutlineItem[]; slugs?: Map<string, number> } = {};
  // markdown-it-texmath handles dollar delimiters. Normalize the two canonical
  // LaTex delimiters before parsing so all renderers (including exports) agree.
  const mathNormalized = frontmatter.body
    .replace(/\\\[([\s\S]*?)\\\]/g, "$$$1$$")
    .replace(/\\\(([^\n]*?)\\\)/g, "$$1$")
    .replace(/^```math\s*\n([\s\S]*?)^```/gim, "$$$1$$");
  let raw = renderer.render(mathNormalized, environment);
  const outline = environment.outline ?? [];
  const toc = `<nav class="table-of-contents" aria-label="Table of contents"><ol>${outline.map((item) => `<li class="toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join("")}</ol></nav>`;
  raw = raw.replace(/<p>\s*\[TOC\]\s*<\/p>/gi, toc);
  raw = raw.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br>)?([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi,
    (_match, kind: string, title: string, body: string) => `<div class="markdown-alert markdown-alert-${kind.toLowerCase()}"><p class="markdown-alert-title">${kind[0]}${kind.slice(1).toLowerCase()}${title ? ` · ${title}` : ""}</p>${body}</div>`);
  const html = DOMPurify.sanitize(raw, {
    ADD_ATTR: ["target", "rel", "data-local-src", "data-mermaid-source"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "style", "link", "meta", "base"],
    FORBID_ATTR: ["style"],
  });
  return {
    html,
    outline,
    hasMermaid: source.includes("```mermaid"),
    hasMath: /\$[^$]+\$|\$\$[\s\S]+?\$\$|\\\(|\\\[|```math/i.test(frontmatter.body),
    frontmatter: frontmatter.entries,
  };
}
