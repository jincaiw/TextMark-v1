import { invoke } from "@tauri-apps/api/core";
import type { AppError, ExternalApplication, FileNode, TextDocument } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export function errorCode(error: unknown): AppError["code"] | null {
  if (typeof error === "object" && error && "code" in error) return (error as AppError).code;
  try {
    const parsed = JSON.parse(String(error)) as Partial<AppError>;
    return parsed.code ?? null;
  } catch { return null; }
}

export function parentDirectory(path: string | null): string | null {
  if (!path) return null;
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : null;
}

export function resolveSiblingPath(baseDirectory: string, relativePath: string): string {
  const separator = baseDirectory.includes("\\") ? "\\" : "/";
  const normalizedRelative = relativePath.split(/[?#]/)[0].replace(/\//g, separator);
  const prefix = baseDirectory.endsWith(separator) ? baseDirectory : `${baseDirectory}${separator}`;
  const parts = `${prefix}${normalizedRelative}`.split(/[\\/]+/);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part && part !== ".") resolved.push(part);
  }
  const drive = /^[A-Za-z]:/.test(resolved[0] ?? "") ? "" : separator;
  return `${drive}${resolved.join(separator)}`;
}

export async function readDocument(path: string): Promise<TextDocument> {
  return invoke<TextDocument>("read_text_file", { path });
}

export async function readStartupDocuments(): Promise<TextDocument[]> {
  if (!isTauri()) return [];
  return invoke<TextDocument[]>("startup_documents");
}

export async function writeDocument(path: string, contents: string, expectedRevision?: string, force = false): Promise<TextDocument> {
  return invoke<TextDocument>("write_text_file", { path, contents, expectedRevision, force });
}

export async function scanFolder(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("list_directory", { path });
}

export async function loadLocalAsset(baseDir: string, relativePath: string, workspaceRoot?: string | null): Promise<string> {
  return invoke<string>("read_local_asset", { baseDir, relativePath, workspaceRoot: workspaceRoot ?? null });
}

export async function setNativeMenuLocale(locale: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_menu_locale", { locale });
}

export async function discoverApplications(): Promise<ExternalApplication[]> {
  if (!isTauri()) return [
    { id: "system", name: "System Default", kind: "system", available: true },
    { id: "chatgpt", name: "ChatGPT", kind: "llm", available: true },
  ];
  return invoke<ExternalApplication[]>("discover_applications");
}
