import { describe, expect, it } from "vitest";
import { editMarkdownTable } from "./table";

const table = `| A | B |\n| --- | --- |\n| 1 | 2 |`;

describe("editMarkdownTable", () => {
  it("adds a row after the selected data row", () => {
    expect(editMarkdownTable(table, 0, 1, 0, "addRowAfter")).toContain("\n|  |  |");
  });
  it("adds and removes columns while preserving a valid delimiter", () => {
    const added = editMarkdownTable(table, 0, 1, 0, "addColumnAfter");
    expect(added.split("\n")[1]).toBe("| --- | --- | --- |");
    expect(editMarkdownTable(added, 0, 1, 1, "deleteColumn").split("\n")[1]).toBe("| --- | --- |");
  });
});
