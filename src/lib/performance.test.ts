import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("render performance budget", () => {
  it("renders a one-megabyte prose document within the cold budget", () => {
    const paragraph = "TextMark keeps large Markdown documents responsive while preserving readable typography and navigation.\n\n";
    const source = `# Large document\n\n${paragraph.repeat(Math.ceil(1_000_000 / paragraph.length))}`;
    const start = performance.now();
    const result = renderMarkdown(source);
    const duration = performance.now() - start;
    expect(result.html.length).toBeGreaterThan(900_000);
    expect(duration).toBeLessThan(1_500);
  }, 5_000);
});
