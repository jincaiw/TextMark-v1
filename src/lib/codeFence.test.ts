import { describe, expect, it } from "vitest";
import { parseCodeFenceInfo } from "./codeFence";

describe("upstream CodeFenceInfo parity", () => {
  it.each([
    ["Swift", "swift", ""],
    ["mermaid some-name", "mermaid", "some-name"],
    ["ts\ttitle=\"foo.ts\"", "ts", "title=\"foo.ts\""],
    ["ts  Title=\"Foo Bar\"  {1,3}", "ts", "Title=\"Foo Bar\"  {1,3}"],
    ["   mermaid   some-name   ", "mermaid", "some-name"],
    [null, "", ""],
    ["", "", ""],
    ["   \t  ", "", ""],
  ] as const)("parses %s", (raw, language, metadata) => {
    expect(parseCodeFenceInfo(raw)).toMatchObject({ language, metadata });
  });

  it("normalizes every shell alias to the bash highlighter", () => {
    for (const alias of ["shell", "sh", "zsh", "console", "bash"]) expect(parseCodeFenceInfo(alias).highlightLanguage).toBe("bash");
    expect(parseCodeFenceInfo("swift").highlightLanguage).toBe("swift");
  });
});
