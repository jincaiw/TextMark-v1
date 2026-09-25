import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ConflictDialog } from './ConflictDialog'
import { DraftRecoveryDialog } from './DraftRecoveryDialog'
import { DocumentTabs } from './DocumentTabs'
import { FindBar } from './FindBar'
import { ToolbarCustomizer } from './ToolbarCustomizer'
import { SettingsDialog } from './SettingsDialog'
import { PreviewPane } from './PreviewPane'
import { Sidebar } from './Sidebar'
import { UnsavedCloseDialog } from './UnsavedCloseDialog'
import type { DocumentSession, RenderedMarkdown } from '../types'

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
  editorFontSize: 15,
  lineHeight: 1.66,
  pagePaddingHorizontal: 56,
  documentFont: 'system',
  themePreset: 'normal',
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
  onEditorFontSizeChange: vi.fn(),
  onLineHeightChange: vi.fn(),
  onPagePaddingHorizontalChange: vi.fn(),
  onDocumentFontChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onThemeColorChange: vi.fn(),
  onThemeColorsReset: vi.fn(),
  onAutoSaveIntervalChange: vi.fn(),
  onOpenDocumentsInTabsChange: vi.fn(),
  onAlwaysOnTopChange: vi.fn(),
  onZoomChange: vi.fn(),
  onDefaultOpenTargetChange: vi.fn(),
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
  it('keeps a single macOS tab visible and exposes a localized new-tab action', async () => {
    const onNew = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <DocumentTabs
          sessions={[session('a', 'A.md')]}
          activeId="a"
          locale="zh-CN"
          alwaysVisible
          onNew={onNew}
          onActivate={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    )
    expect(host.querySelector('.document-tab')).not.toBeNull()
    const newTab = host.querySelector<HTMLButtonElement>('.new-tab-button')!
    expect(newTab.getAttribute('aria-label')).toBe('新建标签页')
    await act(async () => newTab.click())
    expect(onNew).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
    host.remove()
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
  it('keeps LLM applications out of the default editor target preference', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} />)
    expect(html).toContain('Visual Studio Code')
    expect(html).not.toContain('ChatGPT')
    expect(html).not.toContain('Missing Editor')
  })
  it('exposes the reading typography controls in the settings dialog', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} locale="zh-CN" />)
    expect(html).toContain('行高')
    expect(html).toContain('左右页边距')
    // The sliders must carry the live values; the markup is what proves the
    // controls are reachable at all.
    expect(html).toContain('value="1.66"')
    expect(html).toContain('value="56"')
    expect(html).toContain('max="96"')
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

  it('wraps preview code in a language card with a working wrap toggle', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const rendered: RenderedMarkdown = {
      html: '<pre class="hljs"><code class="language-typescript">const message = "hello"</code></pre>',
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
      documentKey: 'code-card',
      initialScrollTop: 0,
      baseDirectory: null,
      workspacePath: null,
      zoom: 100,
      contentWidth: 'normal' as const,
      searchQuery: '',
      searchIndex: 0,
      matchCase: false,
      searchMode: 'contains' as const,
      locale: 'en' as const,
      onSearchCount: vi.fn(),
      onActiveHeading: vi.fn(),
      onZoomChange: vi.fn(),
      onOpenRelative: vi.fn(),
      onRenameImage: vi.fn(),
      onToggleTask: vi.fn(),
      onEditTable: vi.fn(),
    }
    await act(async () => root.render(<PreviewPane {...props} />))
    expect(host.querySelector('.md-code-language')?.textContent).toBe('typescript')
    const card = host.querySelector<HTMLElement>('.md-code-card')!
    const wrap = host.querySelector<HTMLButtonElement>('.md-code-toggle-wrap')!
    expect(card.classList.contains('is-wrapped')).toBe(false)
    await act(async () => wrap.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(card.classList.contains('is-wrapped')).toBe(true)
    expect(wrap.getAttribute('aria-pressed')).toBe('true')
    await act(async () => root.unmount())
    host.remove()
  })
})
