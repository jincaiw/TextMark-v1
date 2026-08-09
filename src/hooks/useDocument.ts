import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { MARKDOWN_FILTERS, SAMPLE_MARKDOWN } from "../constants";
import { errorCode, isTauri, parentDirectory, readDocument, readStartupDocuments, resolveSiblingPath, scanFolder, writeDocument } from "../lib/platform";
import type { DocumentSession, FileNode, Locale, TextDocument } from "../types";

const sessionId = () => globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makeSession(document: TextDocument): DocumentSession {
  return {
    ...document,
    id: sessionId(),
    savedContents: document.contents,
    diskContents: document.contents,
    dirty: false,
    scrollTop: 0,
    history: [{ path: document.path, scrollTop: 0 }],
    historyIndex: 0,
  };
}

const initialSession = makeSession({ path: null, name: "README.md", contents: SAMPLE_MARKDOWN });

const messages = {
  "zh-CN": {
    invalid_document: "此文件不是受支持的 Markdown 或文本文件。",
    not_found: "文件或文件夹不存在。",
    io: "无法读取或写入此文件。",
    save_conflict: "文件已被其他应用修改，请选择重新加载或强制覆盖。",
    invalid_path: "所选路径无效。",
    asset_outside_workspace: "资源路径超出允许范围。",
    asset_unsupported: "不支持此本地图片格式。",
    asset_too_large: "本地图片超过 8 MB 限制。",
    folderDesktopOnly: "文件夹浏览仅在 TextMark 桌面版中可用。",
    saved: "已保存",
    closeDirty: "此文档有未保存的更改，仍要关闭吗？",
  },
  en: {
    invalid_document: "This is not a supported Markdown or text document.",
    not_found: "The file or folder no longer exists.",
    io: "TextMark could not read or write this file.",
    save_conflict: "Another app changed this file. Reload it or overwrite the disk version.",
    invalid_path: "The selected path is invalid.",
    asset_outside_workspace: "The asset path is outside the allowed scope.",
    asset_unsupported: "This local image format is not supported.",
    asset_too_large: "The local image exceeds the 8 MB limit.",
    folderDesktopOnly: "Folder browsing is available in the TextMark desktop app.",
    saved: "Saved",
    closeDirty: "This document has unsaved changes. Close it anyway?",
  },
} as const;

function browserOpen(): Promise<TextDocument | null> {
  return new Promise((resolve) => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".md,.markdown,.mdown,.mkd,.mkdn,.mdwn,.mdtxt,.mdtext,.rmd,.txt,text/markdown,text/plain";
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file) return resolve(null);
      resolve({ path: null, name: file.name, contents: await file.text(), modifiedMs: file.lastModified, sizeBytes: file.size });
    });
    picker.click();
  });
}

function browserSave(name: string, contents: string) {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useDocument(locale: Locale) {
  const [sessions, setSessions] = useState<DocumentSession[]>([initialSession]);
  const [activeId, setActiveId] = useState(initialSession.id);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [externalChange, setExternalChange] = useState<TextDocument | null>(null);
  const undoRef = useRef(new Map<string, { undo: string[]; redo: string[] }>());
  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];

  const updateActive = useCallback((update: (session: DocumentSession) => DocumentSession) => {
    setSessions((current) => current.map((session) => session.id === activeId ? update(session) : session));
  }, [activeId]);

  const showError = useCallback((error: unknown) => {
    const code = errorCode(error) ?? "io";
    setNotice(messages[locale][code] ?? messages[locale].io);
  }, [locale]);

  const applyDocument = useCallback((next: TextDocument, newTab = true) => {
    setExternalChange(null);
    setNotice(null);
    setSessions((current) => {
      const existing = next.path ? current.find((session) => session.path === next.path) : undefined;
      if (existing) {
        setActiveId(existing.id);
        return current.map((session) => session.id === existing.id ? { ...makeSession(next), id: existing.id } : session);
      }
      const session = makeSession(next);
      setActiveId(session.id);
      if (!newTab && current.length === 1 && !current[0].path && !current[0].dirty) return [session];
      return [...current, session];
    });
  }, []);

  useEffect(() => {
    void readStartupDocuments().then((startup) => startup.forEach((document, index) => applyDocument(document, index > 0)));
  }, [applyDocument]);

  useEffect(() => {
    if (!active?.path || !isTauri()) return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await readDocument(active.path!);
        if (!latest.revision || latest.revision === active.revision) return;
        if (active.dirty) setExternalChange(latest);
        else updateActive((current) => ({ ...current, ...latest, savedContents: latest.contents, diskContents: latest.contents, dirty: false }));
      } catch { /* Atomic replacement may briefly hide the path; retry on the next tick. */ }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [active?.dirty, active?.path, active?.revision, updateActive]);

  const openPath = useCallback(async (path: string, newTab = false) => {
    if (!isTauri()) return;
    setBusy(true);
    try { applyDocument(await readDocument(path), newTab); }
    catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [applyDocument, showError]);

  const navigatePath = useCallback(async (path: string, scrollTop = 0) => {
    if (!isTauri() || !active) return;
    setBusy(true);
    try {
      const next = await readDocument(path);
      setSessions((current) => current.map((session) => {
        if (session.id !== active.id) return session;
        const history = session.history.slice(0, session.historyIndex + 1);
        history[session.historyIndex] = { ...history[session.historyIndex], scrollTop };
        history.push({ path: next.path, scrollTop: 0 });
        return { ...session, ...next, savedContents: next.contents, diskContents: next.contents, dirty: false, scrollTop: 0, history, historyIndex: history.length - 1 };
      }));
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [active, showError]);

  const moveNavigation = useCallback(async (direction: -1 | 1, scrollTop = 0) => {
    if (!active || !isTauri()) return;
    const targetIndex = active.historyIndex + direction;
    const target = active.history[targetIndex];
    if (!target?.path) return;
    setBusy(true);
    try {
      const next = await readDocument(target.path);
      setSessions((current) => current.map((session) => {
        if (session.id !== active.id) return session;
        const history = [...session.history];
        history[session.historyIndex] = { ...history[session.historyIndex], scrollTop };
        return { ...session, ...next, savedContents: next.contents, diskContents: next.contents, dirty: false, scrollTop: target.scrollTop, history, historyIndex: targetIndex };
      }));
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [active, showError]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void listen<string[]>("open-paths", (event) => {
      void Promise.all(event.payload.map((path) => readDocument(path))).then((documents) => documents.forEach((document) => applyDocument(document, true))).catch(showError);
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [applyDocument, showError]);

  const openFile = useCallback(async () => {
    setBusy(true);
    try {
      if (!isTauri()) {
        const selected = await browserOpen();
        if (selected) applyDocument(selected, true);
        return;
      }
      const selected = await open({ multiple: true, directory: false, filters: MARKDOWN_FILTERS });
      const paths = typeof selected === "string" ? [selected] : selected ?? [];
      for (const path of paths) applyDocument(await readDocument(path), true);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [applyDocument, showError]);

  const openFolder = useCallback(async () => {
    if (!isTauri()) { setNotice(messages[locale].folderDesktopOnly); return; }
    setBusy(true);
    try {
      const selected = await open({ multiple: false, directory: true });
      if (typeof selected !== "string") return;
      setWorkspacePath(selected);
      const nextFiles = await scanFolder(selected);
      setFiles(nextFiles);
      const firstFile = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (!node.isDirectory) return node;
          const nested = firstFile(node.children);
          if (nested) return nested;
        }
        return null;
      };
      const first = firstFile(nextFiles);
      if (first) applyDocument(await readDocument(first.path), false);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [applyDocument, locale, showError]);

  const saveAs = useCallback(async () => {
    if (!active) return;
    if (!isTauri()) {
      browserSave(active.name, active.contents);
      updateActive((current) => ({ ...current, savedContents: current.contents, diskContents: current.contents, dirty: false }));
      return;
    }
    setBusy(true);
    try {
      const selected = await save({ defaultPath: active.path ?? active.name, filters: MARKDOWN_FILTERS });
      if (typeof selected !== "string") return;
      const saved = await writeDocument(selected, active.contents, undefined, true);
      updateActive((current) => ({ ...current, ...saved, savedContents: saved.contents, diskContents: saved.contents, dirty: false }));
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [active, showError, updateActive]);

  const saveFile = useCallback(async (force = false) => {
    if (!active?.path || !isTauri()) return saveAs();
    setBusy(true);
    try {
      const saved = await writeDocument(active.path, active.contents, active.revision, force);
      updateActive((current) => ({ ...current, ...saved, savedContents: saved.contents, diskContents: saved.contents, dirty: false }));
      setExternalChange(null);
      setNotice(messages[locale].saved);
      window.setTimeout(() => setNotice(null), 1400);
    } catch (error) {
      if (errorCode(error) === "save_conflict") {
        try { setExternalChange(await readDocument(active.path)); } catch { showError(error); }
      } else showError(error);
    } finally { setBusy(false); }
  }, [active, locale, saveAs, showError, updateActive]);

  const updateContents = useCallback((contents: string) => {
    updateActive((current) => ({ ...current, contents, dirty: contents !== current.savedContents }));
  }, [updateActive]);

  const applyEdit = useCallback((contents: string) => {
    if (!active || contents === active.contents) return;
    const history = undoRef.current.get(active.id) ?? { undo: [], redo: [] };
    history.undo.push(active.contents);
    history.redo = [];
    undoRef.current.set(active.id, history);
    updateContents(contents);
  }, [active, updateContents]);

  const moveHistory = useCallback((direction: "undo" | "redo") => {
    if (!active) return;
    const history = undoRef.current.get(active.id);
    if (!history?.[direction].length) return;
    const next = history[direction].pop()!;
    history[direction === "undo" ? "redo" : "undo"].push(active.contents);
    updateContents(next);
  }, [active, updateContents]);

  const closeSession = useCallback((id: string) => {
    const target = sessions.find((session) => session.id === id);
    if (target?.dirty && !window.confirm(messages[locale].closeDirty)) return;
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== id);
      if (remaining.length) return remaining;
      const blank = makeSession({ path: null, name: "README.md", contents: "" });
      setActiveId(blank.id);
      return [blank];
    });
    if (id === activeId) {
      const next = sessions.find((session) => session.id !== id);
      if (next) setActiveId(next.id);
    }
  }, [activeId, locale, sessions]);

  const resolveExternal = useCallback((choice: "reload" | "overwrite" | "cancel") => {
    if (choice === "reload" && externalChange) {
      updateActive((current) => ({ ...current, ...externalChange, savedContents: externalChange.contents, diskContents: externalChange.contents, dirty: false }));
      setExternalChange(null);
    }
    else if (choice === "overwrite") void saveFile(true);
    else setExternalChange(null);
  }, [externalChange, saveFile, updateActive]);

  const baseDirectory = useMemo(() => parentDirectory(active?.path ?? null), [active?.path]);
  const openRelative = useCallback(async (relativePath: string, scrollTop = 0) => {
    if (!baseDirectory || !isTauri()) return;
    await navigatePath(resolveSiblingPath(baseDirectory, relativePath), scrollTop);
  }, [baseDirectory, navigatePath]);

  const activate = useCallback((id: string, scrollTop = 0) => {
    setSessions((current) => current.map((session) => session.id === activeId ? { ...session, scrollTop } : session));
    setActiveId(id);
  }, [activeId]);

  return {
    document: active,
    sessions,
    activeId,
    isDirty: active?.dirty ?? false,
    baseDirectory,
    workspacePath,
    files,
    busy,
    notice,
    externalChange,
    activate,
    closeSession,
    resolveExternal,
    updateContents,
    applyEdit,
    undo: () => moveHistory("undo"),
    redo: () => moveHistory("redo"),
    openFile,
    openFolder,
    openPath,
    openRelative,
    canGoBack: (active?.historyIndex ?? 0) > 0,
    canGoForward: Boolean(active && active.historyIndex < active.history.length - 1),
    goBack: (scrollTop?: number) => moveNavigation(-1, scrollTop),
    goForward: (scrollTop?: number) => moveNavigation(1, scrollTop),
    saveFile,
    saveAs,
  };
}
