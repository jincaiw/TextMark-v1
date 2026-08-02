import type { FrontmatterEntry } from "../types";

export interface FrontmatterResult {
  body: string;
  entries: FrontmatterEntry[];
  raw: string | null;
}

const scalar = (value: string) => value.trim().replace(/^(["'])(.*)\1$/, "$2");

export function splitFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/^\uFEFF/, "");
  const firstLine = normalized.match(/^([^\r\n]+)(?:\r?\n|$)/)?.[1];
  if (firstLine !== "---" && firstLine !== "+++") return { body: source, entries: [], raw: null };
  const delimiter = firstLine;
  const closing = new RegExp(`^${delimiter.replace(/\+/g, "\\+")}\\s*$`, "m");
  const offset = normalized.indexOf("\n") + 1;
  const rest = normalized.slice(offset);
  const close = closing.exec(rest);
  if (!close) return { body: source, entries: [], raw: null };
  const raw = rest.slice(0, close.index).trim();
  const body = rest.slice(close.index + close[0].length).replace(/^\r?\n/, "");
  const separator = delimiter === "+++" ? "=" : ":";
  const entries = raw.split(/\r?\n/).flatMap((line) => {
    if (!line.trim() || /^\s*[#;]/.test(line)) return [];
    const index = line.indexOf(separator);
    if (index < 1) return [];
    return [{ key: line.slice(0, index).trim(), value: scalar(line.slice(index + 1)) }];
  });
  return { body, entries, raw };
}
