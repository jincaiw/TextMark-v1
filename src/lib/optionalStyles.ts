import type { RenderedMarkdown } from "../types";

export async function loadOptionalRendererStyles(renderers: RenderedMarkdown["optionalRenderers"]) {
  await Promise.all([
    renderers.includes("highlight") ? import("highlight.js/styles/github.css") : Promise.resolve(),
    renderers.includes("katex") ? import("katex/dist/katex.min.css") : Promise.resolve(),
  ]);
}
