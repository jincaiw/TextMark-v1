import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ConflictDialog } from './ConflictDialog'
import { DraftRecoveryDialog } from './DraftRecoveryDialog'
import { DocumentTabs } from './DocumentTabs'
import { FindBar } from './FindBar'
import { Inspector } from './Inspector'
import { UpdatePill } from './UpdatePill'
import { ToolbarCustomizer } from './ToolbarCustomizer'
import { SettingsDialog } from './SettingsDialog'
import { PreviewPane } from './PreviewPane'
import { Sidebar } from './Sidebar'
import { UnsavedCloseDialog } from './UnsavedCloseDialog'
import type { DocumentSession, RenderedMarkdown } from '../types'

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0h100"/></svg>',
    }),
  },
}))

const session = (id: string, name: string, dirty = false): DocumentSession => ({
  id,
  name,
  path: null,
  contents: '',
  savedContents: '',
  diskContents: '',
  dirty,
  scrollTop: 0,
  history: [{ path: null, scrollTop: 0 }],
  historyIndex: 0,
})

const settingsDialogProps = {
  open: true,
  theme: 'system',
  contentWidth: 'normal',
  themePreset: 'original',
  themeColors: {},
  autoSaveIntervalMinutes: 0,
  openDocumentsInTabs: false,
  alwaysOnTop: false,
  zoom: 100,
  applications: [
    { id: 'system', name: 'System', kind: 'system', available: true },
    { id: 'vscode', name: 'Visual Studio Code', kind: 'editor', available: true },
    { id: 'chatgpt', name: 'ChatGPT', kind: 'llm', available: true },
    { id: 'missing', name: 'Missing Editor', kind: 'editor', available: false },
  ],
  defaultOpenTarget: 'system',
  locale: 'en',
  crashReports: false,
  crashReportsAvailable: false,
  updateChannel: 'stable',
  autoCheckUpdates: true,
  lastUpdateCheckAt: null,
  updateStatus: { state: 'idle' },
  onLocaleChange: vi.fn(),
  onCrashReportsChange: vi.fn(),
  onUpdateChannelChange: vi.fn(),
  onAutoCheckUpdatesChange: vi.fn(),
  onCheckUpdate: vi.fn(),
  onInstallUpdate: vi.fn(),
  onThemeChange: vi.fn(),
  onContentWidthChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onThemeColorChange: vi.fn(),
  onThemeColorsReset: vi.fn(),
  onCustomizeTheme: vi.fn(),
  onAutoSaveIntervalChange: vi.fn(),
  onOpenDocumentsInTabsChange: vi.fn(),
  onAlwaysOnTopChange: vi.fn(),
  onZoomChange: vi.fn(),
  onDefaultOpenTargetChange: vi.fn(),
  onInstallCli: vi.fn(),
  onClose: vi.fn(),
} satisfies ComponentProps<typeof SettingsDialog>

describe('localized desktop components', () => {
  it('renders the upstream Contains/Begins With find modes in Chinese', () => {
    const html = renderToStaticMarkup(
      <FindBar
        locale="zh-CN"
        query="Text"
        current={0}
        count={2}
        matchCase={false}
        mode="contains"
        onQueryChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onMatchCaseChange={vi.fn()}
        onModeChange={vi.fn()}
        replacement=""
        onReplacementChange={vi.fn()}
        onReplace={vi.fn()}
        onReplaceAll={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(html).toContain('包含')
    expect(html).toContain('开头为')
    expect(html).toContain('第 1 项，共 2 项')
  })
  it('offers explicit restore and discard choices for a local draft', () => {
    const html = renderToStaticMarkup(
      <DraftRecoveryDialog
        locale="zh-CN"
        record={{
          version: 1,
          path: '/tmp/guide.md',
          name: 'guide.md',
          contents: 'draft',
          diskContents: 'disk',
          diskRevision: 'r1',
          scrollTop: 24,
          updatedAt: 0,
        }}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )
    expect(html).toContain('发现本地草稿')
    expect(html).toContain('恢复草稿')
    expect(html).toContain('放弃草稿')
  })
  it('lets the draft recovery dialog discard on Escape and traps focus', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onDiscard = vi.fn()
    await act(async () => {
      root.render(
        <DraftRecoveryDialog
          locale="en"
          record={{
            version: 1,
            path: '/tmp/guide.md',
            name: 'guide.md',
            contents: 'draft',
            diskContents: 'disk',
            diskRevision: 'r1',
            scrollTop: 24,
            updatedAt: 0,
          }}
          onRestore={vi.fn()}
          onDiscard={onDiscard}
        />,
      )
    })
    const buttons = host.querySelectorAll<HTMLButtonElement>('button')
    expect(document.activeElement).toBe(buttons[0])
    await act(async () =>
      host.querySelector<HTMLElement>('.conflict-dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    )
    expect(onDiscard).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })

  it('offers save, discard and cancel when closing with unsaved documents', () => {
    const html = renderToStaticMarkup(
      <UnsavedCloseDialog locale="zh-CN" dirtyCount={2} canSaveAll onSave={vi.fn()} onDiscard={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(html).toContain('2 个文稿有未存储的更改。')
    expect(html).toContain('存储并关闭')
    expect(html).toContain('放弃更改')
    expect(html).not.toContain('disabled')
  })
  it('refuses to auto-save untitled documents and says why', () => {
    const html = renderToStaticMarkup(
      <UnsavedCloseDialog locale="zh-CN" dirtyCount={1} canSaveAll={false} onSave={vi.fn()} onDiscard={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(html).toContain('未命名文稿需要先“存储为…”')
    expect(html).toContain('disabled')
  })

  it('wires the unsaved-close choices to their handlers', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onSave = vi.fn()
    const onDiscard = vi.fn()
    const onCancel = vi.fn()
    const dialog = (canSaveAll: boolean) => (
      <UnsavedCloseDialog locale="zh-CN" dirtyCount={1} canSaveAll={canSaveAll} onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />
    )
    await act(async () => root.render(dialog(true)))
    const button = (label: string) => Array.from(host.querySelectorAll('button')).find((node) => node.textContent === label)!
    await act(async () => button('取消').click())
    await act(async () => button('放弃更改').click())
    await act(async () => button('存储并关闭').click())
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)

    // An untitled dirty document has nowhere to save to, so “save and close”
    // must stay disabled instead of silently discarding the edits.
    await act(async () => root.render(dialog(false)))
    expect(button('存储并关闭').disabled).toBe(true)
    await act(async () => button('存储并关闭').click())
    expect(onSave).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })

  it('exposes dirty document tabs and localized close labels', () => {
    const html = renderToStaticMarkup(
      <DocumentTabs
        sessions={[session('a', 'A.md', true), session('b', 'B.md')]}
        activeId="a"
        locale="zh-CN"
        onActivate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(html).toContain('A.md •')
    expect(html).toContain('关闭标签页 A.md')
  })
  it('renders the three explicit conflict choices', () => {
    const html = renderToStaticMarkup(
      <ConflictDialog
        change={{ kind: 'modified', document: { path: '/a.md', name: 'a.md', contents: 'disk' } }}
        locale="en"
        onResolve={vi.fn()}
      />,
    )
    expect(html).toContain('Reload from Disk')
    expect(html).toContain('Keep My Changes')
    expect(html).toContain('Cancel')
  })
  it('offers safe recovery when a document is deleted or renamed', () => {
    const deleted = renderToStaticMarkup(
      <ConflictDialog change={{ kind: 'deleted', previousPath: '/a.md' }} locale="zh-CN" onResolve={vi.fn()} />,
    )
    const renamed = renderToStaticMarkup(
      <ConflictDialog
        change={{ kind: 'renamed', previousPath: '/a.md', document: { path: '/b.md', name: 'b.md', contents: 'disk' } }}
        locale="en"
        onResolve={vi.fn()}
      />,
    )
    expect(deleted).toContain('另存为')
    expect(deleted).toContain('重新创建')
    expect(renamed).toContain('Open New Location')
    expect(renamed).toContain('Recreate Original')
  })
  it('renders configurable toolbar inventory', () => {
    const html = renderToStaticMarkup(
      <ToolbarCustomizer
        open
        locale="zh-CN"
        items={['sidebar', 'search']}
        displayMode="iconOnly"
        onChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(html).toContain('自定义工具栏')
    expect(html).toContain('可用项目')
    expect(html).toContain('当前工具栏')
  })
  it('无 LLM 目标时可用项目不列出「在 LLM 中打开」（upstream allowed 集合门控）', () => {
    const withLlm = renderToStaticMarkup(
      <ToolbarCustomizer
        open
        locale="zh-CN"
        items={['sidebar']}
        displayMode="iconOnly"
        hasLlmTargets
        onChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const withoutLlm = renderToStaticMarkup(
      <ToolbarCustomizer
        open
        locale="zh-CN"
        items={['sidebar']}
        displayMode="iconOnly"
        hasLlmTargets={false}
        onChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(withLlm).toContain('在 LLM 中打开')
    expect(withoutLlm).not.toContain('在 LLM 中打开')
  })
  it('adds, removes, resets and changes the custom toolbar display mode', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onChange = vi.fn()
    const onDisplayModeChange = vi.fn()
    await act(async () =>
      root.render(
        <ToolbarCustomizer
          open
          locale="zh-CN"
          items={['sidebar', 'search']}
          displayMode="iconOnly"
          onChange={onChange}
          onDisplayModeChange={onDisplayModeChange}
          onClose={vi.fn()}
        />,
      ),
    )

    const print = Array.from(host.querySelectorAll<HTMLButtonElement>('.tc-card')).find((button) => button.textContent === '打印')!
    await act(async () => print.click())
    expect(onChange).toHaveBeenLastCalledWith(['sidebar', 'search', 'print'])
    await act(async () => host.querySelector<HTMLButtonElement>('.tc-remove')!.click())
    expect(onChange).toHaveBeenLastCalledWith(['search'])
    await act(async () => host.querySelector<HTMLButtonElement>('.tc-reset')!.click())
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining(['navigation', 'themesAndSettings', 'inspector', 'share', 'edit', 'search']),
    )
    const display = host.querySelector<HTMLSelectElement>('.tc-display select')!
    display.value = 'iconAndLabel'
    await act(async () => display.dispatchEvent(new Event('change', { bubbles: true })))
    expect(onDisplayModeChange).toHaveBeenCalledWith('iconAndLabel')

    await act(async () => root.unmount())
    host.remove()
  })
  it('groups AI apps and editors as separate sections of the open target picker', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} />)
    // Upstream GeneralSettingsView lists AI apps and Editors as two picker sections.
    expect(html).toContain('AI apps')
    expect(html).toContain('Editors')
    expect(html).toContain('ChatGPT')
    expect(html).toContain('Visual Studio Code')
    // Unavailable applications stay hidden.
    expect(html).not.toContain('Missing Editor')
  })
  it('keeps reading typography out of Settings — it moved to the Customize Theme sheet', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} locale="zh-CN" />)
    expect(html).toContain('阅读')
    expect(html).not.toContain('行高')
    expect(html).not.toContain('左右页边距')
  })
  it('keeps the sidebar header as a section title without duplicate mode controls', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        mode="outline"
        fileName="README.md"
        documentKey="README.md"
        files={[]}
        workspacePath={null}
        activePath={null}
        locale="en"
        outline={[]}
        applications={[]}
        defaultOpenTarget="system"
        activeHeading={null}
        onOutlineSelect={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFileInTab={vi.fn()}
        onOpenFileInWindow={vi.fn()}
        onOpenFileWith={vi.fn()}
        onRevealFile={vi.fn()}
        onCopyFilePath={vi.fn()}
        onCopyFileContents={vi.fn()}
        onOpenFolder={vi.fn()}
        newFileFolder={null}
        onCreateItem={vi.fn()}
        onAddFiles={vi.fn()}
      />,
    )
    expect(html).toContain('<strong>README.md</strong>')
    expect(html).not.toContain('sidebar-mode-switch')
    expect(html).not.toContain('role="tablist"')
  })

  it('keeps heading collapse state per document', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const outline = [
      { id: 'intro', text: 'Intro', level: 1, line: 1 },
      { id: 'intro-detail', text: 'Detail', level: 2, line: 4 },
      { id: 'intro-deep', text: 'Deeper', level: 3, line: 6 },
      { id: 'usage', text: 'Usage', level: 1, line: 9 },
    ]
    const props = {
      mode: 'outline' as const,
      fileName: 'a.md',
      documentKey: 'doc-a',
      files: [],
      workspacePath: null,
      activePath: null,
      outline,
      activeHeading: null,
      applications: [],
      defaultOpenTarget: 'system',
      onOpenFolder: vi.fn(),
      onOpenFile: vi.fn(),
      onOpenFileInTab: vi.fn(),
      onOpenFileInWindow: vi.fn(),
      onOpenFileWith: vi.fn(),
      onRevealFile: vi.fn(),
      onCopyFilePath: vi.fn(),
      onCopyFileContents: vi.fn(),
      onOutlineSelect: vi.fn(),
      newFileFolder: null,
      onCreateItem: vi.fn(),
      onAddFiles: vi.fn(),
      locale: 'zh-CN' as const,
    }
    const rows = () => host.querySelectorAll('.outline-row')
    const disclosure = () => host.querySelector<HTMLButtonElement>('.outline-disclosure')!

    await act(async () => root.render(<Sidebar {...props} />))
    expect(rows()).toHaveLength(4)

    await act(async () => disclosure().click())
    // Collapsing "Intro" hides its two descendants, not the following top-level
    // heading.
    expect(rows()).toHaveLength(2)
    expect(disclosure().getAttribute('aria-expanded')).toBe('false')

    // A second document with the same heading ids must not inherit the fold.
    await act(async () => root.render(<Sidebar {...props} documentKey="doc-b" fileName="b.md" />))
    expect(rows()).toHaveLength(4)

    // …and returning to the first document restores what the user had folded.
    await act(async () => root.render(<Sidebar {...props} />))
    expect(rows()).toHaveLength(2)

    await act(async () => root.unmount())
    host.remove()
  })
  it('keeps directory context actions scoped to files', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onOpenFile = vi.fn()
    const onRevealFile = vi.fn()
    const files = [
      {
        name: 'docs',
        path: '/tmp/docs',
        isDirectory: true,
        children: [{ name: 'guide.md', path: '/tmp/docs/guide.md', isDirectory: false, children: [] }],
      },
    ]
    await act(async () =>
      root.render(
        <Sidebar
          mode="files"
          fileName="README.md"
          documentKey="doc"
          files={files}
          workspacePath="/tmp"
          activePath={null}
          outline={[]}
          activeHeading={null}
          applications={[]}
          defaultOpenTarget="system"
          onOpenFolder={vi.fn()}
          onOpenFile={onOpenFile}
          onOpenFileInTab={vi.fn()}
          onOpenFileInWindow={vi.fn()}
          onOpenFileWith={vi.fn()}
          onRevealFile={onRevealFile}
          onCopyFilePath={vi.fn()}
          onCopyFileContents={vi.fn()}
          onOutlineSelect={vi.fn()}
          newFileFolder="/tmp"
          onCreateItem={vi.fn()}
          onAddFiles={vi.fn()}
          locale="zh-CN"
        />,
      ),
    )
    const directory = host.querySelector<HTMLButtonElement>('.tree-row')!
    await act(async () => directory.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 })))
    expect(host.querySelector('.project-context-menu')).not.toBeNull()
    expect(host.textContent).not.toContain('打开文件…')
    expect(host.textContent).toContain('在“访达”中显示')
    await act(async () => root.unmount())
    host.remove()
  })
  it('filters the project navigator by name and clears on Escape', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const files = [
      {
        name: 'docs',
        path: '/tmp/docs',
        isDirectory: true,
        children: [
          { name: 'guide.md', path: '/tmp/docs/guide.md', isDirectory: false, children: [] },
          { name: 'notes.md', path: '/tmp/docs/notes.md', isDirectory: false, children: [] },
        ],
      },
      { name: 'readme.md', path: '/tmp/readme.md', isDirectory: false, children: [] },
    ]
    await act(async () =>
      root.render(
        <Sidebar
          mode="files"
          fileName="readme.md"
          documentKey="doc"
          files={files}
          workspacePath="/tmp"
          activePath={null}
          outline={[]}
          activeHeading={null}
          applications={[]}
          defaultOpenTarget="system"
          onOpenFolder={vi.fn()}
          onOpenFile={vi.fn()}
          onOpenFileInTab={vi.fn()}
          onOpenFileInWindow={vi.fn()}
          onOpenFileWith={vi.fn()}
          onRevealFile={vi.fn()}
          onCopyFilePath={vi.fn()}
          onCopyFileContents={vi.fn()}
          onOutlineSelect={vi.fn()}
          newFileFolder="/tmp"
          onCreateItem={vi.fn()}
          onAddFiles={vi.fn()}
          locale="zh-CN"
        />,
      ),
    )
    // The filter bar carries the add button, the filter field and the clock toggle.
    expect(host.querySelector('.navigator-add')).not.toBeNull()
    const input = host.querySelector<HTMLInputElement>('.navigator-filter-field input')!
    expect(input.placeholder).toBe('过滤')
    expect(host.querySelector('.navigator-recent')).not.toBeNull()
    const fileRows = () => Array.from(host.querySelectorAll('.tree-row.file')).map((row) => row.textContent)
    expect(fileRows()).toEqual(['guide.md', 'notes.md', 'readme.md'])

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, 'guide')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // Only the matching file survives, with its ancestor folder kept and expanded.
    expect(fileRows()).toEqual(['guide.md'])
    expect(host.querySelector('.tree-row[aria-expanded="true"]')).not.toBeNull()

    // Escape empties the field and restores the full tree.
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(input.value).toBe('')
    expect(fileRows()).toEqual(['guide.md', 'notes.md', 'readme.md'])
    await act(async () => root.unmount())
    host.remove()
  })
  it('opens the navigator add menu with the upstream items and wires creation', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onCreateItem = vi.fn()
    const onAddFiles = vi.fn()
    const props = {
      mode: 'files' as const,
      fileName: 'readme.md',
      documentKey: 'doc',
      files: [{ name: 'readme.md', path: '/tmp/readme.md', isDirectory: false, children: [] }],
      workspacePath: '/tmp',
      activePath: null,
      outline: [],
      activeHeading: null,
      applications: [],
      defaultOpenTarget: 'system',
      onOpenFolder: vi.fn(),
      onOpenFile: vi.fn(),
      onOpenFileInTab: vi.fn(),
      onOpenFileInWindow: vi.fn(),
      onOpenFileWith: vi.fn(),
      onRevealFile: vi.fn(),
      onCopyFilePath: vi.fn(),
      onCopyFileContents: vi.fn(),
      onOutlineSelect: vi.fn(),
      newFileFolder: '/tmp',
      onCreateItem,
      onAddFiles,
      locale: 'zh-CN' as const,
    }
    await act(async () => root.render(<Sidebar {...props} />))
    await act(async () => host.querySelector<HTMLButtonElement>('.navigator-add')!.click())
    const menu = host.querySelector('.navigator-add-menu')!
    expect(menu).not.toBeNull()
    const items = Array.from(menu.querySelectorAll('button')).map((button) => button.textContent)
    expect(items).toEqual(['新建空白文件', '从剪贴板新建文件', '新建文件夹', '将文件添加到“tmp”…'])
    expect(menu.querySelectorAll('hr')).toHaveLength(2)

    const item = (label: string) =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('.navigator-add-menu button')).find((b) => b.textContent === label)!
    await act(async () => item('新建空白文件').click())
    expect(onCreateItem).toHaveBeenCalledWith('')
    // Choosing an item closes the menu.
    expect(host.querySelector('.navigator-add-menu')).toBeNull()

    await act(async () => host.querySelector<HTMLButtonElement>('.navigator-add')!.click())
    await act(async () => item('新建文件夹').click())
    expect(onCreateItem).toHaveBeenLastCalledWith(null)

    await act(async () => host.querySelector<HTMLButtonElement>('.navigator-add')!.click())
    await act(async () => item('将文件添加到“tmp”…').click())
    expect(onAddFiles).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
  it('toggles the recent-files clock with an pressed state', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <Sidebar
          mode="files"
          fileName="readme.md"
          documentKey="doc"
          files={[{ name: 'readme.md', path: '/tmp/readme.md', isDirectory: false, children: [] }]}
          workspacePath="/tmp"
          activePath={null}
          outline={[]}
          activeHeading={null}
          applications={[]}
          defaultOpenTarget="system"
          onOpenFolder={vi.fn()}
          onOpenFile={vi.fn()}
          onOpenFileInTab={vi.fn()}
          onOpenFileInWindow={vi.fn()}
          onOpenFileWith={vi.fn()}
          onRevealFile={vi.fn()}
          onCopyFilePath={vi.fn()}
          onCopyFileContents={vi.fn()}
          onOutlineSelect={vi.fn()}
          newFileFolder="/tmp"
          onCreateItem={vi.fn()}
          onAddFiles={vi.fn()}
          locale="zh-CN"
        />,
      ),
    )
    const clock = host.querySelector<HTMLButtonElement>('.navigator-recent')!
    expect(clock.getAttribute('aria-pressed')).toBe('false')
    expect(clock.getAttribute('aria-label')).toBe('仅显示最近使用的文件')
    await act(async () => clock.click())
    expect(clock.getAttribute('aria-pressed')).toBe('true')
    expect(clock.classList.contains('active')).toBe(true)
    await act(async () => root.unmount())
    host.remove()
  })
  it('preserves an open disclosure while incremental search marks are applied', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    Element.prototype.scrollIntoView = vi.fn()
    const root = createRoot(host)
    const rendered: RenderedMarkdown = {
      html: '<details><summary>Persistent details</summary><p>TextMark body</p></details>',
      outline: [],
      hasMermaid: false,
      hasMath: false,
      frontmatter: [],
      sourceMap: [],
      tables: [],
      tasks: [],
      optionalRenderers: [],
      direction: 'auto',
    }
    const props = {
      rendered,
      documentKey: 'doc',
      initialScrollTop: 0,
      baseDirectory: null,
      workspacePath: null,
      zoom: 100,
      contentWidth: 'normal' as const,
      searchIndex: 0,
      matchCase: false,
      searchMode: 'contains' as const,
      locale: 'zh-CN' as const,
      onSearchCount: vi.fn(),
      onActiveHeading: vi.fn(),
      onZoomChange: vi.fn(),
      onOpenRelative: vi.fn(),
      onRenameImage: vi.fn(),
      onToggleTask: vi.fn(),
      onEditTable: vi.fn(),
    }
    await act(async () => root.render(<PreviewPane {...props} searchQuery="" />))
    const details = host.querySelector('details')!
    details.open = true
    await act(async () => root.render(<PreviewPane {...props} searchQuery="TextMark" />))
    expect(host.querySelector('details')?.open).toBe(true)
    expect(host.querySelectorAll('mark.search-match')).toHaveLength(1)
    await act(async () => root.unmount())
    host.remove()
  })
})

describe('code and diagram pills', () => {
  const rendered = (html: string, hasMermaid = false): RenderedMarkdown => ({
    html,
    outline: [],
    hasMermaid,
    hasMath: false,
    frontmatter: [],
    sourceMap: [],
    tables: [],
    tasks: [],
    optionalRenderers: [],
    direction: 'auto',
  })
  const props = (doc: RenderedMarkdown) => ({
    rendered: doc,
    documentKey: 'doc',
    initialScrollTop: 0,
    baseDirectory: null,
    workspacePath: null,
    zoom: 100,
    contentWidth: 'normal' as const,
    searchQuery: '',
    searchIndex: 0,
    matchCase: false,
    searchMode: 'contains' as const,
    locale: 'zh-CN' as const,
    onSearchCount: vi.fn(),
    onActiveHeading: vi.fn(),
    onZoomChange: vi.fn(),
    onOpenRelative: vi.fn(),
    onRenameImage: vi.fn(),
    onToggleTask: vi.fn(),
    onEditTable: vi.fn(),
  })
  const mount = async (doc: RenderedMarkdown) => {
    const host = document.createElement('div')
    document.body.append(host)
    Element.prototype.scrollIntoView = vi.fn()
    const root = createRoot(host)
    await act(async () => root.render(<PreviewPane {...props(doc)} />))
    await act(async () => {})
    return { host, root }
  }
  it('builds the upstream code card with a language label and a Wrap + Copy pill', async () => {
    const { host, root } = await mount(rendered('<pre class="hljs" data-code-language="ts"><code>const x = 1</code></pre>'))
    const wrap = host.querySelector('.md-code-wrap')!
    expect(wrap).not.toBeNull()
    expect(wrap.querySelector('.md-code-language')?.textContent).toBe('ts')
    const toggle = wrap.querySelector<HTMLButtonElement>('.md-code-toggle-wrap')!
    const copy = wrap.querySelector<HTMLButtonElement>('.md-code-copy')!
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('代码换行')
    expect(copy.getAttribute('aria-label')).toBe('拷贝代码')
    expect(toggle.querySelector('svg')).not.toBeNull()
    expect(copy.querySelector('svg')).not.toBeNull()
    await act(async () => toggle.click())
    expect(wrap.classList.contains('is-wrapped')).toBe(true)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.title).toBe('取消代码换行')
    await act(async () => toggle.click())
    expect(wrap.classList.contains('is-wrapped')).toBe(false)
    expect(toggle.title).toBe('代码换行')
    await act(async () => root.unmount())
    host.remove()
  })
  it('falls back to the text language label when a fence has none', async () => {
    const { host, root } = await mount(rendered('<pre class="hljs"><code>plain</code></pre>'))
    expect(host.querySelector('.md-code-language')?.textContent).toBe('text')
    await act(async () => root.unmount())
    host.remove()
  })
  it('copies the code and shows a check mark for a moment', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { host, root } = await mount(rendered('<pre class="hljs" data-code-language="ts"><code>const x = 1</code></pre>'))
    const copy = host.querySelector<HTMLButtonElement>('.md-code-copy')!
    vi.useFakeTimers()
    await act(async () => copy.click())
    expect(writeText).toHaveBeenCalledWith('const x = 1')
    expect(copy.classList.contains('is-copied')).toBe(true)
    expect(copy.getAttribute('aria-label')).toBe('代码已拷贝')
    await act(async () => vi.advanceTimersByTime(1100))
    expect(copy.classList.contains('is-copied')).toBe(false)
    expect(copy.getAttribute('aria-label')).toBe('拷贝代码')
    vi.useRealTimers()
    await act(async () => root.unmount())
    host.remove()
  })
  it('builds the diagram zoom and actions pills and updates the level on zoom', async () => {
    const source = 'graph TD;A-->B;'
    const html = `<figure class="diagram"><div class="mermaid" data-mermaid-source="${encodeURIComponent(source)}"></div></figure>`
    const { host, root } = await mount(rendered(html, true))
    const figure = host.querySelector('.diagram')!
    const hud = figure.querySelector('.diagram-hud')!
    expect(hud).not.toBeNull()
    const zoom = hud.querySelector('.diagram-hud-zoom')!
    expect(zoom.querySelector('[data-diagram-action="out"]')).not.toBeNull()
    expect(zoom.querySelector('.diagram-hud-level')?.textContent).toBe('100%')
    expect(zoom.querySelector('[data-diagram-action="in"]')).not.toBeNull()
    const actions = hud.querySelector('.diagram-hud-actions')!
    expect(actions.querySelector('[data-diagram-action="copy"]')).not.toBeNull()
    expect(actions.querySelector('[data-diagram-action="open"]')).not.toBeNull()
    await act(async () => zoom.querySelector<HTMLButtonElement>('[data-diagram-action="in"]')!.click())
    expect(zoom.querySelector('.diagram-hud-level')?.textContent).toBe('125%')
    // Multiplicative compounding: 125 × 1.25 = 156.25 → rounded label 156%.
    await act(async () => zoom.querySelector<HTMLButtonElement>('[data-diagram-action="in"]')!.click())
    expect(zoom.querySelector('.diagram-hud-level')?.textContent).toBe('156%')
    // 156.25 × 0.8 = 125 exactly, proving the scale stayed fractional internally.
    await act(async () => zoom.querySelector<HTMLButtonElement>('[data-diagram-action="out"]')!.click())
    expect(zoom.querySelector('.diagram-hud-level')?.textContent).toBe('125%')
    await act(async () => zoom.querySelector<HTMLButtonElement>('[data-diagram-action="reset"]')!.click())
    expect(zoom.querySelector('.diagram-hud-level')?.textContent).toBe('100%')
    await act(async () => root.unmount())
    host.remove()
  })
  it('copies the diagram source from the actions pill', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const source = 'graph TD;A-->B;'
    const html = `<figure class="diagram"><div class="mermaid" data-mermaid-source="${encodeURIComponent(source)}"></div></figure>`
    const { host, root } = await mount(rendered(html, true))
    const copy = host.querySelector<HTMLButtonElement>('.diagram-hud [data-diagram-action="copy"]')!
    await act(async () => copy.click())
    expect(writeText).toHaveBeenCalledWith(source)
    expect(copy.classList.contains('is-copied')).toBe(true)
    await act(async () => root.unmount())
    host.remove()
  })
})

describe('inspector', () => {
  const doc = {
    path: '/tmp/guide.md',
    name: 'guide.md',
    contents: '# Title\n\nSome words here.',
    modifiedMs: 1_700_000_000_000,
    sizeBytes: 24,
  }
  const stats = { words: 4, characters: 24, lines: 3, headings: 1, links: 0, images: 0 }
  const baseProps = {
    mode: 'document' as const,
    document: doc,
    stats,
    selectionStats: null,
    frontmatter: [],
    locale: 'zh-CN' as const,
    onModeChange: vi.fn(),
    onCopyPath: vi.fn(),
    onRevealPath: vi.fn(),
  }
  it('converges to the upstream Document and Properties tabs', () => {
    const html = renderToStaticMarkup(<Inspector {...baseProps} />)
    const tabs = html.match(/role="tab"/g) ?? []
    expect(tabs).toHaveLength(2)
    expect(html).toContain('aria-label="文稿"')
    expect(html).toContain('aria-label="属性"')
    // The Document tab carries the upstream grouped fields.
    expect(html).toContain('文件名')
    expect(html).toContain('完整路径')
    expect(html).toContain('文稿类型')
    expect(html).toContain('文件大小')
    expect(html).toContain('单词数')
    expect(html).toContain('标题')
    expect(html).toContain('修改日期')
    // The removed tabs are gone.
    expect(html).not.toContain('出链')
    expect(html).not.toContain('反向链接')
  })
  it('shows frontmatter on the Properties tab and an empty message otherwise', () => {
    const empty = renderToStaticMarkup(<Inspector {...baseProps} mode="properties" />)
    expect(empty).toContain('无前置元数据')
    const filled = renderToStaticMarkup(<Inspector {...baseProps} mode="properties" frontmatter={[{ key: 'title', value: 'Guide' }]} />)
    expect(filled).toContain('title')
    expect(filled).toContain('Guide')
    expect(filled).not.toContain('无前置元数据')
  })
  it('switches the count rows to the selection with a Selected suffix', () => {
    const html = renderToStaticMarkup(
      <Inspector {...baseProps} selectionStats={{ words: 2, characters: 10, lines: 1, headings: 0, links: 0, images: 0 }} />,
    )
    // Words, characters and lines each gain the "- 已选中" suffix.
    expect((html.match(/已选中/g) ?? []).length).toBe(3)
    expect(html).toContain('inspector-selected-suffix')
  })
  it('calls onModeChange when a tab is clicked', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onModeChange = vi.fn()
    await act(async () => root.render(<Inspector {...baseProps} onModeChange={onModeChange} />))
    const properties = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (tab) => tab.getAttribute('aria-label') === '属性',
    )!
    await act(async () => properties.click())
    expect(onModeChange).toHaveBeenCalledWith('properties')
    await act(async () => root.unmount())
    host.remove()
  })
})

describe('update pill', () => {
  const handlers = () => ({
    locale: 'zh-CN' as const,
    onDownload: vi.fn(),
    onRelaunch: vi.fn(),
    onWhatsNew: vi.fn(),
    onClose: vi.fn(),
  })
  it('renders nothing while idle', () => {
    expect(renderToStaticMarkup(<UpdatePill {...handlers()} status={{ state: 'idle' }} />)).toBe('')
  })
  it('shows a spinner with no buttons while checking', () => {
    const html = renderToStaticMarkup(<UpdatePill {...handlers()} status={{ state: 'checking' }} />)
    expect(html).toContain('正在检查更新')
    expect(html).toContain('update-pill-spinner')
    expect(html).not.toContain('update-pill-action')
    expect(html).not.toContain('update-pill-close')
  })
  it('offers Download and a close button when an update is available', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const props = handlers()
    await act(async () => root.render(<UpdatePill {...props} status={{ state: 'available', version: '9.9.9' }} />))
    expect(host.textContent).toContain('有可用的更新')
    const action = host.querySelector<HTMLButtonElement>('.update-pill-action')!
    expect(action.textContent).toBe('下载')
    await act(async () => action.click())
    expect(props.onDownload).toHaveBeenCalledTimes(1)
    const close = host.querySelector<HTMLButtonElement>('.update-pill-close')!
    await act(async () => close.click())
    expect(props.onClose).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
  it('uses the upstream English wording', () => {
    const html = renderToStaticMarkup(<UpdatePill {...handlers()} locale="en" status={{ state: 'available', version: '9.9.9' }} />)
    expect(html).toContain('An update is available')
    expect(html).toContain('Download')
  })
  it('shows the download percent with a progress ring and a cancel close', () => {
    const html = renderToStaticMarkup(<UpdatePill {...handlers()} status={{ state: 'downloading', progress: 42 }} />)
    expect(html).toContain('正在下载更新')
    expect(html).toContain('42%')
    expect(html).toContain('update-pill-ring')
    expect(html).toContain('update-pill-close')
    expect(html).not.toContain('update-pill-action')
  })
  it('shows Preparing update with a percent and no buttons', () => {
    const html = renderToStaticMarkup(<UpdatePill {...handlers()} status={{ state: 'preparing', progress: 100 }} />)
    expect(html).toContain('正在准备更新')
    expect(html).toContain('100%')
    expect(html).not.toContain('update-pill-action')
    expect(html).not.toContain('update-pill-close')
  })
  it('shows Update installed with Relaunch Now once ready', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const props = handlers()
    await act(async () => root.render(<UpdatePill {...props} status={{ state: 'ready', version: '9.9.9' }} />))
    expect(host.textContent).toContain('更新已安装。')
    const action = host.querySelector<HTMLButtonElement>('.update-pill-action')!
    expect(action.textContent).toBe('立即重新启动')
    await act(async () => action.click())
    expect(props.onRelaunch).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
  it('auto-hides the up-to-date capsule after four seconds', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const props = handlers()
    await act(async () => root.render(<UpdatePill {...props} status={{ state: 'current' }} />))
    expect(host.textContent).toContain('TextMark 已是最新版本')
    expect(host.querySelector('.update-pill')).not.toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    expect(props.onClose).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
    vi.useRealTimers()
  })
  it('shows Update failed with a close button and no action', () => {
    const html = renderToStaticMarkup(<UpdatePill {...handlers()} status={{ state: 'error', errorCode: 'update_network' }} />)
    expect(html).toContain('更新失败')
    expect(html).toContain('update-pill-close')
    expect(html).not.toContain('update-pill-action')
  })
  it('greets a new version with What’s New and no close button', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const props = handlers()
    await act(async () => root.render(<UpdatePill {...props} status={{ state: 'updated', version: '1.2.3' }} />))
    expect(host.textContent).toContain('已更新至 1.2.3')
    expect(host.querySelector('.update-pill-close')).toBeNull()
    const action = host.querySelector<HTMLButtonElement>('.update-pill-action')!
    expect(action.textContent).toBe('新功能')
    await act(async () => action.click())
    expect(props.onWhatsNew).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
})
