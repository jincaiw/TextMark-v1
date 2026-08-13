import type { Locale } from "../types";

export const DEFAULT_LOCALE: Locale = "zh-CN";

const zh = {
  appName: "TextMark", edited: "已编辑", openFile: "打开文件…", openFolder: "打开文件夹…", save: "保存", saveAs: "另存为…",
  preferences: "偏好设置", appearance: "外观", automatic: "自动", light: "浅色", dark: "深色", contentWidth: "内容宽度",
  normal: "正常", fullWidth: "全宽", editorFontSize: "编辑器字号", language: "语言", chinese: "简体中文", english: "English",
  search: "在文档中搜索", find: "查找", contains: "包含", beginsWith: "开头匹配", matchCase: "区分大小写",
  close: "关闭", minimize: "最小化", maximize: "最大化", copied: "已复制", copy: "复制", copyCode: "复制代码", copySource: "复制源文件",
  print: "打印 / 导出 PDF", exportHtml: "导出 HTML…", exportPng: "导出 PNG…", export: "导出",
  tableOfContents: "目录", projectNavigator: "项目导航", noHeadings: "没有标题", project: "项目", settingsStored: "偏好设置仅保存在本设备。",
  crashReports: "发送匿名崩溃报告", unavailable: "不可用", openWith: "打开方式", openInLlm: "在 AI 应用中打开", systemDefault: "系统默认编辑器",
  edit: "编辑", preview: "预览", sidebar: "侧栏", chooseSidebar: "选择侧栏模式", toggleSidebar: "显示或隐藏侧栏", zoomOut: "缩小", zoomIn: "放大",
  getInfo: "显示简介", shareSource: "共享 Markdown 源文件", toggleEdit: "切换编辑模式", more: "更多", customizeToolbar: "自定工具栏…",
  toolbarTitle: "自定工具栏", toolbarHint: "将常用项目拖到工具栏，并拖动调整顺序。", availableItems: "可用项目", currentToolbar: "当前工具栏", reset: "恢复默认", done: "完成", toolbarDisplay: "显示", iconsOnly: "仅图标", iconsAndText: "图标与文字",
  flexibleSpace: "弹性空间", space: "空格", navigation: "向前/向后", inspector: "简介", share: "共享", zoom: "缩放", searchItem: "搜索", printItem: "打印", copyItem: "复制", exportItem: "导出",
  previousMatch: "上一个匹配项", nextMatch: "下一个匹配项", matchCount: "第 {current} 项，共 {count} 项",
  documentInfo: "文档信息", markdownDocument: "Markdown 文档", location: "位置", created: "创建时间", modified: "修改时间", size: "大小", unsaved: "未保存",
  showInFileManager: "在文件管理器中显示", document: "文档", words: "字词", characters: "字符", lines: "行", headings: "标题", links: "链接", images: "图片", frontmatter: "Frontmatter", noFrontmatter: "无 Frontmatter",
  openInNewTab: "在新标签页中打开", openInNewWindow: "在新窗口中打开", copyPath: "复制路径", copyContents: "复制内容",
  body: "正文", heading1: "标题 1", heading2: "标题 2", heading3: "标题 3", bold: "粗体", italic: "斜体", strikethrough: "删除线", bulletedList: "项目符号列表", numberedList: "编号列表", checklist: "任务列表", quote: "引用", inlineCode: "行内代码", link: "链接", formatting: "Markdown 格式",
  conflictTitle: "文件已在磁盘上更改", conflictBody: "其他应用在你编辑期间修改了此文件。重新加载会放弃本地更改，覆盖会替换磁盘版本。", reload: "重新加载", overwrite: "强制覆盖", cancel: "取消",
  renamedTitle: "文件已被移动或重命名", renamedBody: "原路径已不存在。打开新位置会放弃本地更改；重新创建会把当前内容保存回原路径。", openRenamed: "打开新位置", recreateOriginal: "重新创建原文件",
  deletedTitle: "文件已被删除", deletedBody: "磁盘上的文件已不存在。你可以将当前内容重新创建到原路径，或另存为新文件。", recreate: "重新创建", saveAsConflict: "另存为…",
  closeTab: "关闭标签页", duplicateRow: "复制行", duplicateColumn: "复制列", addRowAbove: "在上方添加行", addRowBelow: "在下方添加行", deleteRow: "删除行", addColumnBefore: "在左侧添加列", addColumnAfter: "在右侧添加列", deleteColumn: "删除列", editCell: "编辑单元格",
  unnamedColumn: "第 {index} 列",
  updateChannel: "更新通道", stable: "稳定版", beta: "测试版", diagramWindow: "Mermaid 图表", fitWidth: "适合宽度", actualSize: "实际大小", openDiagramWindow: "在独立窗口中打开图表",
  checkForUpdates: "检查更新", checking: "正在检查…", upToDate: "已是最新版本", updateAvailable: "发现版本 {version}", installUpdate: "安装并重启", updateError: "检查更新失败", downloadingUpdate: "正在下载 {progress}%",
} as const;

const en: Record<keyof typeof zh, string> = {
  appName: "TextMark", edited: "Edited", openFile: "Open File…", openFolder: "Open Folder…", save: "Save", saveAs: "Save As…",
  preferences: "Preferences", appearance: "Appearance", automatic: "Automatic", light: "Light", dark: "Dark", contentWidth: "Content Width",
  normal: "Normal", fullWidth: "Full Width", editorFontSize: "Editor Font Size", language: "Language", chinese: "简体中文", english: "English",
  search: "Search in Document", find: "Find", contains: "Contains", beginsWith: "Begins With", matchCase: "Match Case",
  close: "Close", minimize: "Minimize", maximize: "Maximize", copied: "Copied", copy: "Copy", copyCode: "Copy code", copySource: "Copy Source",
  print: "Print / Export PDF", exportHtml: "Export HTML…", exportPng: "Export PNG…", export: "Export",
  tableOfContents: "Table of Contents", projectNavigator: "Project Navigator", noHeadings: "No headings", project: "Project", settingsStored: "Preferences are stored on this device.",
  crashReports: "Send anonymous crash reports", unavailable: "Unavailable", openWith: "Open With", openInLlm: "Open in AI App", systemDefault: "System Default Editor",
  edit: "Edit", preview: "Preview", sidebar: "Sidebar", chooseSidebar: "Choose sidebar mode", toggleSidebar: "Toggle Sidebar", zoomOut: "Zoom Out", zoomIn: "Zoom In",
  getInfo: "Get Info", shareSource: "Share Markdown Source", toggleEdit: "Toggle Edit Mode", more: "More", customizeToolbar: "Customize Toolbar…",
  toolbarTitle: "Customize Toolbar", toolbarHint: "Drag frequently used items into the toolbar and reorder them.", availableItems: "Available Items", currentToolbar: "Current Toolbar", reset: "Restore Defaults", done: "Done", toolbarDisplay: "Show", iconsOnly: "Icon Only", iconsAndText: "Icon and Text",
  flexibleSpace: "Flexible Space", space: "Space", navigation: "Back/Forward", inspector: "Get Info", share: "Share", zoom: "Zoom", searchItem: "Search", printItem: "Print", copyItem: "Copy", exportItem: "Export",
  previousMatch: "Previous Match", nextMatch: "Next Match", matchCount: "{current} of {count}",
  documentInfo: "Document Info", markdownDocument: "Markdown document", location: "Location", created: "Created", modified: "Modified", size: "Size", unsaved: "Unsaved",
  showInFileManager: "Show in File Manager", document: "Document", words: "Words", characters: "Characters", lines: "Lines", headings: "Headings", links: "Links", images: "Images", frontmatter: "Frontmatter", noFrontmatter: "No frontmatter",
  openInNewTab: "Open in New Tab", openInNewWindow: "Open in New Window", copyPath: "Copy Path", copyContents: "Copy Contents",
  body: "Body", heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", bold: "Bold", italic: "Italic", strikethrough: "Strikethrough", bulletedList: "Bulleted List", numberedList: "Numbered List", checklist: "Checklist", quote: "Quote", inlineCode: "Inline Code", link: "Link", formatting: "Markdown formatting",
  conflictTitle: "The file changed on disk", conflictBody: "Another app changed this file while you were editing. Reload discards local changes; overwrite replaces the disk version.", reload: "Reload", overwrite: "Overwrite", cancel: "Cancel",
  renamedTitle: "File moved or renamed", renamedBody: "The original path no longer exists. Opening the new location discards local changes; recreating saves the current content back to the original path.", openRenamed: "Open New Location", recreateOriginal: "Recreate Original",
  deletedTitle: "File deleted", deletedBody: "The file no longer exists on disk. Recreate it at the original path or save the current content as a new file.", recreate: "Recreate", saveAsConflict: "Save As…",
  closeTab: "Close Tab", duplicateRow: "Duplicate Row", duplicateColumn: "Duplicate Column", addRowAbove: "Add Row Above", addRowBelow: "Add Row Below", deleteRow: "Delete Row", addColumnBefore: "Add Column Before", addColumnAfter: "Add Column After", deleteColumn: "Delete Column", editCell: "Edit Cell",
  unnamedColumn: "Column {index}",
  updateChannel: "Update Channel", stable: "Stable", beta: "Beta", diagramWindow: "Mermaid Diagram", fitWidth: "Fit Width", actualSize: "Actual Size", openDiagramWindow: "Open diagram in a separate window",
  checkForUpdates: "Check for Updates", checking: "Checking…", upToDate: "TextMark is up to date", updateAvailable: "Version {version} is available", installUpdate: "Install and Restart", updateError: "Update check failed", downloadingUpdate: "Downloading {progress}%",
};

const dictionary = { "zh-CN": zh, en } as const;
export type TranslationKey = keyof typeof zh;
export const t = (locale: Locale, key: TranslationKey, variables?: Record<string, string | number>) => {
  let value: string = dictionary[locale][key];
  for (const [name, replacement] of Object.entries(variables ?? {})) value = value.replace(`{${name}}`, String(replacement));
  return value;
};
