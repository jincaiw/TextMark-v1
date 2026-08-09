import { describe, expect, it } from "vitest";
import { editMarkdownTable } from "./table";

const table = `| A | B |\n| --- | --- |\n| 1 | 2 |`;

describe("editMarkdownTable", () => {
  it("adds a row after the selected data row", () => {
    expect(editMarkdownTable(table, 0, 1, 0, { edit: "addRowAfter" })).toContain("\n|  |  |");
  });
  it("adds and removes columns while preserving a valid delimiter", () => {
    const added = editMarkdownTable(table, 0, 1, 0, { edit: "addColumnAfter" });
    expect(added.split("\n")[1]).toBe("| --- | --- | --- |");
    expect(editMarkdownTable(added, 0, 1, 1, { edit: "deleteColumn" }).split("\n")[1]).toBe("| --- | --- |");
  });
  it("edits and duplicates cells without breaking escaped pipes", () => {
    const edited = editMarkdownTable(table, 0, 1, 0, { edit: "setCell", value: "A | B" });
    expect(edited).toContain("| A \\| B | 2 |");
    const duplicated = editMarkdownTable(edited, 0, 1, 0, { edit: "duplicateRow" });
    expect(duplicated.split("A \\| B")).toHaveLength(3);
  });
});
