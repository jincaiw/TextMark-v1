import { describe, expect, it } from "vitest";
import { errorCode, parentDirectory, resolveSiblingPath } from "./platform";

describe("platform paths", () => {
  it("finds POSIX and Windows parent directories", () => {
    expect(parentDirectory("/work/docs/readme.md")).toBe("/work/docs");
    expect(parentDirectory("C:\\work\\docs\\readme.md")).toBe("C:\\work\\docs");
  });

  it("resolves relative Markdown links on every desktop platform", () => {
    expect(resolveSiblingPath("/work/docs", "../README.md")).toBe("/work/README.md");
    expect(resolveSiblingPath("C:\\work\\docs", "../README.md")).toBe("C:\\work\\README.md");
  });
  it("drops query and fragment components from sibling links", () => expect(resolveSiblingPath("/work/docs", "guide.md?raw=1#intro")).toBe("/work/docs/guide.md"));
  it("normalizes same-directory segments", () => expect(resolveSiblingPath("C:\\work\\docs", ".\\guide.md")).toBe("C:\\work\\docs\\guide.md"));
  it("extracts stable structured error codes", () => expect(errorCode({ code: "save_conflict" })).toBe("save_conflict"));
  it("extracts serialized error codes without exposing text", () => { expect(errorCode('{"code":"not_found","detail":"secret"}')).toBe("not_found"); expect(errorCode("arbitrary platform error")).toBeNull(); });
});
