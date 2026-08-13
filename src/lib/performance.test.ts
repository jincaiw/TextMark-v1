import { describe, expect, it } from "vitest";
import { renderMarkdownUnsafe } from "./markdown";

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe("renderer performance budgets", () => {
  it("parses a one MiB plain-text document in under 1.5 seconds", () => {
    const line = "TextMark keeps large Markdown documents responsive and offline.\n";
    const source = line.repeat(Math.ceil((1024 * 1024) / line.length)).slice(0, 1024 * 1024);
    const start = performance.now();
    const result = renderMarkdownUnsafe(source, "zh-CN");
    const duration = performance.now() - start;
    expect(result.html.length).toBeGreaterThan(1024 * 1024);
    expect(duration).toBeLessThan(1_500);
  });

  it("keeps a warm 250 KiB mixed-document parse below 250 ms", () => {
    const section = "## Heading\n\n- [ ] task\n- item with **bold** and [link](next.md)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst value = 42\n```\n\n";
    const source = section.repeat(Math.ceil((250 * 1024) / section.length)).slice(0, 250 * 1024);
    renderMarkdownUnsafe(source, "zh-CN");
    const durations = Array.from({ length: 3 }, () => {
      const start = performance.now();
      renderMarkdownUnsafe(source, "zh-CN");
      return performance.now() - start;
    });
    expect(median(durations)).toBeLessThan(250);
  });
});
