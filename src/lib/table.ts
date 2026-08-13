import type { TableEditRequest, TableSourceMap } from "../types";

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
const serializeRow = (cells: string[]) => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
const isDelimiter = (line: string) => splitRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));

interface TableRange { start: number; end: number; }

export function editableMarkdownTables(root: ParentNode): HTMLTableElement[] {
  return Array.from(root.querySelectorAll("table")).filter((table) => !table.closest(".md-frontmatter"));
}

export function synchronizeTableHeaderAccessibility(root: ParentNode, label: (column: number) => string): void {
  for (const table of editableMarkdownTables(root)) {
    Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).forEach((header, index) => {
      header.dataset.tableColumn = String(index);
      if (header.textContent?.trim()) {
        header.removeAttribute("data-placeholder");
        header.removeAttribute("aria-label");
      } else {
        const placeholder = label(index + 1);
        header.dataset.placeholder = placeholder;
        header.setAttribute("aria-label", placeholder);
      }
    });
  }
}

export function synchronizeTableSourceCoordinates(root: ParentNode, maps: TableSourceMap[]): void {
  editableMarkdownTables(root).forEach((table, tableIndex) => {
    const map = maps[tableIndex];
    if (!map) return;
    const rows = Array.from(table.querySelectorAll("tr"));
    for (const source of map.cells) {
      const cell = rows[source.row]?.querySelectorAll<HTMLTableCellElement>("th, td")[source.column];
      if (!cell) continue;
      cell.dataset.tableRow = String(source.row);
      cell.dataset.tableColumn = String(source.column);
      cell.dataset.tableMarkdown = source.markdown;
    }
  });
}

function tableRanges(lines: string[]): TableRange[] {
  const ranges: TableRange[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|") || !isDelimiter(lines[index + 1])) continue;
    let end = index + 2;
    while (end < lines.length && lines[end].includes("|") && lines[end].trim()) end += 1;
    ranges.push({ start: index, end });
    index = end - 1;
  }
  return ranges;
}

export function editMarkdownTable(source: string, tableIndex: number, rowIndex: number, columnIndex: number, request: TableEditRequest): string {
  const lines = source.split(/\r?\n/);
  const range = tableRanges(lines)[tableIndex];
  if (!range) return source;
  const delimiter = splitRow(lines[range.start + 1]);
  const rows = [splitRow(lines[range.start]), ...lines.slice(range.start + 2, range.end).map(splitRow)];
  const columns = Math.max(delimiter.length, ...rows.map((row) => row.length));
  rows.forEach((row) => { while (row.length < columns) row.push(""); });
  while (delimiter.length < columns) delimiter.push("---");

  const { edit } = request;
  if (edit === "setCell") {
    if (rowIndex >= 0 && rowIndex < rows.length && columnIndex >= 0 && columnIndex < columns) rows[rowIndex][columnIndex] = request.value ?? "";
  } else if (edit === "addRowBefore" || edit === "addRowAfter") {
    const target = Math.max(1, Math.min(rowIndex + (edit === "addRowAfter" ? 1 : 0), rows.length));
    rows.splice(target, 0, Array(columns).fill(""));
  } else if (edit === "duplicateRow") {
    if (rowIndex > 0 && rowIndex < rows.length) rows.splice(rowIndex + 1, 0, [...rows[rowIndex]]);
  } else if (edit === "deleteRow") {
    if (rowIndex > 0 && rowIndex < rows.length) rows.splice(rowIndex, 1);
  } else if (edit === "addColumnBefore" || edit === "addColumnAfter") {
    const target = Math.max(0, Math.min(columnIndex + (edit === "addColumnAfter" ? 1 : 0), columns));
    rows.forEach((row) => row.splice(target, 0, ""));
    delimiter.splice(target, 0, "---");
  } else if (edit === "duplicateColumn" && columnIndex >= 0 && columnIndex < columns) {
    rows.forEach((row) => row.splice(columnIndex + 1, 0, row[columnIndex]));
    delimiter.splice(columnIndex + 1, 0, delimiter[columnIndex] ?? "---");
  } else if (edit === "deleteColumn" && columns > 1 && columnIndex >= 0 && columnIndex < columns) {
    rows.forEach((row) => row.splice(columnIndex, 1));
    delimiter.splice(columnIndex, 1);
  }
  const replacement = [serializeRow(rows[0]), serializeRow(delimiter), ...rows.slice(1).map(serializeRow)];
  lines.splice(range.start, range.end - range.start, ...replacement);
  return lines.join("\n");
}
