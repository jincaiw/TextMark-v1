import type { FrontmatterEntry } from "../types";

export interface FrontmatterResult {
  body: string;
  entries: FrontmatterEntry[];
  raw: string | null;
}

const scalar = (value: string) => value.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");

function stripYamlComment(value: string) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "\"" || character === "'") && value[index - 1] !== "\\") quote = quote === character ? "" : quote || character;
    if (character === "#" && !quote && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trimEnd();
  }
  return value;
}

function parseEntries(raw: string, delimiter: "---" | "+++"): FrontmatterEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: FrontmatterEntry[] = [];
  const separator = delimiter === "+++" ? "=" : ":";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*[#;]/.test(line)) continue;
    const boundary = line.indexOf(separator);
    if (boundary < 1 || /^\s/.test(line)) continue;
    const key = line.slice(0, boundary).trim();
    let rawValue = delimiter === "---" ? stripYamlComment(line.slice(boundary + 1)) : line.slice(boundary + 1);
    const indicator = rawValue.trim();
    if (delimiter === "---" && (indicator === ">" || indicator === "|" || /^[>|][+-]?$/.test(indicator))) {
      const block: string[] = [];
      while (index + 1 < lines.length && (/^\s+/.test(lines[index + 1]) || !lines[index + 1].trim())) block.push(lines[++index].trim());
      rawValue = indicator.startsWith(">") ? block.filter(Boolean).join(" ") : block.join("\n").trimEnd();
    }
    const items: string[] = [];
    if (delimiter === "---" && !rawValue.trim()) {
      while (index + 1 < lines.length && /^\s*-\s+/.test(lines[index + 1])) items.push(scalar(stripYamlComment(lines[++index].replace(/^\s*-\s+/, ""))));
    } else if (/^\[.*]$/.test(rawValue.trim())) {
      items.push(...rawValue.trim().slice(1, -1).split(",").map((item) => scalar(item)).filter(Boolean));
    }
    entries.push({ key, value: items.length ? items.join(", ") : scalar(rawValue), ...(items.length ? { items } : {}) });
  }
  return entries;
}

export function splitFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/^\uFEFF/, "");
  const firstLine = normalized.match(/^([^\r\n]+)(?:\r?\n|$)/)?.[1];
  if (firstLine !== "---" && firstLine !== "+++") return { body: source, entries: [], raw: null };
  const delimiter: "---" | "+++" = firstLine;
  const closing = delimiter === "---" ? /^(?:---|\.\.\.)\s*$/m : /^\+\+\+\s*$/m;
  const offset = normalized.indexOf("\n") + 1;
  const rest = normalized.slice(offset);
  const close = closing.exec(rest);
  if (!close) return { body: source, entries: [], raw: null };
  const raw = rest.slice(0, close.index).trim();
  const body = rest.slice(close.index + close[0].length).replace(/^\r?\n/, "");
  const entries = parseEntries(raw, delimiter);
  return { body, entries, raw };
}
