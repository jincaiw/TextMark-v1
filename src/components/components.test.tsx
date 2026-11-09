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
  strictLineBreaks: false,
  pagePaddingHorizontal: 56,
  documentFont: 'system',
  themePreset: 'normal',
  themeColors: {},
  autoSaveIntervalMinutes: 0,
  openDocumentsInTabs: false,
  openMarkdownLinksInNewWindows: false,
  textAlignment: 'automatic' as const,
  readerLayout: {
    boldText: false,
    isCustomized: false,
    lineSpacing: 1.6,
    characterSpacingPercent: 0,
    wordSpacingPercent: 0,
    marginsPercent: 0,
  },
  outlineFollowsPointer: false,
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
  localeSetting: 'en',
  crashReports: false,
  crashReportsAvailable: false,
  sharesUsageAnalytics: false,
  updateChannel: 'stable',
  autoCheckUpdates: true,
  autoDownloadUpdates: false,
  lastUpdateCheckAt: null,
  updateStatus: { state: 'idle' },
  onLocaleChange: vi.fn(),
  onCrashReportsChange: vi.fn(),
  onUsageAnalyticsChange: vi.fn(),
  onUpdateChannelChange: vi.fn(),
  onAutoCheckUpdatesChange: vi.fn(),
  onAutoDownloadUpdatesChange: vi.fn(),
  onCheckUpdate: vi.fn(),
  onInstallUpdate: vi.fn(),
  onRelaunchUpdate: vi.fn(),
  onThemeChange: vi.fn(),
  onContentWidthChange: vi.fn(),
  onEditorFontSizeChange: vi.fn(),
  onLineHeightChange: vi.fn(),
  onStrictLineBreaksChange: vi.fn(),
  onPagePaddingHorizontalChange: vi.fn(),
  onTextAlignmentChange: vi.fn(),
  onOutlineFollowsPointerChange: vi.fn(),
  onReaderLayoutChange: vi.fn(),
  onDocumentFontChange: vi.fn(),
  onThemePresetChange: vi.fn(),
  onThemeColorChange: vi.fn(),
  onThemeColorsReset: vi.fn(),
  onAutoSaveIntervalChange: vi.fn(),
  onOpenDocumentsInTabsChange: vi.fn(),
  onOpenMarkdownLinksInNewWindowsChange: vi.fn(),
  supportCardDismissed: false,
  onSupportCardDismissedChange: vi.fn(),
  onAlwaysOnTopChange: vi.fn(),
  onZoomChange: vi.fn(),
  onDefaultOpenTargetChange: vi.fn(),
  onInstallCli: vi.fn(),
  onClose: vi.fn(),
} satisfies ComponentProps<typeof SettingsDialog>

describe('localized desktop components', () => {
  it('keeps replace controls collapsed until requested and preserves search modes', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    await act(async () =>
      root.render(
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
      ),
    )
    expect(host.textContent).toContain('第 1 项，共 2 项')
    expect(host.querySelector('[title="上一个匹配项"]')).not.toBeNull()
    expect(host.querySelector('[title="下一个匹配项"]')).not.toBeNull()
    expect(host.textContent).not.toContain('包含')
    await act(async () => host.querySelector<HTMLButtonElement>('.find-replace-toggle')!.click())
    expect(host.textContent).toContain('包含')
    expect(host.textContent).toContain('开头为')
    expect(host.querySelector('.find-replace-row')).not.toBeNull()
    await act(async () => root.unmount())
  })
  it('can render find actions without a duplicate query field when search lives in the toolbar', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    await act(async () =>
      root.render(
        <FindBar
          locale="zh-CN"
          query="Text"
          current={0}
          count={2}
          matchCase={false}
          mode="contains"
          hideQuery
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
      ),
    )
    expect(host.querySelector('.find-query')).toBeNull()
    expect(host.querySelector('[title="下一个匹配项"]')).not.toBeNull()
    expect(host.textContent).toContain('第 1 项，共 2 项')
    await act(async () => root.unmount())
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
  it('moves toolbar items left and right with explicit order controls', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onChange = vi.fn()
    await act(async () =>
      root.render(
        <ToolbarCustomizer
          open
          locale="en"
          items={['sidebar', 'search']}
          displayMode="iconOnly"
          onChange={onChange}
          onDisplayModeChange={vi.fn()}
          onClose={vi.fn()}
        />,
      ),
    )

    const cards = host.querySelectorAll<HTMLElement>('.tc-current-item')
    const firstItemRight = cards[0].querySelectorAll<HTMLButtonElement>('.tc-order-button')[1]
    expect(cards[0].querySelector<HTMLButtonElement>('.tc-order-button')!.disabled).toBe(true)
    await act(async () => firstItemRight.click())
    expect(onChange).toHaveBeenLastCalledWith(['search', 'sidebar'])

    await act(async () => root.unmount())
    host.remove()
  })
  it('groups the default open target into Editors and AI apps like upstream', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} />)
    expect(html).toContain('<optgroup label="Editors"')
    expect(html).toContain('<optgroup label="AI apps"')
    // Editors first, then AI apps; unavailable apps stay out of both groups.
    expect(html.indexOf('Visual Studio Code')).toBeGreaterThan(html.indexOf('<optgroup label="Editors"'))
    expect(html.indexOf('ChatGPT')).toBeGreaterThan(html.indexOf('<optgroup label="AI apps"'))
    expect(html).not.toContain('Missing Editor')
  })
  it('exposes the reading typography controls in the settings dialog', () => {
    const html = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} locale="zh-CN" initialPane="reading" />)
    expect(html).toContain('行高')
    expect(html).toContain('左右页边距')
    expect(html).toContain('将软换行显示为换行')
    expect(html).toContain('文本对齐')
    expect(html).toContain('两端对齐')
    expect(html).toContain('高亮指针下的大纲章节')
    // The sliders must carry the live values; the markup is what proves the
    // controls are reachable at all.
    expect(html).toContain('value="1.66"')
    expect(html).toContain('value="56"')
    expect(html).toContain('max="96"')
    // General no longer hosts the reading controls.
    const general = renderToStaticMarkup(<SettingsDialog {...settingsDialogProps} locale="zh-CN" />)
    expect(general).not.toContain('行高')
  })
  it('allows enabling the strict soft-break reading preference', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const onStrictLineBreaksChange = vi.fn()
    await act(async () =>
      root.render(
        <SettingsDialog
          {...settingsDialogProps}
          locale="zh-CN"
          initialPane="reading"
          onStrictLineBreaksChange={onStrictLineBreaksChange}
        />,
      ),
    )
    const setting = [...host.querySelectorAll('label')].find((label) => label.textContent?.includes('将软换行显示为换行'))
    const checkbox = setting?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox?.checked).toBe(false)
    await act(async () => checkbox?.click())
    expect(onStrictLineBreaksChange).toHaveBeenCalledWith(true)
    await act(async () => root.unmount())
    host.remove()
  })
  it('exposes the advanced tools: CLI install and App Link reset', async () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const onInstallCli = vi.fn()
    await act(async () =>
      root.render(<SettingsDialog {...settingsDialogProps} locale="en" initialPane="advanced" onInstallCli={onInstallCli} />),
    )
    expect(host.textContent).toContain('Command line tools')
    expect(host.textContent).toContain('App links')
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.settings-advanced-row button')]
    expect(buttons.map((button) => button.textContent)).toEqual(['Install…', 'Reset App Link Approvals'])
    await act(async () => buttons[0]!.click())
    expect(onInstallCli).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
  it('shows the dismissible support card on General and hides it once dismissed', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onSupportCardDismissedChange = vi.fn()
    await act(async () =>
      root.render(<SettingsDialog {...settingsDialogProps} locale="en" onSupportCardDismissedChange={onSupportCardDismissedChange} />),
    )
    expect(host.textContent).toContain('Buy the developer a coffee')
    const dismiss = host.querySelector<HTMLButtonElement>('.settings-support-dismiss')!
    await act(async () => dismiss.click())
    expect(onSupportCardDismissedChange).toHaveBeenCalledWith(true)

    // Once dismissed, the card never renders again.
    await act(async () =>
      root.render(
        <SettingsDialog
          {...settingsDialogProps}
          locale="en"
          supportCardDismissed
          onSupportCardDismissedChange={onSupportCardDismissedChange}
        />,
      ),
    )
    expect(host.querySelector('.settings-support-card')).toBeNull()

    // The privacy ⓘ disclosure toggles inline next to the analytics switch.
    await act(async () =>
      root.render(
        <SettingsDialog
          {...settingsDialogProps}
          locale="en"
          initialPane="privacy"
          supportCardDismissed
          onSupportCardDismissedChange={onSupportCardDismissedChange}
        />,
      ),
    )
    const info = host.querySelector<HTMLButtonElement>('.privacy-info-button')!
    expect(info.getAttribute('aria-expanded')).toBe('false')
    await act(async () => info.click())
    expect(info.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('.privacy-detail-popover')).not.toBeNull()
    await act(async () => root.unmount())
    host.remove()
  })
  it('copies the version string when the About version chip is clicked', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const writeText = vi.fn().mockResolvedValue(undefined)
    const clipboard = (navigator as unknown as { clipboard?: { writeText: unknown } }).clipboard
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      await act(async () => root.render(<SettingsDialog {...settingsDialogProps} locale="en" initialPane="about" />))
      const chip = host.querySelector<HTMLElement>('.settings-version')!
      expect(chip.textContent).toMatch(/^v\d+\.\d+\.\d+/)
      expect(chip.getAttribute('role')).toBe('button')

      await act(async () => chip.click())
      expect(writeText).toHaveBeenCalledWith(chip.textContent)
      expect(chip.getAttribute('title')).toBe('Copied')

      // Keyboard activation copies too.
      await act(async () => chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
      expect(writeText).toHaveBeenCalledTimes(2)
      await act(async () => root.unmount())
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
    }
    host.remove()
  })
  it('renders the document name as the outline title row without duplicate mode controls', () => {
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
    // The file name is the outline's first row (upstream TitleItem), not a
    // pinned header outside the scrolling list.
    expect(html).toContain('<div class="outline-title-row" title="README.md">README.md</div>')
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
  it('expands a collapsed ancestor when the active heading scrolls into it', async () => {
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
      documentKey: 'doc-reveal',
      files: [],
      workspacePath: null,
      activePath: null,
      outline,
      activeHeading: null as string | null,
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
    await act(async () => disclosure().click())
    expect(rows()).toHaveLength(2)
    expect(disclosure().getAttribute('aria-expanded')).toBe('false')

    // Reading past the folded section reveals the active row instead of
    // letting the position indicator disappear (upstream scroll follow).
    await act(async () => root.render(<Sidebar {...props} activeHeading="intro-deep" />))
    expect(rows()).toHaveLength(4)
    expect(disclosure().getAttribute('aria-expanded')).toBe('true')

    // The reader can fold it again; the same active heading does not fight
    // the manual choice back open.
    await act(async () => disclosure().click())
    await act(async () => root.render(<Sidebar {...props} activeHeading="intro-deep" />))
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
  it('persists expanded navigator folders per workspace and restores them across remounts', async () => {
    window.localStorage.clear()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const files = [
      {
        name: 'docs',
        path: '/tmp/docs',
        isDirectory: true,
        children: [{ name: 'guide.md', path: '/tmp/docs/guide.md', isDirectory: false, children: [] }],
      },
      { name: 'intro.md', path: '/tmp/intro.md', isDirectory: false, children: [] },
    ]
    const props = {
      mode: 'files' as const,
      fileName: 'intro.md',
      documentKey: 'doc',
      files,
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
      locale: 'en' as const,
    }
    const treeRows = () => host.querySelectorAll('.tree-row')

    await act(async () => root.render(<Sidebar {...props} />))
    // Top-level file rows render without expansion; the folder is collapsed.
    expect(treeRows()).toHaveLength(2)
    expect(treeRows()[0]!.getAttribute('aria-expanded')).toBe('false')

    await act(async () => (treeRows()[0] as HTMLButtonElement).click())
    expect(treeRows()).toHaveLength(3) // docs + guide.md + intro.md
    expect(window.localStorage.getItem('textmark.treeExpanded')).toContain('/tmp/docs')

    // A fresh mount replays the stored expansion for the same workspace.
    await act(async () => root.unmount())
    const remountRoot = createRoot(host)
    await act(async () => remountRoot.render(<Sidebar {...props} />))
    expect(treeRows()).toHaveLength(3)
    expect(treeRows()[0]!.getAttribute('aria-expanded')).toBe('true')

    // A different workspace starts compact: expansion state is per workspace.
    await act(async () =>
      remountRoot.render(
        <Sidebar {...props} workspacePath="/other" files={[{ name: 'docs', path: '/other/docs', isDirectory: true, children: [] }]} />,
      ),
    )
    expect(treeRows()).toHaveLength(1)
    expect(treeRows()[0]!.getAttribute('aria-expanded')).toBe('false')

    await act(async () => remountRoot.unmount())
    host.remove()
    window.localStorage.clear()
  })
  it('reveals filter matches, then restores the pre-filter expansion when the filter clears', async () => {
    window.localStorage.clear()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const files = [
      {
        name: 'docs',
        path: '/tmp/docs',
        isDirectory: true,
        children: [
          {
            name: 'nested',
            path: '/tmp/docs/nested',
            isDirectory: true,
            children: [{ name: 'guide.md', path: '/tmp/docs/nested/guide.md', isDirectory: false, children: [] }],
          },
          { name: 'other.md', path: '/tmp/docs/other.md', isDirectory: false, children: [] },
        ],
      },
    ]
    const props = {
      mode: 'files' as const,
      fileName: 'guide.md',
      documentKey: 'doc',
      files,
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
      locale: 'en' as const,
    }
    const treeRows = () => host.querySelectorAll('.tree-row')

    await act(async () => root.render(<Sidebar {...props} />))
    expect(treeRows()).toHaveLength(1)

    // Filtering by "guide" auto-reveals every ancestor of the match.
    const filterInput = host.querySelector<HTMLInputElement>('.sidebar-filter-field input')!
    const nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      nativeInputSetter.call(filterInput, 'guide')
      filterInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(treeRows().length).toBeGreaterThanOrEqual(3) // docs, nested, guide.md
    expect(host.textContent).toContain('guide.md')

    // Clearing the filter restores the pre-filter shape: everything folded.
    await act(async () => {
      nativeInputSetter.call(filterInput, '')
      filterInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(treeRows()).toHaveLength(1)
    expect(treeRows()[0]!.getAttribute('aria-expanded')).toBe('false')

    await act(async () => root.unmount())
    host.remove()
    window.localStorage.clear()
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
      textAlignment: 'automatic' as const,
      outlineFollowsPointer: false,
      documentFont: 'system' as const,
      themePreset: 'normal' as const,
      themeColors: {},
      searchIndex: 0,
      matchCase: false,
      searchMode: 'contains' as const,
      locale: 'zh-CN' as const,
      onSearchCount: vi.fn(),
      onActiveHeading: vi.fn(),
      onZoomChange: vi.fn(),
      onOpenRelative: vi.fn(),
      onRenameImage: vi.fn(),
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

  it('injects the upstream prose-only alignment block when a non-automatic alignment is set', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const base: RenderedMarkdown = {
      html: '<p>TextMark body</p>',
      outline: [],
      hasMermaid: false,
      hasMath: false,
      frontmatter: [],
      sourceMap: [],
      tables: [],
      tasks: [],
      optionalRenderers: [],
      direction: 'auto' as const,
    }
    const props = {
      rendered: base,
      documentKey: 'doc',
      initialScrollTop: 0,
      baseDirectory: null,
      workspacePath: null,
      zoom: 100,
      contentWidth: 'normal' as const,
      textAlignment: 'justified' as const,
      outlineFollowsPointer: false,
      documentFont: 'system' as const,
      themePreset: 'normal' as const,
      themeColors: {},
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
    }
    await act(async () => root.render(<PreviewPane {...props} />))
    const style = host.querySelector('style')!
    expect(style.textContent).toContain('text-align: justify')
    // Prose-only selector, upstream shape.
    expect(style.textContent).toContain(':is(p, li, dt, dd, h1, h2, h3, h4, h5, h6)')
    expect(style.textContent).toContain('.mermaid *')
    // Code cards recover a start alignment inside an aligned list.
    expect(style.textContent).toContain('.md-code-card')
    await act(async () => root.render(<PreviewPane {...props} textAlignment="automatic" />))
    expect(host.querySelector('style')).toBeNull()
    await act(async () => root.unmount())
    host.remove()
  })

  it('keeps task checkboxes and Markdown tables read-only in preview mode', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const rendered: RenderedMarkdown = {
      html: '<ul><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox">Task</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table>',
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
      documentKey: 'readonly-preview',
      initialScrollTop: 0,
      baseDirectory: null,
      workspacePath: null,
      zoom: 100,
      contentWidth: 'normal' as const,
      textAlignment: 'automatic' as const,
      outlineFollowsPointer: false,
      documentFont: 'system' as const,
      themePreset: 'normal' as const,
      themeColors: {},
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
    }
    await act(async () => root.render(<PreviewPane {...props} />))
    const checkbox = host.querySelector<HTMLInputElement>('.task-list-item-checkbox')!
    const cell = host.querySelector<HTMLTableCellElement>('td')!
    expect(checkbox.disabled).toBe(true)
    expect(checkbox.tabIndex).toBe(-1)
    await act(async () => cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(cell.getAttribute('contenteditable')).toBeNull()
    await act(async () => cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
    expect(host.querySelector('.table-context-menu')).toBeNull()
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
      textAlignment: 'automatic' as const,
      outlineFollowsPointer: false,
      documentFont: 'system' as const,
      themePreset: 'normal' as const,
      themeColors: {},
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
    }
    await act(async () => root.render(<PreviewPane {...props} />))
    expect(host.querySelector('.md-code-language')?.textContent).toBe('typescript')
    const card = host.querySelector<HTMLElement>('.md-code-card')!
    const wrap = host.querySelector<HTMLButtonElement>('.md-code-toggle-wrap')!
    const copy = host.querySelector<HTMLButtonElement>('.md-code-copy')!
    expect(Array.from(host.querySelector('.md-code-actions')!.children).map((button) => (button as HTMLElement).className)).toEqual([
      'md-code-action md-code-toggle-wrap',
      'md-code-action md-code-copy',
    ])
    expect(wrap.getAttribute('aria-label')).toBe('Wrap code')
    expect(copy.getAttribute('aria-label')).toBe('Copy code')
    expect(copy.querySelector('svg')).not.toBeNull()
    expect(copy.textContent).toBe('')
    expect(card.classList.contains('is-wrapped')).toBe(false)
    await act(async () => wrap.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(card.classList.contains('is-wrapped')).toBe(true)
    expect(wrap.getAttribute('aria-pressed')).toBe('true')
    expect(wrap.getAttribute('aria-label')).toBe('Unwrap code')
    await act(async () => root.unmount())
    host.remove()
  })
  it('keeps footnote fragment navigation inside the preview scroller', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const rendered: RenderedMarkdown = {
      html: '<p>Reference<a href="#fn1" class="footnote-ref">1</a></p><section class="footnotes"><ol><li id="fn1">Footnote text</li></ol></section>',
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
      documentKey: 'footnotes',
      initialScrollTop: 0,
      baseDirectory: null,
      workspacePath: null,
      zoom: 100,
      contentWidth: 'normal' as const,
      textAlignment: 'automatic' as const,
      outlineFollowsPointer: false,
      documentFont: 'system' as const,
      themePreset: 'normal' as const,
      themeColors: {},
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
    }
    await act(async () => root.render(<PreviewPane {...props} />))
    const pane = host.querySelector<HTMLElement>('.preview-pane')!
    const note = host.querySelector<HTMLElement>('#fn1')!
    pane.scrollTop = 16
    pane.scrollTo = vi.fn()
    pane.getBoundingClientRect = () => ({ top: 80 }) as DOMRect
    note.getBoundingClientRect = () => ({ top: 380 }) as DOMRect

    await act(async () => host.querySelector<HTMLAnchorElement>('.footnote-ref')!.click())

    expect(pane.scrollTo).toHaveBeenCalledWith({ top: 316, behavior: 'smooth' })
    expect(window.location.hash).toBe('#fn1')
    await act(async () => root.unmount())
    host.remove()
    window.history.replaceState(window.history.state, '', window.location.pathname)
  })
})
