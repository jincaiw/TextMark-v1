import { useCallback, useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { MARKDOWN_FILTERS, SAMPLE_MARKDOWN } from "../constants";
import { errorCode, isTauri, parentDirectory, readDocument, readStartupDocument, resolveSiblingPath, scanFolder, writeDocument } from "../lib/platform";
import type { FileNode, TextDocument } from "../types";

const initialDocument: TextDocument = {
  path: null,
  name: "README.md",
  contents: SAMPLE_MARKDOWN,
};

const userError = (error: unknown) => ({
  invalid_document: "此文件不是受支持的 Markdown 或文本文件。",
  not_found: "文件或文件夹不存在。",
  io: "无法读取或写入此文件。",
  invalid_path: "所选路径无效。",
  asset_outside_workspace: "资源路径位于当前文档文件夹之外。",
  asset_unsupported: "不支持此本地图片格式。",
  asset_too_large: "本地图片超过 8 MB 限制。",
}[errorCode(error) ?? "io"]);

function browserOpen(): Promise<TextDocument | null> {
  return new Promise((resolve) => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".md,.markdown,.mdown,.mkd,.mkdn,.txt,text/markdown,text/plain";
    picker.addEventListener("change", async () => {
      const file = picker.files?.[0];
      if (!file) return resolve(null);
      resolve({ path: null, name: file.name, contents: await file.text(), modifiedMs: file.lastModified });
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

export function useDocument() {
  const [document, setDocument] = useState<TextDocument>(initialDocument);
  const [savedContents, setSavedContents] = useState(initialDocument.contents);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isDirty = document.contents !== savedContents;
  const baseDirectory = useMemo(() => parentDirectory(document.path), [document.path]);

  const applyDocument = useCallback((next: TextDocument) => {
    setDocument(next);
    setSavedContents(next.contents);
    setNotice(null);
  }, []);

  useEffect(() => {
    void readStartupDocument().then((startup) => { if (startup) applyDocument(startup); });
  }, [applyDocument]);

  useEffect(() => {
    if (!document.path || !isTauri() || isDirty) return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await readDocument(document.path!);
        if (latest.modifiedMs && latest.modifiedMs !== document.modifiedMs) applyDocument(latest);
      } catch { /* The file may be temporarily unavailable while another editor saves it. */ }
    }, 1600);
    return () => window.clearInterval(timer);
  }, [applyDocument, document.path, document.modifiedMs, isDirty]);

  const openPath = useCallback(async (path: string) => {
    if (!isTauri()) return;
    setBusy(true);
    try {
      applyDocument(await readDocument(path));
    } catch (error) {
      setNotice(userError(error));
    } finally {
      setBusy(false);
    }
  }, [applyDocument]);

  const openFile = useCallback(async () => {
    setBusy(true);
    try {
      if (!isTauri()) {
        const selected = await browserOpen();
        if (selected) applyDocument(selected);
        return;
      }
      const selected = await open({ multiple: false, directory: false, filters: MARKDOWN_FILTERS });
      if (typeof selected === "string") applyDocument(await readDocument(selected));
    } catch (error) {
      setNotice(userError(error));
    } finally {
      setBusy(false);
    }
  }, [applyDocument]);

  const openFolder = useCallback(async () => {
    if (!isTauri()) {
      setNotice("Folder browsing is available in the TextMark desktop app.");
      return;
    }
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
      if (first) applyDocument(await readDocument(first.path));
    } catch (error) {
      setNotice(userError(error));
    } finally {
      setBusy(false);
    }
  }, [applyDocument]);

  const saveAs = useCallback(async () => {
    if (!isTauri()) {
      browserSave(document.name, document.contents);
      setSavedContents(document.contents);
      return;
    }
    setBusy(true);
    try {
      const selected = await save({ defaultPath: document.path ?? document.name, filters: MARKDOWN_FILTERS });
      if (typeof selected !== "string") return;
      await writeDocument(selected, document.contents);
      applyDocument({ ...document, path: selected, name: selected.split(/[\\/]/).pop() ?? document.name });
    } catch (error) {
      setNotice(userError(error));
    } finally {
      setBusy(false);
    }
  }, [applyDocument, document]);

  const saveFile = useCallback(async () => {
    if (!document.path || !isTauri()) return saveAs();
    setBusy(true);
    try {
      await writeDocument(document.path, document.contents);
      setSavedContents(document.contents);
      setNotice("Saved");
      window.setTimeout(() => setNotice(null), 1400);
    } catch (error) {
      setNotice(userError(error));
    } finally {
      setBusy(false);
    }
  }, [document, saveAs]);

  const openRelative = useCallback(async (relativePath: string) => {
    if (!baseDirectory || !isTauri()) return;
    await openPath(resolveSiblingPath(baseDirectory, relativePath));
  }, [baseDirectory, openPath]);

  const updateContents = useCallback((contents: string) => {
    setDocument((current) => ({ ...current, contents }));
  }, []);

  return {
    document,
    isDirty,
    baseDirectory,
    workspacePath,
    files,
    busy,
    notice,
    updateContents,
    openFile,
    openFolder,
    openPath,
    openRelative,
    saveFile,
    saveAs,
  };
}
