import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { AppError, AppSettings, ExternalApplication, FileNode, StartupRequest, TextDocument } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export const isMacos = () => typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);

export type Platform = "windows" | "linux" | "macos";

/** Resolves the host OS once; drives the CSS `[data-platform]` adapter. */
export function detectPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes("windows")) return "windows";
  if (agent.includes("linux")) return "linux";
  return "macos";
}

/** Resolves the runtime; drives the CSS `[data-runtime]` adapter. */
export function detectRuntime(): "tauri" | "browser" {
  return isTauri() ? "tauri" : "browser";
}

export async function tempExportPath(extension: string): Promise<string> {
  if (!isTauri()) return "";
  return invoke<string>("temp_export_path", { extension });
}

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

export async function readStartupRequest(): Promise<StartupRequest> {
  if (!isTauri()) return { paths: [], newWindow: false };
  return invoke<StartupRequest>("startup_request");
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

export async function refreshMenu(state: { locale: string; appearance: string; contentWidth: string; sidebarMode: string; sidebarVisible: boolean }): Promise<void> {
  if (!isTauri()) return;
  await invoke("refresh_menu", {
    locale: state.locale,
    appearance: state.appearance,
    contentWidth: state.contentWidth,
    sidebarMode: state.sidebarMode,
    sidebarVisible: state.sidebarVisible,
  });
}

export async function recordRecentFile(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("record_recent_file", { path });
}

export async function clearRecentFiles(): Promise<void> {
  if (!isTauri()) return;
  await invoke("clear_recent_files");
}

export async function writeExportBytes(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("save_export_bytes", { path, bytes: Array.from(bytes) });
}

export async function saveExportFile(defaultName: string, bytes: Uint8Array, filterName: string, extensions: string[]): Promise<boolean> {
  if (!isTauri()) return false;
  const selected = await save({ defaultPath: defaultName, filters: [{ name: filterName, extensions }] });
  if (typeof selected !== "string") return false;
  await writeExportBytes(selected, bytes);
  return true;
}

export async function discoverApplications(): Promise<ExternalApplication[]> {
  if (!isTauri()) return [
    { id: "system", name: "System Default", kind: "system", available: true },
    { id: "chatgpt", name: "ChatGPT", kind: "llm", available: true },
  ];
  return invoke<ExternalApplication[]>("discover_applications");
}

export async function loadNativeSettings(): Promise<unknown | null> {
  if (!isTauri()) return null;
  return invoke<unknown | null>("load_settings");
}

export async function saveNativeSettings(settings: AppSettings): Promise<void> {
  if (!isTauri()) return;
  await invoke("save_settings", { settings });
}

export async function watchPaths(paths: string[]): Promise<void> {
  if (!isTauri()) return;
  await invoke("watch_paths", { paths });
}

export async function openInApplication(path: string, applicationId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_external_application", { path, applicationId });
}

export async function revealInFileManager(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_in_file_manager", { path });
}

export async function openDocumentWindow(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_document_window", { path });
}

export async function installCli(): Promise<{ ok: boolean; detail: string | null }> {
  if (!isTauri()) return { ok: false, detail: null };
  return invoke<{ ok: boolean; detail: string | null }>("install_cli");
}

export async function setDefaultHandler(): Promise<{ ok: boolean; detail: string | null }> {
  if (!isTauri()) return { ok: false, detail: null };
  return invoke<{ ok: boolean; detail: string | null }>("set_default_handler");
}
