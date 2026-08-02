import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("builds stable heading anchors and an outline", () => {
    const rendered = renderMarkdown("# Hello world\n\n## Hello world");
    expect(rendered.outline).toEqual([
      { id: "hello-world", text: "Hello world", level: 1 },
      { id: "hello-world-2", text: "Hello world", level: 2 },
    ]);
    expect(rendered.html).toContain('id="hello-world"');
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
});
