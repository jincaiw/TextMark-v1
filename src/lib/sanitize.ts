import DOMPurify from "dompurify";
import type { RenderedMarkdown } from "../types";

export function sanitizeRenderedMarkdown(result: RenderedMarkdown): RenderedMarkdown {
  return {
    ...result,
    html: DOMPurify.sanitize(result.html, {
      ADD_ATTR: ["target", "rel", "data-local-src", "data-mermaid-source", "data-lines"],
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "style", "link", "meta", "base"],
      FORBID_ATTR: ["style"],
    }),
  };
}
