import type { SidebarMode } from '../types'

/**
 * 面板布局的持久化状态。
 *
 * 收敛成一个模块的原因：原先这些键散落在 App 的两处 useState 初始化和一个写回 effect 里，
 * 三个键写了、第四个（`inspectorVisible`）漏了，而缺口只在「重启后 Inspector 不恢复」时才可见。
 * 放在一处后，读写两侧共用同一份键表，新增面板不会再漏。
 */

export const SIDEBAR_WIDTH_RANGE = { min: 230, max: 400, default: 260 } as const
export const INSPECTOR_WIDTH_RANGE = { min: 270, max: 500, default: 292 } as const

export const LAYOUT_STORAGE_KEYS = {
  sidebarVisible: 'textmark.sidebarVisible',
  sidebarMode: 'textmark.sidebarMode',
  sidebarWidth: 'textmark.sidebarWidth',
  inspectorVisible: 'textmark.inspectorVisible',
  inspectorWidth: 'textmark.inspectorWidth',
} as const

export type LayoutStorageKey = (typeof LAYOUT_STORAGE_KEYS)[keyof typeof LAYOUT_STORAGE_KEYS]

export interface LayoutState {
  sidebarVisible: boolean
  sidebarMode: SidebarMode
  sidebarWidth: number
  inspectorVisible: boolean
  inspectorWidth: number
}

/** 只要求 getItem，便于测试传入替身（jsdom 的 localStorage 也可用）。 */
export interface LayoutStorageReader {
  getItem: (key: string) => string | null
}

export interface LayoutStorageWriter {
  setItem: (key: string, value: string) => void
}

const clampWidth = (value: number, range: { min: number; max: number; default: number }) => Math.min(range.max, Math.max(range.min, value))

export function readLayoutState(storage: LayoutStorageReader = localStorage): LayoutState {
  const storedSidebarMode = storage.getItem(LAYOUT_STORAGE_KEYS.sidebarMode)
  const sidebarWidth = Number(storage.getItem(LAYOUT_STORAGE_KEYS.sidebarWidth))
  const inspectorWidth = Number(storage.getItem(LAYOUT_STORAGE_KEYS.inspectorWidth))
  return {
    // 边栏默认可见，只有显式存过 'false' 才隐藏。
    sidebarVisible: storage.getItem(LAYOUT_STORAGE_KEYS.sidebarVisible) !== 'false',
    sidebarMode: storedSidebarMode === 'files' ? 'files' : 'outline',
    sidebarWidth: clampWidth(
      Number.isFinite(sidebarWidth) && sidebarWidth > 0 ? sidebarWidth : SIDEBAR_WIDTH_RANGE.default,
      SIDEBAR_WIDTH_RANGE,
    ),
    // Inspector 默认隐藏，只有显式存过 'true' 才显示。
    inspectorVisible: storage.getItem(LAYOUT_STORAGE_KEYS.inspectorVisible) === 'true',
    inspectorWidth: clampWidth(
      Number.isFinite(inspectorWidth) && inspectorWidth > 0 ? inspectorWidth : INSPECTOR_WIDTH_RANGE.default,
      INSPECTOR_WIDTH_RANGE,
    ),
  }
}

export function writeLayoutState(state: LayoutState, storage: LayoutStorageWriter = localStorage): void {
  storage.setItem(LAYOUT_STORAGE_KEYS.sidebarVisible, String(state.sidebarVisible))
  storage.setItem(LAYOUT_STORAGE_KEYS.sidebarMode, state.sidebarMode)
  storage.setItem(LAYOUT_STORAGE_KEYS.sidebarWidth, String(state.sidebarWidth))
  storage.setItem(LAYOUT_STORAGE_KEYS.inspectorVisible, String(state.inspectorVisible))
  storage.setItem(LAYOUT_STORAGE_KEYS.inspectorWidth, String(state.inspectorWidth))
}
