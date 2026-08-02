import type { Locale } from "../types";

export const DEFAULT_LOCALE: Locale = "zh-CN";

const dictionary = {
  "zh-CN": {
    appName: "TextMark", edited: "已编辑", openFile: "打开文件…", openFolder: "打开文件夹…", save: "保存", saveAs: "另存为…",
    preferences: "偏好设置", appearance: "外观", automatic: "自动", light: "浅色", dark: "深色", contentWidth: "内容宽度",
    normal: "正常", fullWidth: "全宽", editorFontSize: "编辑器字号", language: "语言", chinese: "简体中文", english: "English",
    search: "在文档中搜索", find: "查找", contains: "包含", beginsWith: "开头匹配", matchCase: "区分大小写",
    close: "关闭", copied: "已复制", copySource: "复制源文件", print: "打印 / 导出 PDF", exportHtml: "导出 HTML…", exportPng: "导出 PNG…",
    tableOfContents: "目录", projectNavigator: "项目导航", noHeadings: "没有标题", project: "项目", settingsStored: "偏好设置仅保存在本设备。",
    crashReports: "发送匿名崩溃报告", unavailable: "不可用", openWith: "打开方式", systemDefault: "系统默认编辑器", edit: "编辑", preview: "预览",
  },
  en: {
    appName: "TextMark", edited: "Edited", openFile: "Open File…", openFolder: "Open Folder…", save: "Save", saveAs: "Save As…",
    preferences: "Preferences", appearance: "Appearance", automatic: "Automatic", light: "Light", dark: "Dark", contentWidth: "Content Width",
    normal: "Normal", fullWidth: "Full Width", editorFontSize: "Editor Font Size", language: "Language", chinese: "简体中文", english: "English",
    search: "Search in Document", find: "Find", contains: "Contains", beginsWith: "Begins With", matchCase: "Match Case",
    close: "Close", copied: "Copied", copySource: "Copy Source", print: "Print / Export PDF", exportHtml: "Export HTML…", exportPng: "Export PNG…",
    tableOfContents: "Table of Contents", projectNavigator: "Project Navigator", noHeadings: "No headings", project: "Project", settingsStored: "Preferences are stored on this device.",
    crashReports: "Send anonymous crash reports", unavailable: "Unavailable", openWith: "Open With", systemDefault: "System Default Editor", edit: "Edit", preview: "Preview",
  },
} as const;

export type TranslationKey = keyof (typeof dictionary)["zh-CN"];
export const t = (locale: Locale, key: TranslationKey) => dictionary[locale][key];
