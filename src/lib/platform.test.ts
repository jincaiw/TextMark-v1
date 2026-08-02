import { describe, expect, it } from "vitest";
import { parentDirectory, resolveSiblingPath } from "./platform";

describe("platform paths", () => {
  it("finds POSIX and Windows parent directories", () => {
    expect(parentDirectory("/work/docs/readme.md")).toBe("/work/docs");
    expect(parentDirectory("C:\\work\\docs\\readme.md")).toBe("C:\\work\\docs");
  });

  it("resolves relative Markdown links on every desktop platform", () => {
    expect(resolveSiblingPath("/work/docs", "../README.md")).toBe("/work/README.md");
    expect(resolveSiblingPath("C:\\work\\docs", "../README.md")).toBe("C:\\work\\README.md");
  });
});
