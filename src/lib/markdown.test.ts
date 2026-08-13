import { describe, expect, it } from "vitest";
import { renderMarkdown, renderMarkdownEnhanced, renderMarkdownUnsafe } from "./markdown";
import { SAMPLE_MARKDOWN } from "../constants";

describe("renderMarkdown", () => {
  it("enhances the full welcome document without dropping the render", async () => {
    const rendered = await renderMarkdownEnhanced(SAMPLE_MARKDOWN, "zh-CN");
    expect(rendered.html).toContain("Welcome to TextMark");
    expect(rendered.html).toContain("katex");
    expect(rendered.html).toContain("hljs-keyword");
    expect(rendered.hasMermaid).toBe(true);
  });
  it("builds stable heading anchors and an outline", () => {
    const rendered = renderMarkdown("# Hello world\n\n## Hello world");
    expect(rendered.outline).toEqual([
      { id: "hello-world", text: "Hello world", level: 1 },
      { id: "hello-world-2", text: "Hello world", level: 2 },
    ]);
    expect(rendered.html).toContain('id="hello-world"');
  });

  it("reuses only the latest identical immutable render", () => {
    const first = renderMarkdownUnsafe("# Cached", "zh-CN");
    expect(renderMarkdownUnsafe("# Cached", "zh-CN")).toBe(first);
    expect(renderMarkdownUnsafe("# Changed", "zh-CN")).not.toBe(first);
    expect(renderMarkdownUnsafe("# Changed", "en")).not.toBe(first);
  });

  it("removes executable HTML and inline styles", () => {
    const rendered = renderMarkdown('<script>alert(1)</script><img src="x" onerror="alert(1)" style="display:none">');
    expect(rendered.html).not.toContain("script");
    expect(rendered.html).not.toContain("onerror");
    expect(rendered.html).not.toContain("style=");
  });

  it("marks relative images for guarded desktop hydration", () => {
    const rendered = renderMarkdown("![diagram](images/diagram.png)");
    expect(rendered.html).toContain('data-local-src="images/diagram.png"');
    expect(rendered.html).toContain('src=""');
  });

  it("defers Mermaid diagrams to the preview renderer", () => {
    const rendered = renderMarkdown("```mermaid\nflowchart LR\nA-->B\n```");
    expect(rendered.hasMermaid).toBe(true);
    expect(rendered.html).toContain("data-mermaid-source");
  });

  it("renders footnotes, task lists, alerts and generated TOC", () => {
    const rendered = renderMarkdown("# Guide\n\n[TOC]\n\n- [x] Done\n\nText[^1]\n\n[^1]: Note\n\n> [!NOTE]\n> Useful");
    expect(rendered.html).toContain("table-of-contents");
    expect(rendered.html).toContain("task-list-item-checkbox");
    expect(rendered.html).toContain("footnote");
    expect(rendered.html).toContain("markdown-alert-note");
  });

  it("extracts YAML and TOML frontmatter from the rendered body", () => {
    const rendered = renderMarkdown("---\ntitle: Demo\ntags: docs\n---\n# Body");
    expect(rendered.frontmatter).toEqual([{ key: "title", value: "Demo" }, { key: "tags", value: "docs" }]);
    expect(rendered.html).not.toContain("title: Demo");
  });

  it("maps task and table source locations for source-aware editing", () => {
    const rendered = renderMarkdown("# Title\n\n- [x] done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(rendered.tasks).toEqual([{ index: 0, line: 3, checked: true }]);
    expect(rendered.tables[0]).toMatchObject({ startLine: 5, endLine: 7, rows: 2, columns: 2 });
    expect(rendered.sourceMap.map((entry) => entry.kind)).toEqual(["heading", "task", "table"]);
  });

  it("renders canonical LaTeX delimiters but keeps code literal", async () => {
    const rendered = await renderMarkdownEnhanced("\\(x + y\\) and `\\(literal\\)`\n\n\\[z^2\\]");
    expect(rendered.html).toContain("katex");
    expect(rendered.html).toContain("\\(literal\\)");
  });

  it("uses a real HCL grammar for Terraform fences", async () => {
    const rendered = await renderMarkdownEnhanced("```terraform\nresource \"aws_s3_bucket\" \"example\" { enabled = true }\n```");
    expect(rendered.html).toContain("hljs-keyword");
    expect(rendered.html).toContain("hljs-attr");
  });
});
