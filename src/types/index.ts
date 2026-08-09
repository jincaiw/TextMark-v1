export type ViewMode = "edit" | "preview";
export type Locale = "zh-CN" | "en";
export type ThemeMode = "dark" | "light" | "system";
export type SidebarMode = "outline" | "files";
export type ContentWidth = "normal" | "full";
export type SearchMode = "contains" | "beginsWith";
export type FormatCommand = "h0" | "h1" | "h2" | "h3" | "bold" | "italic" | "strikethrough" | "code" | "link" | "bulletList" | "orderedList" | "taskList" | "quote";

export interface TextDocument {
  path: string | null;
  name: string;
  contents: string;
  createdMs?: number | null;
  modifiedMs?: number | null;
  sizeBytes?: number;
  revision?: string;
}

export interface AppSettings {
  schemaVersion: 2;
  locale: Locale;
  theme: ThemeMode;
  contentWidth: ContentWidth;
  zoom: number;
  editorFontSize: number;
  toolbar: ToolbarItem[];
  defaultOpenTarget: string;
  crashReports: boolean;
  updateChannel: "stable" | "beta";
}

export interface DocumentSession extends TextDocument {
  id: string;
  savedContents: string;
  diskContents: string;
  dirty: boolean;
  scrollTop: number;
  history: NavigationEntry[];
  historyIndex: number;
}

export interface NavigationEntry {
  path: string | null;
  anchor?: string;
  scrollTop: number;
}

export interface AppError {
  code: "invalid_document" | "not_found" | "io" | "save_conflict" | "asset_outside_workspace" | "asset_unsupported" | "asset_too_large" | "invalid_path";
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
  sourceMap: SourceRange[];
  tables: TableSourceMap[];
  tasks: TaskSourceMap[];
}

export type RenderResult = RenderedMarkdown;

export interface SourceRange {
  kind: "heading" | "paragraph" | "code" | "table" | "task";
  start: number;
  end: number;
  line: number;
}

export interface TableSourceMap {
  index: number;
  startLine: number;
  endLine: number;
  rows: number;
  columns: number;
}

export interface TaskSourceMap {
  index: number;
  line: number;
  checked: boolean;
}

export interface FrontmatterEntry {
  key: string;
  value: string;
}

export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  headings: number;
  links: number;
  images: number;
}

export type ToolbarItem = "sidebar" | "openWith" | "zoom" | "inspector" | "share" | "edit" | "search" | "print" | "copy" | "export" | "flexibleSpace" | "space";
export type TableEdit = "setCell" | "addRowBefore" | "addRowAfter" | "duplicateRow" | "deleteRow" | "addColumnBefore" | "addColumnAfter" | "duplicateColumn" | "deleteColumn";

export interface TableEditRequest {
  edit: TableEdit;
  value?: string;
}

export interface ExternalApplication {
  id: string;
  name: string;
  kind: "editor" | "llm" | "system";
  available: boolean;
}
