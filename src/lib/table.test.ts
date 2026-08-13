import { describe, expect, it } from "vitest";
import { editableMarkdownTables, editMarkdownTable, synchronizeTableHeaderAccessibility, synchronizeTableSourceCoordinates } from "./table";

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
  it("adds a row before the selected data row", () => expect(editMarkdownTable(table, 0, 1, 0, { edit: "addRowBefore" }).split("\n")[2]).toBe("|  |  |"));
  it("duplicates the selected data row", () => expect(editMarkdownTable(table, 0, 1, 0, { edit: "duplicateRow" }).match(/\| 1 \| 2 \|/g)).toHaveLength(2));
  it("deletes a selected data row", () => expect(editMarkdownTable(table, 0, 1, 0, { edit: "deleteRow" })).not.toContain("| 1 | 2 |"));
  it("never deletes the header row", () => expect(editMarkdownTable(table, 0, 0, 0, { edit: "deleteRow" })).toBe(table));
  it("adds a column before the selected column", () => expect(editMarkdownTable(table, 0, 1, 0, { edit: "addColumnBefore" }).split("\n")[0]).toBe("|  | A | B |"));
  it("duplicates a column and its alignment marker", () => { const source = "| A | B |\n| :--- | ---: |\n| 1 | 2 |"; const next = editMarkdownTable(source, 0, 1, 1, { edit: "duplicateColumn" }); expect(next.split("\n")[1]).toBe("| :--- | ---: | ---: |"); });
  it("will not delete the last remaining column", () => { const source = "| A |\n| --- |\n| 1 |"; expect(editMarkdownTable(source, 0, 1, 0, { edit: "deleteColumn" })).toBe(source); });
  it("edits the selected table when several exist", () => { const source = `${table}\n\n${table}`; const next = editMarkdownTable(source, 1, 1, 1, { edit: "setCell", value: "second" }); expect(next.indexOf("second")).toBeGreaterThan(next.indexOf(table)); });
  it("leaves the source unchanged for a missing table", () => expect(editMarkdownTable(table, 10, 1, 1, { edit: "setCell", value: "x" })).toBe(table));
  it("does not count the rendered frontmatter table in source-table coordinates", () => {
    const root = document.createElement("article");
    root.innerHTML = '<section class="md-frontmatter"><table><tbody><tr><td>meta</td></tr></tbody></table></section><table><tbody><tr><td>source</td></tr></tbody></table>';
    expect(editableMarkdownTables(root)).toHaveLength(1);
    expect(editableMarkdownTables(root)[0].textContent).toBe("source");
  });
  it("keeps empty editable headers accessible without touching metadata headers", () => {
    const root = document.createElement("article");
    root.innerHTML = '<section class="md-frontmatter"><table><thead><tr><th></th></tr></thead></table></section><table><thead><tr><th></th><th>Name</th></tr></thead></table>';
    synchronizeTableHeaderAccessibility(root, (column) => `Column ${column}`);
    const headers = root.querySelectorAll("th");
    expect(headers[0].hasAttribute("data-table-column")).toBe(false);
    expect(headers[1].dataset.placeholder).toBe("Column 1");
    expect(headers[1].getAttribute("aria-label")).toBe("Column 1");
    expect(headers[2].hasAttribute("aria-label")).toBe(false);
  });
  it("delegates stable source coordinates without counting the frontmatter table", () => {
    const root = document.createElement("article");
    root.innerHTML = '<section class="md-frontmatter"><table><tr><td>meta</td></tr></table></section><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>one</td></tr></tbody></table>';
    synchronizeTableSourceCoordinates(root, [{ index: 0, startLine: 5, endLine: 7, rows: 2, columns: 1, cells: [{ row: 0, column: 0, markdown: "A" }, { row: 1, column: 0, markdown: "one" }] }]);
    const sourceTable = editableMarkdownTables(root)[0];
    expect(sourceTable.querySelector("th")?.dataset).toMatchObject({ tableRow: "0", tableColumn: "0", tableMarkdown: "A" });
    expect(sourceTable.querySelector("td")?.dataset.tableMarkdown).toBe("one");
  });
});
