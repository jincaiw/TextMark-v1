import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const [
  url = 'http://127.0.0.1:1420/',
  output = join(tmpdir(), 'textmark-ui.png'),
  widthText = '1440',
  heightText = '900',
  scenario = 'preview',
] = process.argv.slice(2)
const width = Number(widthText)
const height = Number(heightText)
const chrome = process.env.TEXTMARK_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error(`Chrome is unavailable: ${chrome}`)

const profile = mkdtempSync(join(tmpdir(), 'textmark-chrome-'))
const processHandle = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    url,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
let chromeLog = ''
let chromeExitCode
processHandle.stderr.on('data', (chunk) => {
  chromeLog += chunk.toString()
})
processHandle.once('exit', (code) => {
  chromeExitCode = code
})

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
for (let attempt = 0; attempt < 600 && !existsSync(join(profile, 'DevToolsActivePort')) && chromeExitCode === undefined; attempt += 1)
  await delay(50)
if (!existsSync(join(profile, 'DevToolsActivePort')))
  throw new Error(`Chrome debugging endpoint did not start (exit ${chromeExitCode ?? 'still running'}).\n${chromeLog}`)
const [port] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n')

let page
for (let attempt = 0; attempt < 50; attempt += 1) {
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
  page = targets.find((target) => target.type === 'page' && target.url.startsWith(url))
  if (page) break
  await delay(50)
}
if (!page) throw new Error('Chrome page target was not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})
let commandId = 0
const pending = new Map()
const failures = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
  if (message.method === 'Runtime.exceptionThrown')
    failures.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description ?? ''))
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type))
    failures.push(message.params.args.map((argument) => argument.value ?? argument.description).join(' '))
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++commandId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const visibleExpression = `(element) => {
  if (!element || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
}`
const waitFor = async (condition, description) => {
  const deadline = Date.now() + 6_000
  while (Date.now() < deadline) {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { const isVisible = ${visibleExpression}; return Boolean(${condition}); })()`,
      returnByValue: true,
    })
    if (result.result.value) return true
    await delay(50)
  }
  failures.push(`等待超时（6 秒）：${description}`)
  return false
}
const readToolsState = async () => {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
      const identify = (element) => element ? {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: element.className,
        label: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim().slice(0, 80) || '',
      } : null;
      const describeScroll = (element) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return {
          ...identify(element), rect: rect(element),
          scrollTop: element.scrollTop, scrollLeft: element.scrollLeft,
          scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
          overflowX: style.overflowX, overflowY: style.overflowY,
          padding: style.padding, scrollPaddingTop: style.scrollPaddingTop,
        };
      };
      const workspace = document.querySelector('.document-workspace');
      const tools = workspace?.querySelector('.document-tools');
      const find = tools?.querySelector('.find-bar');
      const formatting = tools?.querySelector('.formatting-toolbar');
      const content = workspace?.querySelector('.cm-content');
      const preview = workspace?.querySelector('.preview-pane');
      const scroller = workspace?.querySelector('.cm-scroller');
      let scrollContainer = content || preview;
      while (scrollContainer && !/^(auto|scroll)$/.test(getComputedStyle(scrollContainer).overflowY)) {
        scrollContainer = scrollContainer.parentElement;
      }
      const bounds = rect(workspace);
      const controls = [...(tools?.querySelectorAll(
        'button, input, select, textarea, summary, a[href], [role="button"], [role="tab"], [role="combobox"], [tabindex], [contenteditable="true"]'
      ) || [])].filter((element) => {
        const box = element.getBoundingClientRect();
        // 不按视口筛选，否则完全越界的控件会逃过检查。
        return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && box.width > 0 && box.height > 0;
      }).map((element) => {
        const box = rect(element);
        const bar = element.closest('.formatting-toolbar');
        const horizontalScrollException = Boolean(bar && /^(auto|scroll)$/.test(getComputedStyle(bar).overflowX) && bar.scrollWidth > bar.clientWidth);
        const withinWorkspace = Boolean(bounds && box.top >= bounds.top - 0.5 && box.bottom <= bounds.bottom + 0.5 &&
          (horizontalScrollException || (box.left >= bounds.left - 0.5 && box.right <= bounds.right + 0.5)));
        return { ...identify(element), rect: box, horizontalScrollException, withinWorkspace };
      });
      const cssHeight = workspace ? getComputedStyle(workspace).getPropertyValue('--document-tools-height').trim() : '';
      return {
        rects: {
          tabs: rect(document.querySelector('.document-tabs')),
          sidebar: rect(document.querySelector('.native-sidebar')),
          workspace: bounds,
          editor: rect(workspace?.querySelector('.cm-editor')),
          scroller: rect(scroller),
          tools: rect(tools), find: rect(find), formatting: rect(formatting),
        },
        height: tools?.getBoundingClientRect().height ?? 0,
        cssHeight, cssHeightPx: parseFloat(cssHeight) || 0,
        position: tools ? getComputedStyle(tools).position : null,
        padding: {
          tools: tools ? getComputedStyle(tools).padding : null,
          content: content ? getComputedStyle(content).padding : null,
          contentTop: content ? parseFloat(getComputedStyle(content).paddingTop) : null,
          scroller: scroller ? getComputedStyle(scroller).padding : null,
          preview: preview ? getComputedStyle(preview).padding : null,
          previewBeforeHeight: preview ? getComputedStyle(preview, '::before').height : null,
        },
        focus: {
          ...identify(document.activeElement),
          inFind: Boolean(find?.contains(document.activeElement)),
          inEditor: Boolean(content?.contains(document.activeElement)),
        },
        heightChain: (() => { const out=[]; let e=scroller; while(e && e !== document.body) { const s=getComputedStyle(e); out.push({className:e.className,height:s.height,minHeight:s.minHeight,display:s.display,gridRow:s.gridRow,rows:s.gridTemplateRows}); e=e.parentElement; } return out; })(),
        scrollTop: scroller?.scrollTop ?? null,
        scrollContainer: describeScroll(scrollContainer),
        scrollContainers: [...document.querySelectorAll('.document-workspace, .editor-pane, .cm-editor, .cm-scroller, .preview-pane')].map(describeScroll),
        activeTab: document.querySelector('.document-tab[aria-selected="true"] .tab-label')?.textContent?.trim() ?? null,
        visibleTabCount: [...document.querySelectorAll('.document-tab')].filter(${visibleExpression}).length,
        controls,
        overflowingControls: controls.filter((control) => !control.withinWorkspace),
      };
    })()`,
    returnByValue: true,
  })
  if (result.exceptionDetails) throw new Error(`工具状态采集失败：${result.exceptionDetails.text}`)
  return result.result.value
}
let tabsFind
let searchReplace
let sidebarTracking
let workspacePanels
let appearance
const toolsMeasuredCondition = `(() => {
  const tools = document.querySelector('.document-tools');
  const workspace = document.querySelector('.document-workspace');
  const height = workspace ? parseFloat(getComputedStyle(workspace).getPropertyValue('--document-tools-height')) : 0;
  return tools && height > 0 && Math.abs(height - tools.getBoundingClientRect().height) <= 0.5;
})()`
const toolbarFixtures = {
  'print-inspector': {
    toolbar: [
      'flexibleSpace',
      'sidebar',
      'flexibleSpace',
      'openActions',
      'space',
      'themesAndSettings',
      'inspector',
      'share',
      'edit',
      'search',
    ],
  },
  'print-toast': {
    toolbar: ['sidebar', 'flexibleSpace', 'openActions', 'space', 'themesAndSettings', 'inspector', 'share', 'edit', 'search'],
  },
  'print-toast-prepared': {
    toolbar: ['sidebar', 'flexibleSpace', 'openActions', 'space', 'themesAndSettings', 'inspector', 'share', 'edit', 'search'],
  },
  'sidebar-reordered': { toolbar: ['search', 'space', 'sidebar', 'space', 'flexibleSpace', 'documentActions', 'flexibleSpace'] },
  'sidebar-deleted': { toolbar: ['flexibleSpace', 'search', 'space', 'share'] },
  'sidebar-labels': {
    toolbar: ['sidebar', 'navigation', 'flexibleSpace', 'openActions', 'space', 'themesAndSettings', 'documentActions', 'search'],
    toolbarDisplay: 'iconAndLabel',
  },
}
if (toolbarFixtures[scenario]) {
  await waitFor("isVisible(document.querySelector('.markdown-body h1'))", '配置场景初始化')
  await send('Runtime.evaluate', {
    expression: `(() => {
      const key = 'textmark.settings.v7';
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) || '{}'), ...${JSON.stringify(toolbarFixtures[scenario])} }));
      localStorage.setItem('textmark.sidebarWidth', '400');
      location.reload();
    })()`,
  })
  await delay(200)
}
const ready = await waitFor("isVisible(document.querySelector('.markdown-body h1'))", '初始预览标题可见')
if (scenario === 'edit') {
  await send('Runtime.evaluate', {
    expression: `(() => {
    const button = document.querySelector(
      '[aria-label="编辑"], [aria-label="Edit"], [aria-label="停止编辑并返回预览"], [aria-label="Stop editing and return to preview"]',
    );
    button?.click();
    return Boolean(button);
  })()`,
    returnByValue: true,
  })
} else if (scenario === 'customizer') {
  await send('Runtime.evaluate', {
    expression: `(() => {
    document.querySelector('.more-menu > summary')?.click();
    const button = [...document.querySelectorAll('.more-menu .menu-popover button')]
      .find((candidate) => /自定义工具栏|Customize Toolbar/.test(candidate.textContent ?? ''));
    button?.click();
    return Boolean(button);
  })()`,
    returnByValue: true,
  })
} else if (scenario === 'appearance' || scenario === 'appearance-dark') {
  const summarySelector = 'details.themes-and-settings > summary'
  const panelSelector = 'details.themes-and-settings > div.appearance-popover'
  const settingsExpression = "JSON.parse(localStorage.getItem('textmark.settings.v7') || '{}')"
  const openCondition = `([...document.querySelectorAll(${JSON.stringify(summarySelector)})].some((summary) =>
    isVisible(summary) && summary.parentElement.open && summary.getAttribute('aria-expanded') === 'true' &&
    isVisible(summary.parentElement.querySelector('div.appearance-popover'))))`
  const closedCondition = `![...document.querySelectorAll('details.themes-and-settings')].some((details) => details.open) &&
    ![...document.querySelectorAll(${JSON.stringify(panelSelector)})].some(isVisible)`
  const presetIds = ['normal', 'charcoal', 'redGraphite', 'darkGraphite', 'solarizedLight', 'solarizedDark', 'dracula']
  appearance = {
    assertions: {},
    actions: [],
    snapshots: {},
    mediaEmulation: {
      method: 'Emulation.setEmulatedMedia',
      feature: 'prefers-color-scheme',
      nativeOSEvidence: false,
      note: '仅验证 Chromium 媒体查询模拟，不是原生 OS 外观切换证据。',
      samples: [],
    },
  }
  const assert = (name, passed) => {
    appearance.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`${scenario} 断言失败：${name}`)
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(`外观状态采集失败：${result.exceptionDetails.text}`)
    return result.result.value
  }
  const mouseClick = async (selector, phase) => {
    const point = await evaluate(`(() => {
      const isVisible = ${visibleExpression};
      for (const element of document.querySelectorAll(${JSON.stringify(selector)})) {
        if (!isVisible(element) || element.disabled) continue;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (element.contains(document.elementFromPoint(x, y))) return {
          x, y, rect: rect.toJSON(), label: element.getAttribute('aria-label') || element.textContent.trim(),
        };
      }
      return null;
    })()`)
    appearance.actions.push({ phase, selector, point })
    assert(`${phase}.visibleClickTargetHit`, point !== null)
    if (!point) return false
    const { x, y } = point
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    return true
  }
  const readAppearanceState = async () => {
    // 采样等待渲染与过渡落定，不以断言成功作为采样条件。
    await delay(250)
    return evaluate(`(() => {
      const isVisible = ${visibleExpression};
      const summary = [...document.querySelectorAll(${JSON.stringify(summarySelector)})].find(isVisible);
      const details = summary?.parentElement;
      const panel = details?.querySelector('div.appearance-popover');
      const grid = panel?.querySelector('.appearance-presets');
      const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
      const withinViewport = (box) => Boolean(box && box.width > 0 && box.height > 0 &&
        box.left >= -0.5 && box.top >= -0.5 && box.right <= innerWidth + 0.5 && box.bottom <= innerHeight + 0.5);
      const describe = (element) => ({ rect: rect(element), visible: isVisible(element), withinViewport: withinViewport(rect(element)) });
      const colors = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        return { backgroundColor: style.backgroundColor, color: style.color };
      };
      const rootStyle = getComputedStyle(document.documentElement);
      const presets = [...(panel?.querySelectorAll('button[data-theme-preset]') || [])].map((element) => ({
        id: element.dataset.themePreset, label: element.getAttribute('aria-label'),
        pressed: element.getAttribute('aria-pressed'), ...describe(element),
      }));
      const positions = (axis) => presets.reduce((values, preset) => {
        const value = preset.rect[axis];
        if (!values.some((position) => Math.abs(position - value) <= 1)) values.push(value);
        return values;
      }, []).sort((a, b) => a - b);
      const columns = positions('left');
      const rows = positions('top');
      const settingsDialog = document.querySelector('.settings-dialog');
      return {
        settings: ${settingsExpression},
        datasetTheme: document.documentElement.dataset.theme ?? null,
        prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
        timeOrigin: performance.timeOrigin,
        viewport: { width: innerWidth, height: innerHeight },
        open: Boolean(details?.open), expanded: summary?.getAttribute('aria-expanded') ?? null,
        summary: describe(summary), panel: describe(panel),
        focus: { summary: document.activeElement === summary, inPopover: Boolean(panel?.contains(document.activeElement)) },
        geometry: {
          grid: describe(grid), gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : '',
          columns, rows, rowCounts: rows.map((top) => presets.filter((preset) => Math.abs(preset.rect.top - top) <= 1).length),
          presets,
          controls: [...(panel?.querySelectorAll('button') || [])].map((element) => ({
            label: element.getAttribute('aria-label') || element.textContent.trim(), ...describe(element),
          })),
        },
        css: Object.fromEntries(['--window', '--chrome', '--surface', '--text'].map((key) => [key, rootStyle.getPropertyValue(key).trim()])),
        colors: {
          preview: colors('.preview-pane'), markdown: colors('.markdown-body'),
          workspace: colors('.document-workspace'), toolbar: colors('.native-toolbar'),
        },
        settingsDialog: {
          visible: isVisible(settingsDialog),
          selectedPane: settingsDialog?.querySelector('.settings-nav button.selected')?.textContent.trim() ?? null,
          appearancePaneVisible: isVisible(settingsDialog?.querySelector('.settings-pane .appearance-settings')),
        },
      };
    })()`)
  }
  const capture = async (phase) => {
    const snapshot = await readAppearanceState()
    appearance.snapshots[phase] = snapshot
    return snapshot
  }
  const assertOpen = (phase, snapshot) => {
    assert(`${phase}.popoverStaysOpen`, snapshot.open && snapshot.expanded === 'true' && snapshot.panel.visible)
  }
  const assertGeometry = (phase, snapshot) => {
    const geometry = snapshot.geometry
    assert(`${phase}.sevenPresets`, JSON.stringify(geometry.presets.map((preset) => preset.id)) === JSON.stringify(presetIds))
    assert(
      `${phase}.threeColumns`,
      geometry.columns.length === 3 &&
        geometry.gridTemplateColumns.split(/\s+/).length === 3 &&
        JSON.stringify(geometry.rowCounts) === '[3,3,1]',
    )
    assert(`${phase}.popoverWithinViewport`, snapshot.panel.visible && snapshot.panel.withinViewport)
    assert(
      `${phase}.presetsWithinViewport`,
      geometry.presets.length === 7 && geometry.presets.every((preset) => preset.visible && preset.withinViewport),
    )
    assert(
      `${phase}.controlsWithinViewport`,
      geometry.controls.length > 0 && geometry.controls.every((control) => control.visible && control.withinViewport),
    )
  }
  const openPopover = async (phase) => {
    await mouseClick(summarySelector, phase)
    assert(`${phase}.opened`, await waitFor(openCondition, `${phase}：外观浮层打开`))
  }
  const checkTheme = async (phase, preset, mode, resolved, windowColor, expectOpen = true) => {
    await waitFor(
      `${settingsExpression}.themePreset === ${JSON.stringify(preset)} &&
        ${settingsExpression}.theme === ${JSON.stringify(mode)} &&
        document.documentElement.dataset.theme === ${JSON.stringify(resolved)} &&
        getComputedStyle(document.documentElement).getPropertyValue('--window').trim().toLowerCase() === ${JSON.stringify(windowColor.toLowerCase())}`,
      `${phase}：主题存储与 CSS 生效`,
    )
    const snapshot = await capture(phase)
    assert(`${phase}.presetStored`, snapshot.settings.themePreset === preset)
    assert(`${phase}.modeStored`, snapshot.settings.theme === mode)
    assert(`${phase}.datasetTheme`, snapshot.datasetTheme === resolved)
    assert(`${phase}.windowColor`, snapshot.css['--window'].toLowerCase() === windowColor.toLowerCase())
    assert(`${phase}.zoomRetained`, snapshot.settings.zoom === 110)
    assert(
      `${phase}.selectedPreset`,
      snapshot.geometry.presets
        .filter((item) => item.pressed === 'true')
        .map((item) => item.id)
        .join(',') === preset,
    )
    assert(
      `${phase}.colorsRecorded`,
      Object.values(snapshot.colors).every((colors) => colors?.backgroundColor && colors.color),
    )
    if (expectOpen) assertOpen(phase, snapshot)
    return snapshot
  }
  const selectPreset = (preset, phase) => mouseClick(`${panelSelector} button[data-theme-preset="${preset}"]`, phase)
  try {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    await waitFor(`${settingsExpression}.zoom === 100 && document.documentElement.dataset.theme === 'light'`, '初始缩放 100 且模拟浅色生效')
    await openPopover('initialOpen')
    const initial = await capture('initial')
    assertOpen('initial', initial)
    assertGeometry('initial', initial)
    assert('initial.zoom100', initial.settings.zoom === 100)
    assert('initial.normalSystem', initial.settings.themePreset === 'normal' && initial.settings.theme === 'system')
    // 文案来自 src/lib/i18n.ts，避免命中旧的文本大小或顶部缩放控件。
    await mouseClick(
      `${panelSelector} .appearance-text-size button[aria-label="放大"], ${panelSelector} .appearance-text-size button[aria-label="Zoom In"]`,
      'zoomIn',
    )
    await waitFor(`${settingsExpression}.zoom === 110`, '放大后 settings.zoom 写入 110')
    const zoomed = await capture('zoomIn')
    assert('zoomIn.100To110', initial.settings.zoom === 100 && zoomed.settings.zoom === 110)
    assertOpen('zoomIn', zoomed)
    await selectPreset('dracula', 'selectDracula')
    await checkTheme('dracula', 'dracula', 'dark', 'dark', '#363846')
    await selectPreset('normal', 'selectNormal')
    await checkTheme('normal', 'normal', 'system', 'light', '#FFFFFF')
    for (const [mode, resolved, color] of [
      ['light', 'light', '#FFFFFF'],
      ['dark', 'dark', '#1E1E1E'],
      ['system', 'light', '#FFFFFF'],
    ]) {
      await mouseClick(`${panelSelector} .appearance-cycle`, `cycle.${mode}`)
      await checkTheme(`cycle.${mode}`, 'normal', mode, resolved, color)
    }
    for (const [index, scheme] of ['light', 'dark', 'light'].entries()) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
      const snapshot = await checkTheme(`media.${index}.${scheme}`, 'normal', 'system', scheme, scheme === 'dark' ? '#1E1E1E' : '#FFFFFF')
      assert(`media.${index}.matchMedia`, snapshot.prefersDark === (scheme === 'dark'))
      appearance.mediaEmulation.samples.push({ requested: scheme, ...snapshot })
    }
    const [light, dark, lightAgain] = appearance.mediaEmulation.samples
    assert(
      'media.windowRespondsAndRestores',
      Boolean(light.css['--window']) &&
        light.css['--window'] !== dark.css['--window'] &&
        light.css['--window'] === lightAgain.css['--window'],
    )
    await selectPreset('dracula', 'selectDraculaBeforeReload')
    const beforeReload = await checkTheme('beforeReload', 'dracula', 'dark', 'dark', '#363846')
    // 不改写存储；必须穿过真实 reload，避免读到旧文档而误报持久化成功。
    await send('Page.reload')
    await delay(200)
    assert(
      'reload.newDocument',
      await waitFor(
        `performance.timeOrigin !== ${beforeReload.timeOrigin} && isVisible(document.querySelector('.markdown-body h1'))`,
        'reload 后新文档预览就绪',
      ),
    )
    const reloaded = await checkTheme('reloaded', 'dracula', 'dark', 'dark', '#363846', false)
    assert('reload.timeOriginChanged', reloaded.timeOrigin !== beforeReload.timeOrigin)
    assert(
      'reload.colorsPersisted',
      JSON.stringify(reloaded.colors) === JSON.stringify(beforeReload.colors) && reloaded.css['--window'] === beforeReload.css['--window'],
    )
    await openPopover('afterReloadOpen')
    // 先将焦点移入浮层，确保 Escape 的焦点恢复不是原本就在 summary 上的假阳性。
    await selectPreset('dracula', 'focusPresetBeforeEscape')
    const beforeEscape = await capture('beforeEscape')
    assertOpen('beforeEscape', beforeEscape)
    assert('escape.focusStartedInsidePopover', beforeEscape.focus.inPopover)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    assert(
      'escape.closedAndSummaryFocused',
      await waitFor(
        `${closedCondition} && document.activeElement?.matches(${JSON.stringify(summarySelector)})`,
        'Escape 关闭并恢复 summary 焦点',
      ),
    )
    const escaped = await capture('escaped')
    assert('escape.closed', !escaped.open && !escaped.panel.visible && escaped.expanded === 'false')
    assert('escape.summaryFocused', escaped.summary.visible && escaped.focus.summary)
    await openPopover('afterEscapeOpen')
    const outsidePoint = await evaluate(`(() => {
      const preview = document.querySelector('.preview-pane');
      const isVisible = ${visibleExpression};
      if (!isVisible(preview)) return null;
      const rect = preview.getBoundingClientRect();
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      const bottom = Math.min(innerHeight, rect.bottom);
      for (const [x, y] of [[(left + right) / 2, bottom - 12], [left + 12, bottom - 12], [right - 12, bottom - 12]]) {
        const hit = document.elementFromPoint(x, y);
        if (preview.contains(hit) && !hit.closest('details.themes-and-settings, a, button, input, select, textarea, summary, [role="button"]')) return { x, y };
      }
      return null;
    })()`)
    appearance.actions.push({ phase: 'outsidePointerdown', point: outsidePoint })
    assert('outsidePointerdown.visibleHitOutside', outsidePoint !== null)
    if (outsidePoint) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...outsidePoint })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...outsidePoint, button: 'left', buttons: 1, clickCount: 1 })
      try {
        // mouseReleased/click 之前验收关闭，证明 pointerdown 路径生效。
        assert('outsidePointerdown.closedBeforeRelease', await waitFor(closedCondition, '外部 pointerdown 关闭浮层'))
        const outside = await capture('outsidePointerdown')
        assert('outsidePointerdown.closed', !outside.open && !outside.panel.visible && outside.expanded === 'false')
      } finally {
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...outsidePoint, button: 'left', buttons: 0, clickCount: 1 })
      }
    }
    await openPopover('afterOutsideOpen')
    await mouseClick(`${panelSelector} .appearance-customize`, 'customize')
    await waitFor(
      "isVisible(document.querySelector('.settings-dialog .settings-pane .appearance-settings'))",
      '自定义按钮打开设置 appearance pane',
    )
    const customized = await capture('customize')
    assert(
      'customize.appearancePane',
      customized.settingsDialog.visible &&
        customized.settingsDialog.appearancePaneVisible &&
        /^(外观|Appearance)$/.test(customized.settingsDialog.selectedPane ?? ''),
    )
    assert('customize.popoverClosed', !customized.open && !customized.panel.visible)
    await mouseClick('.settings-dialog > header button', 'closeSettings')
    assert(
      'customize.settingsClosed',
      await waitFor(
        "!isVisible(document.querySelector('.settings-dialog')) && isVisible(document.querySelector('.markdown-body h1'))",
        '关闭设置返回预览',
      ),
    )
    await openPopover('finalOpen')
    if (scenario === 'appearance') {
      await selectPreset('normal', 'finalSelectNormal')
      await checkTheme('finalNormal', 'normal', 'system', 'light', '#FFFFFF')
      await mouseClick(`${panelSelector} .appearance-cycle`, 'finalSelectLight')
    }
    const final = await checkTheme(
      'final',
      scenario === 'appearance' ? 'normal' : 'dracula',
      scenario === 'appearance' ? 'light' : 'dark',
      scenario === 'appearance' ? 'light' : 'dark',
      scenario === 'appearance' ? '#FFFFFF' : '#363846',
    )
    assertGeometry('final', final)
    assert('final.settingsClosed', !final.settingsDialog.visible)
    assert('scenarioCompleted', true)
  } catch (error) {
    appearance.error = error instanceof Error ? error.message : String(error)
    assert('scenarioCompleted', false)
    failures.push(`${scenario} 执行失败：${appearance.error}`)
  }
} else if (scenario === 'sidebar-tracking') {
  const slotSelector = '.native-toolbar .native-actions > [data-toolbar-item="sidebar"]'
  const toggleSelector = `${slotSelector} .sidebar-control > button`
  const modeSelector = `${slotSelector} .sidebar-mode-picker button:first-child`
  const dividerSelector = '.panel-resizer-sidebar'
  sidebarTracking = { assertions: {}, drags: [] }
  const assert = (name, passed) => {
    sidebarTracking.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`sidebar-tracking 断言失败：${name}`)
  }
  const inside = (inner, outer) =>
    Boolean(
      inner &&
      outer &&
      outer.width > 0 &&
      outer.height > 0 &&
      inner.left >= outer.left - 0.5 &&
      inner.right <= outer.right + 0.5 &&
      inner.top >= outer.top - 0.5 &&
      inner.bottom <= outer.bottom + 0.5,
    )
  const readTrackingState = async () => {
    // 等待 React、ResizeObserver 和 CSS 过渡落定；不以断言通过作为采样前提。
    await delay(250)
    const result = await send('Runtime.evaluate', {
      expression: `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const actions = document.querySelector('.native-toolbar .native-actions');
        const slots = [...(actions?.querySelectorAll(':scope > [data-toolbar-item]') || [])];
        const slot = document.querySelector(${JSON.stringify(slotSelector)});
        const divider = document.querySelector(${JSON.stringify(dividerSelector)});
        const toggle = document.querySelector(${JSON.stringify(toggleSelector)});
        const mode = document.querySelector(${JSON.stringify(modeSelector)});
        const flexibleSpace = slots.find((element) => element.dataset.toolbarItem === 'flexibleSpace');
        const title = actions?.querySelector('.toolbar-document-context');
        const search = actions?.querySelector(':scope > [data-toolbar-item="search"] .document-search');
        const input = search?.querySelector('input');
        const sidebar = document.querySelector('.native-sidebar');
        const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
        const rendered = (element) => Boolean(element && element.checkVisibility({ checkVisibilityCSS: true }) &&
          element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
        const slotRect = rect(slot);
        const dividerRect = rect(divider);
        const toggleRect = rect(toggle);
        const dividerCenter = dividerRect ? dividerRect.left + dividerRect.width / 2 : null;
        const actionsStyle = actions ? getComputedStyle(actions) : null;
        const availableWidth = actionsStyle ? actions.clientWidth - parseFloat(actionsStyle.paddingLeft) -
          parseFloat(actionsStyle.paddingRight) : 0;
        const otherItemsWidth = slots.filter((element) => element !== slot && element.dataset.toolbarItem !== 'flexibleSpace')
          .reduce((sum, element) => sum + element.getBoundingClientRect().width, 0);
        const trackingTargetWidth = dividerCenter === null || !actions ? null :
          dividerCenter - actions.getBoundingClientRect().left;
        const trackingRequiredWidth = trackingTargetWidth === null ? null :
          trackingTargetWidth + otherItemsWidth +
          (actions.querySelector(':scope > .more-menu')?.getBoundingClientRect().width ?? 0) +
          slots.length * (parseFloat(actionsStyle.columnGap) || 0);
        resolve({
          availableWidth, trackingTargetWidth, trackingRequiredWidth,
          viewport: { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.clientWidth },
          scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          rects: {
            slot: slotRect, divider: dividerRect, toggle: toggleRect, sidebar: rect(sidebar),
            flexibleSpace: rect(flexibleSpace), title: rect(title),
            titleName: rect(title?.querySelector('.toolbar-document-name')),
            search: rect(search), input: rect(input), mode: rect(mode),
          },
          tracking: slot?.getAttribute('data-sidebar-tracking') === 'true',
          trackingCount: actions?.querySelectorAll(':scope > [data-sidebar-tracking="true"]').length ?? 0,
          sidebarIsFirst: Boolean(slot && slots[0] === slot),
          sidebarVisible: rendered(sidebar),
          dividerVisible: rendered(divider),
          toggleVisible: rendered(toggle),
          togglePressed: toggle?.getAttribute('aria-pressed') ?? null,
          modePressed: mode?.getAttribute('aria-pressed') ?? null,
          sidebarWidth: divider ? Number(divider.getAttribute('aria-valuenow')) : null,
          sidebarMin: divider ? Number(divider.getAttribute('aria-valuemin')) : null,
          sidebarMax: divider ? Number(divider.getAttribute('aria-valuemax')) : null,
          storedSidebarWidth: localStorage.getItem('textmark.sidebarWidth'),
          slotInlineWidth: slot?.style.width ?? null,
          slotBorderRight: slot ? parseFloat(getComputedStyle(slot).borderRightWidth) : null,
          titleInFirstFlexibleSpace: Boolean(title && flexibleSpace?.contains(title)),
          titleVisible: rendered(title),
          searchRendered: rendered(search),
          inputOpacity: input ? getComputedStyle(input).opacity : null,
          dividerCenter,
          separatorError: slotRect && dividerCenter !== null ? Math.abs(slotRect.right - dividerCenter) : null,
          toggleBoundaryGap: toggleRect && dividerCenter !== null ? dividerCenter - toggleRect.right : null,
          slots: slots.map((element) => ({
            item: element.dataset.toolbarItem, rendered: rendered(element), rect: rect(element),
          })),
        });
      })))`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(`侧栏跟随状态采集失败：${result.exceptionDetails.text}`)
    return result.result.value
  }
  const capture = async (phase, expectedWidth, expectedTracking) => {
    const snapshot = await readTrackingState()
    sidebarTracking[phase] = snapshot
    assert(`${phase}.sidebarIsFirst`, snapshot.sidebarIsFirst)
    if (expectedTracking === null) {
      // 用关闭态实测紧凑宽度和当前行预算判断，不把实际 tracking 状态当作期望值。
      const compactWidth = sidebarTracking.closed?.rects.slot?.width
      const targetWidth = snapshot.trackingTargetWidth
      expectedTracking =
        snapshot.sidebarVisible &&
        snapshot.viewport.width > 700 &&
        compactWidth !== undefined &&
        targetWidth !== null &&
        targetWidth >= compactWidth + 10 &&
        snapshot.slots.filter((slot) => !['space', 'flexibleSpace'].includes(slot.item)).every((slot) => slot.rendered) &&
        snapshot.trackingRequiredWidth !== null &&
        snapshot.trackingRequiredWidth <= snapshot.availableWidth + 0.5
    }
    snapshot.expectedTracking = expectedTracking
    assert(`${phase}.trackingState`, snapshot.trackingCount === (snapshot.tracking ? 1 : 0) && snapshot.tracking === expectedTracking)
    if (expectedWidth === null) {
      assert(`${phase}.sidebarClosed`, !snapshot.sidebarVisible && snapshot.rects.sidebar === null && snapshot.rects.divider === null)
      assert(`${phase}.toggleOff`, snapshot.toggleVisible && snapshot.togglePressed === 'false')
    } else {
      assert(`${phase}.sidebarExpanded`, snapshot.sidebarVisible && snapshot.dividerVisible && snapshot.togglePressed === 'true')
      assert(
        `${phase}.sidebarWidth`,
        snapshot.sidebarWidth === expectedWidth && snapshot.rects.sidebar && Math.abs(snapshot.rects.sidebar.width - expectedWidth) <= 1,
      )
      assert(`${phase}.widthLimits`, snapshot.sidebarMin === 230 && snapshot.sidebarMax === 400)
      assert(`${phase}.widthPersisted`, Number(snapshot.storedSidebarWidth) === expectedWidth)
    }
    if (snapshot.tracking) {
      assert(`${phase}.separatorAligned`, snapshot.separatorError !== null && snapshot.separatorError <= 1)
      assert(
        `${phase}.toggleLeftWithin12px`,
        snapshot.toggleVisible &&
          snapshot.toggleBoundaryGap !== null &&
          snapshot.toggleBoundaryGap >= 0 &&
          snapshot.toggleBoundaryGap <= 12,
      )
    } else {
      assert(
        `${phase}.compactFallback`,
        snapshot.slotInlineWidth === '' &&
          snapshot.slotBorderRight === 0 &&
          snapshot.rects.slot &&
          sidebarTracking.closed?.rects.slot &&
          Math.abs(snapshot.rects.slot.width - sidebarTracking.closed.rects.slot.width) <= 1,
      )
    }
    assert(
      `${phase}.titleInsideFirstFlexibleSpace`,
      snapshot.titleInFirstFlexibleSpace &&
        snapshot.titleVisible &&
        inside(snapshot.rects.title, snapshot.rects.flexibleSpace) &&
        inside(snapshot.rects.titleName, snapshot.rects.flexibleSpace),
    )
    // 透明 input 也保留原始 rect，不能按可见性过滤而掩盖现有产品越界。
    assert(`${phase}.searchInputInsideSearchBox`, snapshot.searchRendered && inside(snapshot.rects.input, snapshot.rects.search))
    assert(`${phase}.noPageHorizontalOverflow`, snapshot.scrollWidth <= snapshot.viewport.pageWidth)
    assert(
      `${phase}.noToolbarHorizontalOverflow`,
      snapshot.slots.filter((slot) => slot.rendered).every((slot) => slot.rect.left >= 0 && slot.rect.right <= snapshot.viewport.pageWidth),
    )
    return snapshot
  }
  const mouseClick = async (selector, description) => {
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const isVisible = ${visibleExpression};
        if (!isVisible(element)) return null;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return element.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
      })()`,
      returnByValue: true,
    })
    const point = result.result.value
    if (!point) {
      failures.push(`sidebar-tracking：${description}，未找到可点击控件`)
      return
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 })
  }
  const dragSidebar = async (from, targetWidth) => {
    const divider = from.rects.divider
    if (!from.dividerVisible || !divider || from.sidebarWidth === null) {
      failures.push(`sidebar-tracking：无法拖动侧栏到 ${targetWidth}px，divider 不可用`)
      return
    }
    const start = { x: divider.left + divider.width / 2, y: divider.top + divider.height / 2 }
    const end = { x: start.x + targetWidth - from.sidebarWidth, y: start.y }
    const hit = await send('Runtime.evaluate', {
      expression: `Boolean(document.elementFromPoint(${start.x}, ${start.y})?.closest(${JSON.stringify(dividerSelector)}))`,
      returnByValue: true,
    })
    assert(`dragTo${targetWidth}.dividerHit`, hit.result.value)
    if (!hit.result.value) return
    sidebarTracking.drags.push({ fromWidth: from.sidebarWidth, targetWidth, start, end, steps: 8 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 })
    try {
      for (let step = 1; step <= 8; step += 1) {
        await send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: start.x + ((end.x - start.x) * step) / 8,
          y: start.y,
          button: 'left',
          buttons: 1,
        })
        await delay(16)
      }
    } finally {
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', buttons: 0, clickCount: 1 })
    }
    await waitFor(
      `document.querySelector(${JSON.stringify(dividerSelector)})?.getAttribute('aria-valuenow') === '${targetWidth}'`,
      `侧栏真实拖动到 ${targetWidth}px`,
    )
  }
  await waitFor(
    `isVisible(document.querySelector(${JSON.stringify(dividerSelector)})) &&
    isVisible(document.querySelector(${JSON.stringify(toggleSelector)}))`,
    '侧栏 divider 和顶部 toggle 可见',
  )
  const initial = await capture('initial', 240, true)
  assert('initial.viewportCanShrinkTo780', initial.viewport.width > 780)
  await dragSidebar(initial, 320)
  const at320 = await capture('at320', 320, true)
  await dragSidebar(at320, 400)
  const at400 = await capture('at400', 400, true)
  await mouseClick(toggleSelector, '点击顶部 toggle 关闭侧栏')
  await waitFor(
    `!document.querySelector(${JSON.stringify(dividerSelector)}) &&
    document.querySelector(${JSON.stringify(toggleSelector)})?.getAttribute('aria-pressed') === 'false'`,
    '顶部 toggle 已关闭侧栏',
  )
  const closed = await capture('closed', null, false)
  assert('closed.widthRetained', closed.storedSidebarWidth === '400')
  await mouseClick(modeSelector, '点击大纲模式按钮重新打开侧栏')
  await waitFor(
    `isVisible(document.querySelector(${JSON.stringify(dividerSelector)})) &&
    document.querySelector(${JSON.stringify(modeSelector)})?.getAttribute('aria-pressed') === 'true'`,
    '模式按钮已重新打开侧栏',
  )
  const reopened = await capture('reopened', 400, true)
  assert('reopened.modeSelected', reopened.modePressed === 'true')
  assert(
    'reopened.widthRestored',
    reopened.sidebarWidth === at400.sidebarWidth &&
      reopened.rects.sidebar &&
      at400.rects.sidebar &&
      Math.abs(reopened.rects.sidebar.width - at400.rects.sidebar.width) <= 1,
  )
  await send('Emulation.setDeviceMetricsOverride', { width: 780, height, deviceScaleFactor: 1, mobile: false })
  await waitFor('innerWidth === 780', '视口缩小到 780px')
  // 780px 若仍有空间则继续跟随，否则必须释放跟随宽度并回到紧凑布局。
  const narrow = await capture('narrow', 400, null)
  assert('narrow.viewportWidth', narrow.viewport.width === 780)
  await send('Emulation.setDeviceMetricsOverride', { width: initial.viewport.width, height, deviceScaleFactor: 1, mobile: false })
  await waitFor(`innerWidth === ${initial.viewport.width}`, '视口恢复初始宽度')
  const restored = await capture('restored', 400, true)
  assert('restored.viewportWidth', restored.viewport.width === initial.viewport.width)
  assert(
    'restored.slotRightUnchanged',
    restored.rects.slot && reopened.rects.slot && Math.abs(restored.rects.slot.right - reopened.rects.slot.right) <= 1,
  )
} else if (scenario === 'workspace-panels-drag') {
  workspacePanels = { assertions: {}, actions: [] }
  const assert = (name, passed) => {
    workspacePanels.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`workspace-panels-drag 断言失败：${name}`)
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const click = async (selector, label) => {
    const result = await evaluate(
      `(() => { const isVisible = ${visibleExpression}; const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(isVisible); if (!element) return false; element.click(); return true; })()`,
    )
    assert(`${label}.controlFound`, result)
    await delay(180)
  }
  const drag = async (selector, delta, label) => {
    const before = await evaluate(
      `(() => { const e = document.querySelector(${JSON.stringify(selector)}); return { value: Number(e?.getAttribute('aria-valuenow')), rect: e?.getBoundingClientRect().toJSON() }; })()`,
    )
    const startX = before.rect.left + before.rect.width / 2
    const pointerDelta = selector.includes('inspector') ? -delta : delta
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: 400, button: 'left', buttons: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX + pointerDelta, y: 400, button: 'left', buttons: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX + pointerDelta, y: 400, button: 'left', buttons: 0 })
    await delay(200)
    const after = await evaluate(`Number(document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-valuenow'))`)
    workspacePanels.actions.push({ selector, before: before.value, delta, after })
    if (label.includes('ClampsAtMax'))
      assert(label, after === Number(before.rect.width > 0 ? (selector.includes('sidebar') ? 400 : 500) : 0))
    else assert(label, after === before.value + delta)
  }
  await waitFor("document.querySelector('.markdown-body h1')", '示例文档已加载')
  await click('.native-toolbar [aria-label="显示简介"], .native-toolbar [aria-label="Get Info"]', 'openInspector')
  await waitFor("document.querySelector('.inspector-panel')", 'Inspector 挂载')
  await drag('.panel-resizer-sidebar', 50, 'sidebarDragAdds50')
  await drag('.panel-resizer-inspector', 60, 'inspectorDragAdds60')
  await drag('.panel-resizer-sidebar', 1000, 'sidebarDragClampsAtMax')
  await drag('.panel-resizer-inspector', 1000, 'inspectorDragClampsAtMax')
  const final = await evaluate(
    `(() => ({ sidebar: Number(document.querySelector('.panel-resizer-sidebar')?.getAttribute('aria-valuenow')), inspector: Number(document.querySelector('.panel-resizer-inspector')?.getAttribute('aria-valuenow')), sidebarStored: Number(localStorage.getItem('textmark.sidebarWidth')), inspectorStored: Number(localStorage.getItem('textmark.inspectorWidth')) }))()`,
  )
  workspacePanels.final = final
  assert('sidebarMaxClampAndStorage', final.sidebar === 400 && final.sidebarStored === 400)
  assert('inspectorMaxClampAndStorage', final.inspector === 500 && final.inspectorStored === 500)
  await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then(async ({ data }) =>
    writeFileSync(output, Buffer.from(data, 'base64')),
  )
} else if (scenario === 'workspace-panels-reload') {
  workspacePanels = { assertions: {}, actions: [] }
  const assert = (name, passed) => {
    workspacePanels.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`workspace-panels-reload 断言失败：${name}`)
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const click = async (selector, label) => {
    const result = await evaluate(
      `(() => { const isVisible = ${visibleExpression}; const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(isVisible); if (!element) return false; element.click(); return true; })()`,
    )
    assert(`${label}.controlFound`, result)
    await delay(180)
  }
  await waitFor("document.querySelector('.markdown-body h1')", '示例文档已加载')
  await evaluate(
    `(() => { localStorage.setItem('textmark.sidebarWidth', '310'); localStorage.setItem('textmark.inspectorWidth', '360'); location.reload(); })()`,
  )
  await waitFor("document.querySelector('.markdown-body h1')", '刷新后示例文档已加载')
  const initialWidths = await evaluate(
    `({ sidebar: Number(localStorage.getItem('textmark.sidebarWidth')), inspector: Number(localStorage.getItem('textmark.inspectorWidth')) })`,
  )
  assert('storedSidebarWidthLoaded', initialWidths.sidebar === 310)
  assert('storedInspectorWidthLoaded', initialWidths.inspector === 360)
  await click('.native-toolbar [aria-label="显示简介"], .native-toolbar [aria-label="Get Info"]', 'openInspector')
  await waitFor("document.querySelector('.inspector-panel')", 'Inspector 挂载')
  const restored = await evaluate(`(() => {
    const sidebar = document.querySelector('.native-sidebar')?.getBoundingClientRect();
    const workspace = document.querySelector('.document-workspace')?.getBoundingClientRect();
    const inspector = document.querySelector('.inspector-panel')?.getBoundingClientRect();
    return { sidebar: sidebar?.width, workspace: workspace?.width, inspector: inspector?.width, left: Number(document.querySelector('.panel-resizer-sidebar')?.getAttribute('aria-valuenow')), right: Number(document.querySelector('.panel-resizer-inspector')?.getAttribute('aria-valuenow')) };
  })()`)
  workspacePanels.restored = restored
  assert('sidebarWidthRestoredAfterReload', restored.sidebar === initialWidths.sidebar && restored.left === initialWidths.sidebar)
  assert('inspectorWidthRestoredAfterReload', restored.inspector === initialWidths.inspector && restored.right === initialWidths.inspector)
  assert('workspaceFillsRemainingWidth', restored.workspace === 1440 - restored.sidebar - restored.inspector - 12)
  await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then(async ({ data }) =>
    writeFileSync(output, Buffer.from(data, 'base64')),
  )
} else if (scenario === 'workspace-panels') {
  workspacePanels = { assertions: {}, actions: [] }
  const assert = (name, passed) => {
    workspacePanels.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`workspace-panels 断言失败：${name}`)
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const click = async (selector, label) => {
    const result = await evaluate(
      `(() => { const isVisible = ${visibleExpression}; const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(isVisible); if (!element) return false; element.click(); return true; })()`,
    )
    assert(`${label}.controlFound`, result)
    await delay(180)
  }
  const panelState = async () =>
    evaluate(`(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null;
    const splitter = (selector) => { const e = document.querySelector(selector); return e ? { min: Number(e.getAttribute('aria-valuemin')), max: Number(e.getAttribute('aria-valuemax')), now: Number(e.getAttribute('aria-valuenow')), rect: e.getBoundingClientRect().toJSON() } : null; };
    return { sidebar: rect('.native-sidebar'), workspace: rect('.document-workspace'), inspector: rect('.inspector-panel'), left: splitter('.panel-resizer-sidebar'), right: splitter('.panel-resizer-inspector'), title: document.title, scroll: document.querySelector('.preview-pane')?.scrollTop ?? document.querySelector('.cm-scroller')?.scrollTop ?? 0 };
  })()`)
  await waitFor("document.querySelector('.markdown-body h1')", '示例文档已加载')
  await click('.native-toolbar [aria-label="显示简介"], .native-toolbar [aria-label="Get Info"]', 'openInspector')
  await waitFor("document.querySelector('.inspector-panel')", 'Inspector 挂载')
  await waitFor("document.querySelector('.panel-resizer-sidebar') && document.querySelector('.panel-resizer-inspector')", '双侧分隔器挂载')
  let state = await panelState()
  workspacePanels.initial = state
  assert('threeColumnsPresent', Boolean(state.sidebar && state.workspace && state.inspector))
  assert('leftLimits', state.left?.min === 230 && state.left?.max === 400)
  assert('rightLimits', state.right?.min === 270 && state.right?.max === 500)
  const changeWidthByKeyboard = async (selector, key, shiftKey = false) => {
    const before = await evaluate(`Number(document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-valuenow'))`)
    await evaluate(
      `(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.focus(); element.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, shiftKey: ${shiftKey}, bubbles: true, cancelable: true })); return document.activeElement === element; })()`,
    )
    await delay(100)
    const after = await evaluate(`Number(document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-valuenow'))`)
    workspacePanels.actions.push({ selector, key, shiftKey, before, after })
    return { before, after }
  }
  const leftSmall = await changeWidthByKeyboard('.panel-resizer-sidebar', 'ArrowRight')
  assert('sidebarKeyboardArrowRightPlus1', leftSmall.after === leftSmall.before + 1)
  const leftLarge = await changeWidthByKeyboard('.panel-resizer-sidebar', 'ArrowRight', true)
  assert('sidebarKeyboardShiftArrowRightPlus10', leftLarge.after === leftLarge.before + 10)
  const rightLarge = await changeWidthByKeyboard('.panel-resizer-inspector', 'ArrowLeft', true)
  assert('inspectorKeyboardShiftArrowLeftPlus10', rightLarge.after === rightLarge.before + 10)
  const rightSmall = await changeWidthByKeyboard('.panel-resizer-inspector', 'ArrowRight')
  assert('inspectorKeyboardArrowRightMinus1', rightSmall.after === rightSmall.before - 1)
  for (let step = 0; step < 20; step += 1) {
    await evaluate(
      `(() => { const e = document.querySelector('.panel-resizer-sidebar'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true })); })()`,
    )
    await evaluate(
      `(() => { const e = document.querySelector('.panel-resizer-inspector'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true })); })()`,
    )
  }
  await delay(150)
  state = await panelState()
  assert('sidebarMinClamp', state.left?.now === state.left?.min)
  assert('inspectorMinClamp', state.right?.now === state.right?.min)
  assert(
    'widthStorageUpdated',
    Number(await evaluate("localStorage.getItem('textmark.sidebarWidth')")) === state.left?.now &&
      Number(await evaluate("localStorage.getItem('textmark.inspectorWidth')")) === state.right?.now,
  )
  workspacePanels.afterKeyboard = state
  await click('.inspector-segmented [role="tab"]', 'switchInspectorTab')
  workspacePanels.afterTabSwitch = await panelState()
  assert(
    'threeColumnsRemainAfterTabSwitch',
    Boolean(workspacePanels.afterTabSwitch.sidebar && workspacePanels.afterTabSwitch.workspace && workspacePanels.afterTabSwitch.inspector),
  )
  await click('.native-toolbar [aria-label="显示简介"], .native-toolbar [aria-label="Get Info"]', 'closeInspector')
  await waitFor("!document.querySelector('.inspector-panel')", 'Inspector 收起')
  workspacePanels.afterClose = await panelState()
  assert('inspectorClosedWithoutLosingSidebar', Boolean(workspacePanels.afterClose.sidebar && !workspacePanels.afterClose.inspector))
  await click('.native-toolbar [aria-label="显示简介"], .native-toolbar [aria-label="Get Info"]', 'reopenInspectorForCapture')
  await waitFor("document.querySelector('.inspector-panel')", '恢复三栏截图状态')
  workspacePanels.final = await panelState()
  assert(
    'threeColumnsRestoredForCapture',
    Boolean(workspacePanels.final.sidebar && workspacePanels.final.workspace && workspacePanels.final.inspector),
  )
} else if (scenario === 'search-replace') {
  searchReplace = { assertions: {} }
  const assert = (name, passed) => {
    searchReplace.assertions[name] = Boolean(passed)
    if (!passed) failures.push(`search-replace 断言失败：${name}`)
  }
  const click = async (selector, description) => {
    const result = await send('Runtime.evaluate', {
      expression: `(() => { const isVisible = ${visibleExpression}; const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(isVisible); element?.click(); return Boolean(element); })()`,
      returnByValue: true,
    })
    assert(`${description}.controlFound`, result.result.value)
  }
  await waitFor("document.querySelector('.markdown-body h1')", '示例文档渲染完成')
  await send('Runtime.evaluate', {
    expression: "document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', metaKey: true, bubbles: true, cancelable: true }))",
  })
  await waitFor("isVisible(document.querySelector('.editor-pane .cm-editor'))", '编辑器挂载')
  await waitFor('Boolean(window.__TEXTMARK_EDITOR_VIEW__)', 'CodeMirror view 可访问')
  await send('Runtime.evaluate', {
    expression: `(() => { const view = window.__TEXTMARK_EDITOR_VIEW__; view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'alpha alphabet\\nalpha beta alpha' } }); return view.state.doc.toString(); })()`,
    returnByValue: true,
  })
  await waitFor("document.querySelector('.cm-content')?.textContent.includes('alpha alphabet')", '写入搜索夹具')
  await send('Runtime.evaluate', {
    expression: "document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }))",
  })
  await waitFor("isVisible(document.querySelector('.find-bar'))", '打开查找条')
  const setInput = async (selector, value) =>
    send('Runtime.evaluate', {
      expression: `(() => { const input = document.querySelector(${JSON.stringify(selector)}); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(value)}); input._valueTracker?.setValue(''); input.dispatchEvent(new Event('input', { bubbles: true })); return Boolean(input); })()`,
      returnByValue: true,
    })
  await setInput('.find-bar input[aria-label]', 'alpha')
  await waitFor("document.querySelector('.find-count')?.textContent.includes('4')", 'Contains 命中数为4')
  const containsCount = await send('Runtime.evaluate', {
    expression: "document.querySelector('.find-count')?.textContent.trim()",
    returnByValue: true,
  })
  assert('contains.count4', /4/.test(containsCount.result.value ?? ''))
  await click('.find-mode[aria-pressed="false"]', 'switchBeginsWith')
  await waitFor(
    "document.querySelector('.find-mode.selected')?.textContent.includes('开头为') || document.querySelector('.find-mode.selected')?.textContent.includes('Begins With')",
    '切换 Begins With',
  )
  await waitFor("document.querySelector('.find-count')?.textContent.includes('4')", 'Begins With 命中数为4')
  const modeCount = await send('Runtime.evaluate', {
    expression: "document.querySelector('.find-count')?.textContent.trim()",
    returnByValue: true,
  })
  assert('beginsWith.count4', /4/.test(modeCount.result.value ?? ''))
  await click('.find-bar .find-icon[title="下一个匹配项"], .find-bar .find-icon[title="Next Match"]', 'navigateNext')
  await setInput('.find-bar input[aria-label="替换为"], .find-bar input[aria-label="Replacement"]', 'omega')
  await click('.find-bar .find-action:not(:disabled)', 'replaceOne')
  await waitFor("(document.querySelector('.cm-content')?.textContent.match(/omega/g) ?? []).length === 1", '单次替换编辑器更新')
  const single = await send('Runtime.evaluate', { expression: "document.querySelector('.cm-content')?.textContent", returnByValue: true })
  assert(
    'replaceOne.onlyOne',
    (single.result.value.match(/omega/g) ?? []).length === 1 && (single.result.value.match(/alpha/g) ?? []).length === 3,
  )
  await click('.find-bar .find-action:not(:disabled) ~ .find-action:not(:disabled)', 'replaceAll')
  await waitFor("(document.querySelector('.cm-content')?.textContent.match(/omega/g) ?? []).length === 4", '全部替换编辑器更新')
  const all = await send('Runtime.evaluate', { expression: "document.querySelector('.cm-content')?.textContent", returnByValue: true })
  assert('replaceAll.fourReplaced', (all.result.value.match(/omega/g) ?? []).length === 4 && !all.result.value.includes('alpha'))
} else if (scenario === 'tabs-find' || scenario === 'print-tabs-find') {
  const click = async (selector, description) => {
    const result = await send('Runtime.evaluate', {
      expression: `(() => {
        const isVisible = ${visibleExpression};
        const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((element) => !element.closest('.menu-popover') && isVisible(element));
        button?.click();
        return Boolean(button);
      })()`,
      returnByValue: true,
    })
    if (!result.result.value) failures.push(`场景 tabs-find：${description}`)
  }
  await send('Runtime.evaluate', {
    expression: `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true }))`,
    returnByValue: true,
  })
  await waitFor("[...document.querySelectorAll('.document-tab')].filter(isVisible).length >= 2", '新建第二文档，两个标签可见')
  const activated = await send('Runtime.evaluate', {
    expression: `(() => {
      const tab = [...document.querySelectorAll('.document-tab .tab-label')]
        .find((element) => /^README(?:\\.md)?$/i.test(element.textContent.trim()));
      tab?.click();
      return Boolean(tab);
    })()`,
    returnByValue: true,
  })
  if (!activated.result.value) failures.push('场景 tabs-find：未找到原 README 标签')
  await waitFor(
    "/^README(?:\\.md)?$/i.test(document.querySelector('.document-tab[aria-selected=\"true\"] .tab-label')?.textContent.trim() ?? '')",
    '原 README 标签激活',
  )
  await waitFor(
    "isVisible(document.querySelector('.cm-editor')) || isVisible(document.querySelector('.markdown-body h1'))",
    '标签内容挂载完成',
  )
  const inEditor = await send('Runtime.evaluate', { expression: "Boolean(document.querySelector('.cm-editor'))", returnByValue: true })
  if (!inEditor.result.value) await click('.native-toolbar [aria-label="编辑"], .native-toolbar [aria-label="Edit"]', '未找到编辑按钮')
  await waitFor("isVisible(document.querySelector('.editor-pane .cm-editor'))", 'README 编辑器可见')
  await waitFor(
    `isVisible(document.querySelector('.document-tools .formatting-toolbar')) && ${toolsMeasuredCondition}`,
    '格式条高度已写入 CSS 变量',
  )
  await delay(250)
  const scroll = await send('Runtime.evaluate', {
    expression: `(() => {
      const scroller = document.querySelector('.editor-pane .cm-scroller');
      if (!scroller) return null;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const target = Math.min(200, maxScroll);
      scroller.scrollTop = target;
      return { maxScroll, target };
    })()`,
    returnByValue: true,
  })
  await delay(250)
  if (!scroll.result.value || scroll.result.value.target <= 0)
    failures.push('tabs-find 必须在可滚动的非零位置验证，不能以 scrollTop=0 假通过')
  tabsFind = { scrollSetup: scroll.result.value, before: await readToolsState() }
  await click('.native-toolbar .search-trigger', '未找到查找入口')
  await waitFor(`isVisible(document.querySelector('.document-tools .find-bar')) && ${toolsMeasuredCondition}`, '查找条可见且工具高度已更新')
  await delay(250)
  tabsFind.after = await readToolsState()
  await click('.document-tools .find-bar .find-done', '未找到关闭查找按钮')
  await waitFor(`!document.querySelector('.document-tools .find-bar') && ${toolsMeasuredCondition}`, '查找关闭且工具高度恢复')
  await delay(250)
  tabsFind.closed = await readToolsState()
  await click('.native-toolbar .search-trigger', '未找到再次打开查找的入口')
  await waitFor(
    `isVisible(document.querySelector('.document-tools .find-bar')) && ${toolsMeasuredCondition}`,
    '查找再次打开且工具高度已更新',
  )
  await delay(250)
  tabsFind.reopened = await readToolsState()
} else if (scenario === 'tabs') {
  await send('Runtime.evaluate', {
    expression: `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true }))`,
    returnByValue: true,
  })
} else if (scenario === 'find' || scenario === 'inspector' || scenario === 'print-find' || scenario === 'print-inspector') {
  const selector =
    scenario === 'find' || scenario === 'print-find'
      ? '.native-toolbar .search-trigger'
      : '.native-toolbar [data-toolbar-item="inspector"] [aria-label="显示简介"], .native-toolbar [data-toolbar-item="inspector"] [aria-label="Get Info"]'
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const isVisible = ${visibleExpression};
      const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((element) => !element.closest('.menu-popover') && isVisible(element));
      button?.click();
      return Boolean(button);
    })()`,
    returnByValue: true,
  })
  if (!result.result.value) failures.push(`场景 ${scenario}：未找到可见入口按钮`)
} else if (scenario === 'print-toast' || scenario === 'print-toast-prepared') {
  await send('Runtime.evaluate', {
    expression: `(() => {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.textContent = 'PRINT TOAST TEST';
      document.querySelector('#root')?.append(toast);
      return Boolean(document.querySelector('.toast'));
    })()`,
    returnByValue: true,
  })
} else if (scenario === 'dark') {
  // The app derives its CSS variables from persisted settings; changing only
  // data-theme leaves the already-applied light palette in place. Persist a
  // dark appearance and reload so this scenario exercises the real path.
  await send('Runtime.evaluate', {
    expression: `(() => {
    const key = 'textmark.settings.v7';
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...stored, theme: 'dark', themePreset: 'darkGraphite' }));
    location.reload();
    return true;
  })()`,
    returnByValue: true,
  })
}
const expectedSelector =
  {
    edit: '.editor-pane .cm-editor',
    customizer: '.toolbar-customizer',
    tabs: '.cm-editor',
    'tabs-find': '.document-tools .find-bar',
    'print-tabs-find': '.document-tools .find-bar',
    'search-replace': '.document-tools .find-bar',
    'print-find': '.document-tools .find-bar',
    'print-inspector': '.inspector-panel',
    find: '.find-bar',
    inspector: '.inspector-panel',
    appearance: 'details.themes-and-settings[open] > div.appearance-popover',
    'appearance-dark': 'details.themes-and-settings[open] > div.appearance-popover',
  }[scenario] ?? '.markdown-body h1'
let expectedCondition = `isVisible(document.querySelector(${JSON.stringify(expectedSelector)}))`
if (scenario === 'tabs') expectedCondition += " && [...document.querySelectorAll('.document-tab')].filter(isVisible).length >= 2"
if (scenario === 'tabs-find' || scenario === 'print-tabs-find')
  expectedCondition += ` && isVisible(document.querySelector('.cm-editor')) && [...document.querySelectorAll('.document-tab')].filter(isVisible).length >= 2 && ${toolsMeasuredCondition}`
if (scenario === 'dark') expectedCondition += " && document.documentElement.dataset.theme === 'dark'"
if (appearance) {
  const dark = scenario === 'appearance-dark'
  expectedCondition += ` && document.documentElement.dataset.theme === '${dark ? 'dark' : 'light'}' &&
    JSON.parse(localStorage.getItem('textmark.settings.v7') || '{}').themePreset === '${dark ? 'dracula' : 'normal'}' &&
    JSON.parse(localStorage.getItem('textmark.settings.v7') || '{}').theme === '${dark ? 'dark' : 'light'}' &&
    isVisible(document.querySelector('.markdown-body h1')) && !isVisible(document.querySelector('.settings-dialog'))`
}
const scenarioReady = await waitFor(expectedCondition, `场景 ${scenario}，条件：${expectedCondition}`)
await delay(250)
const geometry = await send('Runtime.evaluate', {
  expression: `(() => {
    const selectors = [
      '.native-toolbar',
      '.window-leading',
      '.toolbar-leading-actions',
      '.toolbar-document-context',
      '.native-actions',
      '.more-menu',
      '.document-tabs',
      '.document-shell',
      '.document-workspace',
      '.formatting-toolbar',
      '.editor-pane',
      '.cm-content',
      '.cm-editor',
      '.sidebar-mode-picker',
      '.search-trigger',
      '.find-bar',
      '.inspector-panel',
    ];
    const isVisible = ${visibleExpression};
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: Math.round(box.x * 10) / 10,
        y: Math.round(box.y * 10) / 10,
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
        display: style.display,
        gap: style.gap,
        padding: style.padding,
        justifyContent: style.justifyContent,
      };
    };
    const toolbarButtons = [...document.querySelectorAll('.native-toolbar button, .native-toolbar summary')]
      .filter((element) => !element.closest('.menu-popover, .appearance-popover') && isVisible(element));
    const center = (element) => {
      const box = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim() || '',
        x: Math.round((box.left + box.width / 2) * 10) / 10,
        y: Math.round((box.top + box.height / 2) * 10) / 10,
        width: Math.round(box.width * 10) / 10,
      };
    };
    const buttonCenters = toolbarButtons.map(center);
    const visibleSlots = [...document.querySelectorAll('.native-toolbar .native-actions > [data-toolbar-item]')]
      .filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 0)
      .map((element, index) => ({ index, item: element.dataset.toolbarItem, ...rect(element) }));
    const searchVisible = toolbarButtons.some((element) => {
      if (!element.matches('.search-trigger')) return false;
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= document.documentElement.clientWidth && box.top >= 0 && box.bottom <= innerHeight;
    });
    const sidebarModePicker = toolbarButtons.filter((element) => element.matches('.sidebar-mode-picker button')).map(center);
    const sidebarVisible = [...document.querySelectorAll('.native-toolbar .sidebar-mode-picker')]
      .some((element) => !element.closest('.menu-popover') && isVisible(element));
    const sidebarModePickerAligned = sidebarVisible
      ? sidebarModePicker.length === 2 && Math.abs(sidebarModePicker[0].y - sidebarModePicker[1].y) <= 0.5
      : null;
    const pageWidth = document.documentElement.clientWidth;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    // 只比较并列区域，避免把容器与其内部 slot 的正常包含关系当成重叠。
    const majorSlots = [...document.querySelectorAll(
      '.native-toolbar > .window-leading, .native-toolbar > .toolbar-leading-actions, .native-toolbar .native-actions > [data-toolbar-item], .native-toolbar .native-actions > .more-menu'
    )].filter(isVisible);
    const overlaps = [];
    for (let left = 0; left < majorSlots.length; left += 1) {
      for (let right = left + 1; right < majorSlots.length; right += 1) {
        const a = majorSlots[left].getBoundingClientRect();
        const b = majorSlots[right].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) {
          overlaps.push({
            first: majorSlots[left].dataset.toolbarItem || majorSlots[left].className,
            second: majorSlots[right].dataset.toolbarItem || majorSlots[right].className,
          });
        }
      }
    }
    return {
      elements: Object.fromEntries(selectors.map((selector) => [selector, rect(document.querySelector(selector))])),
      buttonCenters,
      visibleSlots,
      visibleSlotOrder: visibleSlots.map((slot) => slot.item),
      searchVisible,
      sidebarModePicker,
      documentTabCount: document.querySelectorAll('.document-tab').length,
      visibleDocumentTabCount: [...document.querySelectorAll('.document-tab')].filter(isVisible).length,
      editorVisible: isVisible(document.querySelector('.cm-editor')),
      pageWidth,
      scrollWidth,
      overlaps,
      assertions: {
        searchVisibleAtDesktopWidth: innerWidth < 980 || searchVisible,
        sidebarModePickerAligned,
        noPageHorizontalOverflow: scrollWidth <= pageWidth,
        majorSlotsDoNotOverlap: overlaps.length === 0,
      },
    };
  })()`,
  returnByValue: true,
})
const state = await send('Runtime.evaluate', {
  expression:
    "({title:document.title,html:document.querySelector('.markdown-body')?.innerHTML ?? '',language:document.documentElement.lang,renderer:document.documentElement.dataset.renderer ?? 'unset',theme:document.documentElement.dataset.theme ?? 'unset'})",
  returnByValue: true,
})
if (state.result.value.renderer !== 'worker') failures.push(`Expected worker renderer, received ${state.result.value.renderer}`)
for (const [assertion, passed] of Object.entries(geometry.result.value.assertions)) {
  if (passed === false) failures.push(`几何断言失败：${assertion}`)
}
if (toolbarFixtures[scenario]) {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const actions = document.querySelector('.native-actions');
      return {
        items: [...actions.querySelectorAll(':scope > [data-toolbar-item]')].map(e => e.dataset.toolbarItem),
        tracking: Boolean(actions.querySelector(':scope > [data-sidebar-tracking]')),
        sidebar: Boolean(actions.querySelector('.sidebar-control')),
        labels: actions.querySelectorAll('.toolbar-label').length,
      };
    })()`,
    returnByValue: true,
  })
  const actual = result.result.value
  const expected = toolbarFixtures[scenario].toolbar.filter((item) => item !== 'navigation')
  if (JSON.stringify(actual.items) !== JSON.stringify(expected)) failures.push('自定义项顺序或重复间隔丢失')
  if (!['sidebar-labels', 'print-toast', 'print-toast-prepared'].includes(scenario) && actual.tracking)
    failures.push('自定义移动或删除后仍强制侧栏跟随')
  if (scenario === 'sidebar-deleted' && actual.sidebar) failures.push('已删除侧栏控件被擅自补回')
  if (scenario === 'sidebar-labels' && actual.labels === 0) failures.push('图标和文字配置未生效')
}
const tools = await readToolsState()
if (tabsFind) {
  tabsFind.final = tools
  const assertions = {}
  const sameRect = (first, second) =>
    Boolean(first && second && ['x', 'y', 'width', 'height'].every((key) => Math.abs(first[key] - second[key]) <= 0.5))
  const inside = (inner, outer) =>
    Boolean(
      inner &&
      outer &&
      inner.width > 0 &&
      inner.height > 0 &&
      inner.left >= outer.left - 0.5 &&
      inner.right <= outer.right + 0.5 &&
      inner.top >= outer.top - 0.5 &&
      inner.bottom <= outer.bottom + 0.5,
    )
  const compare = (label, first, second, includeTools = false) => {
    for (const key of ['tabs', 'sidebar', 'workspace', 'editor', 'scroller'])
      assertions[`${label}.${key}RectUnchanged`] = sameRect(first.rects[key], second.rects[key])
    assertions[`${label}.scrollTopUnchanged`] =
      first.scrollTop !== null && second.scrollTop !== null && Math.abs(first.scrollTop - second.scrollTop) <= 1
    if (includeTools) {
      for (const key of ['tools', 'formatting']) assertions[`${label}.${key}RectUnchanged`] = sameRect(first.rects[key], second.rects[key])
      if (first.rects.find || second.rects.find) assertions[`${label}.findRectUnchanged`] = sameRect(first.rects.find, second.rects.find)
      assertions[`${label}.heightUnchanged`] = Math.abs(first.cssHeightPx - second.cssHeightPx) <= 0.5
      assertions[`${label}.paddingUnchanged`] = first.padding.content === second.padding.content
    }
  }
  assertions.initialScrollApplied = Boolean(
    tabsFind.scrollSetup && tabsFind.before.scrollTop !== null && Math.abs(tabsFind.before.scrollTop - tabsFind.scrollSetup.target) <= 1,
  )
  compare('open', tabsFind.before, tabsFind.after)
  compare('close', tabsFind.after, tabsFind.closed)
  compare('roundTrip', tabsFind.before, tabsFind.closed, true)
  compare('reopen', tabsFind.closed, tabsFind.reopened)
  compare('reopenedMatchesFirstOpen', tabsFind.after, tabsFind.reopened, true)
  compare('finalStable', tabsFind.reopened, tabsFind.final, true)
  compare('finalMatchesBaseline', tabsFind.before, tabsFind.final)
  for (const [phase, snapshot] of Object.entries({
    before: tabsFind.before,
    after: tabsFind.after,
    closed: tabsFind.closed,
    reopened: tabsFind.reopened,
    final: tabsFind.final,
  })) {
    const open = ['after', 'reopened', 'final'].includes(phase)
    assertions[`${phase}.readmeActive`] = /^README(?:\.md)?$/i.test(snapshot.activeTab ?? '') && snapshot.visibleTabCount >= 2
    assertions[`${phase}.absoluteOverlay`] = snapshot.position === 'absolute'
    assertions[`${phase}.heightMeasured`] = snapshot.cssHeightPx > 0 && Math.abs(snapshot.cssHeightPx - snapshot.height) <= 0.5
    assertions[`${phase}.formattingInsideWorkspace`] = inside(snapshot.rects.formatting, snapshot.rects.workspace)
    assertions[`${phase}.toolsInsideWorkspace`] = inside(snapshot.rects.tools, snapshot.rects.workspace)
    assertions[`${phase}.controlsInsideWorkspace`] = snapshot.controls.length > 0 && snapshot.overflowingControls.length === 0
    assertions[`${phase}.realScrollContainer`] = Boolean(
      snapshot.scrollContainer?.className.split(/\s+/).includes('cm-scroller') &&
      sameRect(snapshot.scrollContainer.rect, snapshot.rects.scroller) &&
      Math.abs(snapshot.scrollContainer.scrollTop - snapshot.scrollTop) <= 1,
    )
    assertions[`${phase}.contentInsetTracksTools`] =
      snapshot.padding.contentTop !== null &&
      tabsFind.before.padding.contentTop !== null &&
      Math.abs(snapshot.padding.contentTop - tabsFind.before.padding.contentTop - (snapshot.cssHeightPx - tabsFind.before.cssHeightPx)) <=
        0.5
    if (open) {
      assertions[`${phase}.findInsideWorkspace`] = inside(snapshot.rects.find, snapshot.rects.workspace)
      assertions[`${phase}.formattingBelowFind`] = Boolean(
        snapshot.rects.find && snapshot.rects.formatting && snapshot.rects.formatting.top >= snapshot.rects.find.bottom - 0.5,
      )
      assertions[`${phase}.findFocused`] = snapshot.focus.inFind
    } else assertions[`${phase}.findClosed`] = snapshot.rects.find === null
  }
  tabsFind.assertions = assertions
  for (const [assertion, passed] of Object.entries(assertions)) if (!passed) failures.push(`tabs-find 断言失败：${assertion}`)
}
let printMedia
if (scenario.startsWith('print-') || scenario === 'print') {
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ['.native-toolbar', '.native-sidebar', '.document-tabs', '.inspector-panel', '.formatting-toolbar', '.find-bar', '.document-tools', '.toast'];
      const display = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).display : null;
      };
      const preview = document.querySelector('.markdown-body');
      const editor = document.querySelector('.cm-content');
      const content = preview || editor;
      const rect = content?.getBoundingClientRect();
      return {
        mediaMatches: matchMedia('print').matches,
        hiddenUi: Object.fromEntries(selectors.map((selector) => [selector, display(selector)])),
        root: { display: getComputedStyle(document.querySelector('#root')).display, height: getComputedStyle(document.querySelector('#root')).height, overflow: getComputedStyle(document.querySelector('#root')).overflow },
        content: content ? { source: preview ? 'preview' : 'editor', textLength: (preview ? preview.innerText : editor.innerText).trim().length, width: rect.width, height: rect.height, scrollHeight: content.scrollHeight, color: getComputedStyle(content).color, background: getComputedStyle(content).backgroundColor } : null,
        title: document.title,
      };
    })()`,
    returnByValue: true,
  })
  printMedia = result.result.value
  for (const [selector, display] of Object.entries(printMedia.hiddenUi)) {
    if (display !== null && display !== 'none') failures.push(`print media 未隐藏 ${selector}（display=${display}）`)
  }
  if (!printMedia.mediaMatches) failures.push('print media 未生效')
  if (!printMedia.content || printMedia.content.textLength === 0 || printMedia.content.width <= 0 || printMedia.content.height <= 0)
    failures.push('print media 下文档内容为空或没有布局尺寸')
}
const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
mkdirSync(dirname(output), { recursive: true })
if (scenario.startsWith('print')) {
  const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false })
  const pdfOutput = output.replace(/\.png$/i, '.pdf')
  const pdfBytes = Buffer.from(pdf.data, 'base64')
  writeFileSync(pdfOutput, pdfBytes)
  printMedia.pdfOutput = pdfOutput
  printMedia.pdfBytes = pdfBytes.length
  printMedia.pdfPageCount = (pdfBytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
  if (printMedia.pdfPageCount < 1) failures.push('打印 PDF 未生成任何页面')
}

writeFileSync(output, Buffer.from(screenshot.data, 'base64'))

socket.close()
processHandle.kill('SIGTERM')
await Promise.race([new Promise((resolve) => processHandle.once('exit', resolve)), delay(2_000)])
rmSync(profile, { recursive: true, force: true })

const report = JSON.stringify(
  {
    output,
    scenario,
    ready,
    scenarioReady,
    title: state.result.value.title,
    language: state.result.value.language,
    renderer: state.result.value.renderer,
    theme: state.result.value.theme,
    htmlBytes: state.result.value.html.length,
    geometry: geometry.result.value,
    tools,
    ...(tabsFind ? { tabsFind } : {}),
    ...(searchReplace ? { searchReplace } : {}),
    ...(workspacePanels ? { workspacePanels } : {}),
    ...(sidebarTracking ? { sidebarTracking } : {}),
    ...(appearance ? { appearance } : {}),
    ...(printMedia ? { printMedia } : {}),
    failures,
  },
  null,
  2,
)
const jsonOutput = /\.png$/i.test(output) ? output.replace(/\.png$/i, '.json') : `${output}.json`
writeFileSync(jsonOutput, `${report}\n`)
console.log(report)
if (failures.length) process.exitCode = 1
