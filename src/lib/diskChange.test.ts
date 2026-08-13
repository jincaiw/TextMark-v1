import { describe, expect, it } from "vitest";
import { eventAffectsPath, renamedDestinationInDirectory, renamedDocumentCandidate, resolveChangedDocumentPath, samePath } from "./diskChange";

describe("native disk change classification", () => {
  it("matches Windows watcher paths without case or slash sensitivity", () => {
    expect(samePath("C:\\Docs\\README.md", "c:/docs/readme.md")).toBe(true);
  });

  it("follows a supported rename in the same directory", () => {
    const event = { kind: "rename" as const, paths: ["/docs/old.md", "/docs/new.markdown"] };
    expect(eventAffectsPath(event, "/docs/old.md")).toBe(true);
    expect(renamedDocumentCandidate(event, "/docs/old.md")).toBe("/docs/new.markdown");
  });

  it("pairs split Windows rename-from and rename-to watcher events", () => {
    const from = { kind: "rename" as const, paths: ["C:\\docs\\old.md"] };
    const to = { kind: "rename" as const, paths: ["C:\\docs\\new.md"] };
    expect(renamedDocumentCandidate(from, "C:\\docs\\old.md")).toBeNull();
    expect(renamedDestinationInDirectory(to, "C:\\docs\\old.md")).toBe("C:\\docs\\new.md");
  });

  it("does not mistake temporary, unrelated or cross-directory files for a rename", () => {
    expect(renamedDocumentCandidate({ kind: "rename", paths: ["/docs/a.md", "/docs/.a.tmp"] }, "/docs/a.md")).toBeNull();
    expect(renamedDocumentCandidate({ kind: "rename", paths: ["/docs/b.md", "/docs/c.md"] }, "/docs/a.md")).toBeNull();
    expect(renamedDocumentCandidate({ kind: "rename", paths: ["/docs/a.md", "/other/a.md"] }, "/docs/a.md")).toBeNull();
  });

  it("prefers an atomic replacement at the original path over the moved inode", () => {
    const event = { kind: "rename" as const, paths: ["/docs/a.md", "/docs/moved.md"] };
    expect(resolveChangedDocumentPath("/docs/a.md", true, event)).toBe("/docs/a.md");
  });

  it("follows a rename only while the original path remains absent", () => {
    const event = { kind: "rename" as const, paths: ["/docs/a.md", "/docs/moved.md"] };
    expect(resolveChangedDocumentPath("/docs/a.md", false, event)).toBe("/docs/moved.md");
  });

  it("keeps a deletion unavailable and never treats the original descriptor as its destination", () => {
    expect(resolveChangedDocumentPath("/docs/a.md", false, { kind: "remove", paths: ["/docs/a.md"] })).toBeNull();
    expect(resolveChangedDocumentPath("/docs/a.md", false, { kind: "rename", paths: ["/docs/a.md"] })).toBeNull();
  });
});
