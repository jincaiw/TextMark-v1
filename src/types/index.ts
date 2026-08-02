export type ViewMode = "edit" | "preview";
export type Locale = "zh-CN" | "en";
export type ThemeMode = "dark" | "light" | "system";
export type SidebarMode = "outline" | "files";
export type ContentWidth = "normal" | "full";
export type FormatCommand = "h0" | "h1" | "h2" | "h3" | "bold" | "italic" | "strikethrough" | "code" | "link" | "bulletList" | "orderedList" | "taskList" | "quote";

export interface TextDocument {
  path: string | null;
  name: string;
  contents: string;
  modifiedMs?: number | null;
}

export interface AppSettings {
  locale: Locale;
  theme: ThemeMode;
  contentWidth: ContentWidth;
  zoom: number;
  editorFontSize: number;
  toolbar: ToolbarItem[];
  defaultOpenTarget: string;
  crashReports: boolean;
}

export interface DocumentSession extends TextDocument {
  savedContents: string;
  scrollTop: number;
  history: string[];
  historyIndex: number;
}

export interface AppError {
  code: "invalid_document" | "not_found" | "io" | "asset_outside_workspace" | "asset_unsupported" | "asset_too_large" | "invalid_path";
  detail?: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileNode[];
}

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

export interface RenderedMarkdown {
  html: string;
  outline: OutlineItem[];
  hasMermaid: boolean;
  hasMath: boolean;
  frontmatter: FrontmatterEntry[];
}

export interface FrontmatterEntry {
  key: string;
  value: string;
}

export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
}

export type ToolbarItem = "sidebar" | "openWith" | "zoom" | "inspector" | "share" | "edit" | "search";
export type TableEdit = "addRowBefore" | "addRowAfter" | "deleteRow" | "addColumnBefore" | "addColumnAfter" | "deleteColumn";
