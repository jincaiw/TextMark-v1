import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { MARKDOWN_FILTERS, SAMPLE_MARKDOWN } from "../constants";
import { eventAffectsPath, renamedDestinationInDirectory, resolveChangedDocumentPath } from "../lib/diskChange";
import { errorCode, isTauri, openDocumentWindow, parentDirectory, readDocument, readStartupRequest, resolveSiblingPath, scanFolder, watchPaths, writeDocument } from "../lib/platform";
import type { DiskChangeEvent, DocumentSession, ExternalChangeResolution, ExternalDocumentChange, FileNode, Locale, OpenPathRequest, TextDocument } from "../types";

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
  const [externalChange, setExternalChange] = useState<ExternalDocumentChange | null>(null);
  const undoRef = useRef(new Map<string, { undo: string[]; redo: string[] }>());
  const pendingRenameRef = useRef<{ originalPath: string; candidate: string | null } | null>(null);
  const startupLoadedRef = useRef(false);
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

  const openFolderPath = useCallback(async (path: string) => {
    setWorkspacePath(path);
    const nextFiles = await scanFolder(path);
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
  }, [applyDocument]);

  useEffect(() => {
    if (startupLoadedRef.current) return;
    startupLoadedRef.current = true;
    const parameters = new URLSearchParams(window.location.search);
    const requestedFile = parameters.get("open");
    const requestedFolder = parameters.get("folder");
    if (requestedFile && isTauri()) {
      void readDocument(requestedFile).then((document) => applyDocument(document, false)).catch(showError);
      return;
    }
    if (requestedFolder && isTauri()) {
      void openFolderPath(requestedFolder).catch(showError);
      return;
    }
    void readStartupRequest().then(async (startup) => {
      for (const [index, entry] of startup.paths.entries()) {
        if (startup.newWindow && index > 0) { await openDocumentWindow(entry.path); continue; }
        if (entry.isDirectory) await openFolderPath(entry.path);
        else applyDocument(await readDocument(entry.path), index > 0);
      }
    }).catch(showError);
  }, [applyDocument, openFolderPath, showError]);

  useEffect(() => {
    if (!isTauri()) return;
    const watched = [active?.path, workspacePath].filter((path): path is string => Boolean(path));
    void watchPaths(watched).catch(showError);
    let unlisten: (() => void) | undefined;
    let documentTimer = 0;
    let workspaceTimer = 0;
    void listen<DiskChangeEvent>("disk-change", (event) => {
      if (active?.path && event.payload.kind === "rename") {
        const candidate = renamedDestinationInDirectory(event.payload, active.path);
        if (eventAffectsPath(event.payload, active.path)) pendingRenameRef.current = { originalPath: active.path, candidate };
        else if (candidate && pendingRenameRef.current?.originalPath === active.path) pendingRenameRef.current.candidate = candidate;
      }
      if (active?.path && eventAffectsPath(event.payload, active.path)) {
        window.clearTimeout(documentTimer);
        documentTimer = window.setTimeout(async () => {
          const originalPath = active.path!;
          try {
            let latest: TextDocument | null = null;
            for (let attempt = 0; attempt < 4; attempt += 1) {
              try {
                latest = await readDocument(originalPath);
                break;
              } catch (error) {
                if (errorCode(error) !== "not_found") throw error;
                if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 65));
              }
            }
            if (!latest) {
              const pending = pendingRenameRef.current?.originalPath === originalPath ? pendingRenameRef.current.candidate : null;
              const candidate = resolveChangedDocumentPath(originalPath, false, event.payload, pending);
              pendingRenameRef.current = null;
              if (candidate) {
                try {
                  const moved = await readDocument(candidate);
                  if (active.dirty) setExternalChange({ kind: "renamed", document: moved, previousPath: originalPath });
                  else updateActive((current) => {
                    const history = [...current.history];
                    history[current.historyIndex] = { ...history[current.historyIndex], path: moved.path };
                    return { ...current, ...moved, savedContents: moved.contents, diskContents: moved.contents, dirty: false, history };
                  });
                  return;
                } catch (error) {
                  if (errorCode(error) !== "not_found") throw error;
                }
              }
              setExternalChange({ kind: "deleted", previousPath: originalPath });
              return;
            }
            pendingRenameRef.current = null;
            if (!latest.revision || latest.revision === active.revision) return;
            if (active.dirty) setExternalChange({ kind: "modified", document: latest });
            else updateActive((current) => ({ ...current, ...latest, savedContents: latest.contents, diskContents: latest.contents, dirty: false }));
          } catch (error) { showError(error); }
        }, 160);
      }
      if (workspacePath) {
        window.clearTimeout(workspaceTimer);
        workspaceTimer = window.setTimeout(() => { void scanFolder(workspacePath).then(setFiles).catch(showError); }, 180);
      }
    }).then((dispose) => { unlisten = dispose; });
    return () => {
      unlisten?.();
      window.clearTimeout(documentTimer);
      window.clearTimeout(workspaceTimer);
    };
  }, [active?.dirty, active?.path, active?.revision, showError, updateActive, workspacePath]);

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
    void listen<OpenPathRequest[]>("open-paths", (event) => {
      void (async () => {
        for (const entry of event.payload) {
          if (entry.isDirectory) await openFolderPath(entry.path);
          else applyDocument(await readDocument(entry.path), true);
        }
      })().catch(showError);
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [applyDocument, openFolderPath, showError]);

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
      await openFolderPath(selected);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }, [locale, openFolderPath, showError]);

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
      setExternalChange(null);
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
        try { setExternalChange({ kind: "modified", document: await readDocument(active.path) }); }
        catch (readError) {
          if (errorCode(readError) === "not_found") setExternalChange({ kind: "deleted", previousPath: active.path });
          else showError(error);
        }
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

  const newDocument = useCallback(() => {
    const blank = makeSession({ path: null, name: locale === "zh-CN" ? "未命名.md" : "Untitled.md", contents: "" });
    setSessions((current) => [...current, blank]);
    setActiveId(blank.id);
  }, [locale]);

  const revertDocument = useCallback(() => {
    updateActive((current) => ({ ...current, contents: current.savedContents, dirty: false }));
    setExternalChange(null);
  }, [updateActive]);

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

  const resolveExternal = useCallback((choice: ExternalChangeResolution) => {
    if (choice === "reload" && externalChange && externalChange.kind !== "deleted") {
      const latest = externalChange.document;
      updateActive((current) => {
        const history = [...current.history];
        if (externalChange.kind === "renamed") history[current.historyIndex] = { ...history[current.historyIndex], path: latest.path };
        return { ...current, ...latest, savedContents: latest.contents, diskContents: latest.contents, dirty: false, history };
      });
      setExternalChange(null);
    }
    else if (choice === "overwrite") void saveFile(true);
    else if (choice === "saveAs") {
      setExternalChange(null);
      void saveAs();
    }
    else setExternalChange(null);
  }, [externalChange, saveAs, saveFile, updateActive]);

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
    newDocument,
    revertDocument,
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
