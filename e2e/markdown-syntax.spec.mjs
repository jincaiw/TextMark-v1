/**
 * Runs only when TEXTMARK_SYNTAX_FIXTURE points at a user-supplied Markdown
 * corpus. The fixture is opened read-only: this suite never clicks controls
 * that alter source content.
 */
const describeSyntax = process.env.TEXTMARK_SYNTAX_FIXTURE ? describe : describe.skip

before(async () => {
  await browser.tauri.switchWindow('main')
})

describeSyntax('Markdown syntax corpus rendering', () => {
  it('renders supported CommonMark and GFM features, while filtering dangerous HTML', async () => {
    await browser.setWindowSize(1280, 900)
    await (await $('.markdown-body h1')).waitForDisplayed()
    await expect(await $('.markdown-body h1')).toHaveText('Markdown 渲染综合测试')
    await browser.waitUntil(async () => (await $$('.mermaid[data-mermaid-rendered="true"]')).length >= 3)

    const state = await browser.execute(() => {
      const body = document.querySelector('.markdown-body')
      const syntaxTable = [...body.querySelectorAll('table')].find((table) => table.textContent.includes('左对齐'))
      const superscriptExample = [...body.querySelectorAll('li')].find((item) => item.textContent.includes('上标：'))
      const subscriptExample = [...body.querySelectorAll('li')].find((item) => item.textContent.includes('下标：'))
      const insertionExample = [...body.querySelectorAll('li')].find((item) => item.textContent.includes('插入（扩展语法）：'))
      const alignment = syntaxTable
        ? [...syntaxTable.querySelectorAll('th')]
            .map((cell) => [...cell.classList].find((className) => className.startsWith('md-table-align-')) ?? null)
            .slice(0, 3)
        : []
      return {
        frontmatter: Boolean(body.querySelector('.md-frontmatter')),
        tables: body.querySelectorAll('table').length,
        tasks: body.querySelectorAll('input.task-list-item-checkbox').length,
        footnotes: Boolean(body.querySelector('.footnotes')),
        inlineSemantics: {
          superscript: superscriptExample?.querySelectorAll('sup').length ?? 0,
          subscript: subscriptExample?.querySelectorAll('sub').length ?? 0,
          insertion: insertionExample?.querySelector('ins')?.textContent ?? null,
        },
        math: body.querySelectorAll('.katex').length,
        alerts: body.querySelectorAll('.markdown-alert').length,
        mermaid: body.querySelectorAll('.mermaid[data-mermaid-rendered="true"]').length,
        scripts: body.querySelectorAll('script').length,
        iframes: body.querySelectorAll('iframe').length,
        unsafeHandlers: body.querySelectorAll('[onerror],[onclick],[onload]').length,
        alignment,
      }
    })

    expect(state).toMatchObject({
      frontmatter: true,
      footnotes: true,
      scripts: 0,
      iframes: 0,
      unsafeHandlers: 0,
    })
    expect(state.tables).toBeGreaterThanOrEqual(2)
    expect(state.tasks).toBeGreaterThanOrEqual(5)
    expect(state.math).toBeGreaterThanOrEqual(4)
    expect(state.alerts).toBeGreaterThanOrEqual(5)
    expect(state.mermaid).toBe(3)
    expect(state.inlineSemantics).toEqual({ superscript: 2, subscript: 2, insertion: '新增文本' })
    expect(state.alignment).toEqual(['md-table-align-left', 'md-table-align-center', 'md-table-align-right'])
  })

  it('keeps math, Mermaid, and footnotes readable in WYSIWYG edit mode', async () => {
    await $('button[aria-label="编辑"]').click()
    await (await $('.cm-content')).waitForDisplayed()

    const frontmatterCard = await browser.execute(() => {
      const start = document.querySelector('.cm-md-frontmatter-start')
      const end = document.querySelector('.cm-md-frontmatter-end')
      const value = document.querySelector('.cm-md-frontmatter-value')
      return {
        found: Boolean(start && end && value),
        startRadius: start ? getComputedStyle(start).borderTopLeftRadius : null,
        endRadius: end ? getComputedStyle(end).borderBottomLeftRadius : null,
        sharedBackground: start && value ? getComputedStyle(start).backgroundColor === getComputedStyle(value).backgroundColor : false,
      }
    })
    expect(frontmatterCard).toEqual({ found: true, startRadius: '12px', endRadius: '12px', sharedBackground: true })

    const tocState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const tocOffset = source.search(/^\[TOC\]\s*$/m)
      if (!view || tocOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: 0 } })
      const preview = view.dom.querySelector('.cm-md-toc-preview')
      const previewLinks = preview?.querySelectorAll('a[href^="#"]').length ?? 0
      view.dispatch({ selection: { anchor: tocOffset + 2 } })
      const sourceRestoredAtCaret = !view.dom.querySelector('.cm-md-toc-preview') && view.dom.textContent.includes('[TOC]')
      view.dispatch({ selection: { anchor: 0 } })
      return { found: true, previewLinks, sourceRestoredAtCaret }
    })
    expect(tocState.found).toBe(true)
    expect(tocState.previewLinks).toBeGreaterThan(0)
    expect(tocState.sourceRestoredAtCaret).toBe(true)

    const setextState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const underlineOffset = source.indexOf('标题式二级标题\n==============')
      if (!view || underlineOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: 0 } })
      const headingOne = [...view.dom.querySelectorAll('.cm-line.cm-md-h1')].some((line) => line.textContent?.includes('标题式二级标题'))
      const headingTwo = [...view.dom.querySelectorAll('.cm-line.cm-md-h2')].some((line) => line.textContent?.includes('标题式三级标题'))
      const marker = [...view.dom.querySelectorAll('.cm-line.cm-md-setext-marker')].find((line) =>
        line.textContent?.includes('=============='),
      )
      const collapsedHeight = marker?.getBoundingClientRect().height ?? -1
      view.dispatch({ selection: { anchor: underlineOffset + '标题式二级标题\n'.length + 3 } })
      const sourceRestoredAtCaret = [...view.dom.querySelectorAll('.cm-line.cm-md-setext-marker')].some(
        (line) => line.classList.contains('cm-md-source-revealed') && line.textContent?.includes('=============='),
      )
      view.dispatch({ selection: { anchor: 0 } })
      return { found: true, headingOne, headingTwo, collapsedHeight, sourceRestoredAtCaret }
    })
    expect(setextState).toEqual({
      found: true,
      headingOne: true,
      headingTwo: true,
      collapsedHeight: 0,
      sourceRestoredAtCaret: true,
    })

    const headingAlignment = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const heading = source.indexOf('# 一级标题')
      const paragraph = source.indexOf('普通段落可以包含')
      if (!view || heading < 0 || paragraph < 0) return { found: false }
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(heading).top - view.scrollDOM.clientHeight / 2)
      const headingTextX = view.coordsAtPos(heading + '# '.length)?.left ?? null
      const paragraphTextX = view.coordsAtPos(paragraph)?.left ?? null
      return { found: true, headingTextX, paragraphTextX }
    })
    expect(headingAlignment.found).toBe(true)
    expect(Math.abs(headingAlignment.headingTextX - headingAlignment.paragraphTextX)).toBeLessThanOrEqual(1)

    const hardBreakSetup = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const text = '硬换行。'
      const hardBreakOffset = source.indexOf(`${text}\\\n这是下一行。`) + text.length
      if (!view || hardBreakOffset < text.length) return { found: false }
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(hardBreakOffset).top - view.scrollDOM.clientHeight / 2)
      return { found: true, hardBreakOffset }
    })
    expect(hardBreakSetup.found).toBe(true)
    await browser.waitUntil(async () => (await $$('.cm-md-hardbreak-marker')).length > 0)
    const hardBreakState = await browser.execute((hardBreakOffset) => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const marker = view.dom.querySelector('.cm-md-hardbreak-marker')
      const rendered = Boolean(marker && marker.textContent === '\\')
      view.dispatch({ selection: { anchor: hardBreakOffset } })
      const sourceRestoredAtCaret = !view.dom.querySelector('.cm-md-hardbreak-marker') && view.dom.textContent.includes('硬换行。\\')
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(hardBreakOffset).top - view.scrollDOM.clientHeight / 2)
      return { found: true, rendered, sourceRestoredAtCaret }
    }, hardBreakSetup.hardBreakOffset)
    expect(hardBreakState).toEqual({ found: true, rendered: true, sourceRestoredAtCaret: true })

    await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      if (!view) return
      const documentText = view.state.doc.toString()
      const position = documentText.indexOf('HTML 行内标签')
      if (position < 0) return
      view.dispatch({ selection: { anchor: position + 1 } })
      const positionDom = view.domAtPos(position)
      const positionElement = positionDom.node.nodeType === 1 ? positionDom.node : positionDom.node.parentElement
      positionElement?.closest('.cm-line')?.scrollIntoView({ block: 'center' })
    })
    await browser.waitUntil(async () => (await $$('.cm-md-inline-html-kbd')).length >= 1)
    const inlineHtml = await browser.execute(() => ({
      key: document.querySelector('.cm-md-inline-html-kbd')?.textContent,
      sup: document.querySelector('.cm-md-inline-html-sup')?.textContent,
      sub: document.querySelector('.cm-md-inline-html-sub')?.textContent,
      mark: document.querySelector('.cm-md-inline-html-mark')?.textContent,
    }))
    expect(inlineHtml).toEqual({ key: 'Ctrl', sup: '上标', sub: '下标', mark: '标记文本' })

    const inlineSemanticState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const position = source.indexOf('x^2^')
      if (!view || position < 0) return { found: false }
      view.dispatch({ selection: { anchor: position + 1 } })
      const sourceLine = view.domAtPos(position).node.parentElement?.closest('.cm-line')
      sourceLine?.scrollIntoView({ block: 'center' })
      const sourceVisible = view.dom.textContent?.includes('x^2^') ?? false
      view.dispatch({ selection: { anchor: 0 } })
      const rendered = Boolean(view.dom.querySelector('.cm-md-inline-semantic-sup'))
      return { found: true, sourceVisible, rendered }
    })
    expect(inlineSemanticState).toEqual({ found: true, sourceVisible: true, rendered: true })

    const inlineStyleSetup = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const offset = source.indexOf('- **粗体文本**')
      if (!view || offset < 0) return { found: false }
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(offset).top - view.scrollDOM.clientHeight / 2)
      return { found: true }
    })
    expect(inlineStyleSetup.found).toBe(true)
    await browser.waitUntil(async () => (await $$('.cm-md-strong')).length > 0)
    const inlineStyleState = await browser.execute(() => ({
      bold: Boolean(document.querySelector('.cm-md-strong')),
      italic: Boolean(document.querySelector('.cm-md-italic')),
      strikethrough: Boolean(document.querySelector('.cm-md-strikethrough')),
      inlineCode: Boolean(document.querySelector('.cm-md-inline-code')),
      highlight: Boolean(document.querySelector('.cm-md-highlight')),
      superscript: Boolean(document.querySelector('.cm-md-inline-semantic-sup')),
      subscript: Boolean(document.querySelector('.cm-md-inline-semantic-sub')),
      inserted: Boolean(document.querySelector('.cm-md-inline-semantic-ins')),
    }))
    expect(inlineStyleState).toEqual({
      bold: true,
      italic: true,
      strikethrough: true,
      inlineCode: true,
      highlight: true,
      superscript: true,
      subscript: true,
      inserted: true,
    })

    const quoteState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const quoteOffset = source.indexOf('> 这是普通引用段落。')
      if (!view || quoteOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: quoteOffset + 3 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(quoteOffset).top - view.scrollDOM.clientHeight / 2)
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(quoteOffset).top - view.scrollDOM.clientHeight / 2)
      const preview = [...document.querySelectorAll('.cm-md-quote-preview')].find((candidate) =>
        candidate.textContent?.includes('这是普通引用段落。'),
      )
      const rendered = {
        found: Boolean(preview),
        nested: Boolean(preview?.querySelector('blockquote blockquote')),
        strong: preview?.querySelector('strong')?.textContent,
        codeBlock: preview?.querySelector('pre code')?.textContent,
      }
      view.dispatch({ selection: { anchor: quoteOffset + 4 } })
      rendered['sourceRestoredAtCaret'] = ![...document.querySelectorAll('.cm-md-quote-preview')].some((candidate) =>
        candidate.textContent?.includes('这是普通引用段落。'),
      )
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(quoteOffset).top - view.scrollDOM.clientHeight / 2)
      rendered['previewRestored'] = [...document.querySelectorAll('.cm-md-quote-preview')].some((candidate) =>
        candidate.textContent?.includes('这是普通引用段落。'),
      )
      return rendered
    })
    expect(quoteState).toMatchObject({
      found: true,
      nested: false,
      strong: '粗体',
      codeBlock: '引用中的代码块\n',
      sourceRestoredAtCaret: true,
      previewRestored: true,
    })

    const tableState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const tableOffset = source.indexOf('| 左对齐 |')
      if (!view || tableOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: tableOffset + 2 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(tableOffset).top - view.scrollDOM.clientHeight / 2)
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(tableOffset).top - view.scrollDOM.clientHeight / 2)
      const table = document.querySelector('.cm-md-table-preview table')
      const headers = table ? [...table.querySelectorAll('th')] : []
      const rendered = {
        found: Boolean(table),
        headers: headers.map((cell) => cell.textContent?.trim()),
        alignments: headers.map((cell) => [...cell.classList].find((name) => name.startsWith('md-table-align-')) ?? null),
      }
      const editableCell = [...(table?.querySelectorAll('tbody td') ?? [])].find((cell) => cell.textContent?.includes('普通文本'))
      editableCell?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const cellSelection = view.state.selection.main
      rendered['clickedCellSource'] = view.state.sliceDoc(cellSelection.from, cellSelection.to)
      rendered['sourceRestoredAtCaret'] = ![...document.querySelectorAll('.cm-md-table-preview table')].some((candidate) =>
        candidate.textContent?.includes('左对齐'),
      )
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(tableOffset).top - view.scrollDOM.clientHeight / 2)
      const keyboardCell = document.querySelector('.cm-md-table-preview tbody tr:first-child td:nth-child(3)')
      rendered['keyboardCellFocusable'] = keyboardCell?.tabIndex === 0
      keyboardCell?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      const keyboardSelection = view.state.selection.main
      rendered['keyboardCellSource'] = view.state.sliceDoc(keyboardSelection.from, keyboardSelection.to)
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(tableOffset).top - view.scrollDOM.clientHeight / 2)
      rendered['previewRestored'] = [...document.querySelectorAll('.cm-md-table-preview table')].some((candidate) =>
        candidate.textContent?.includes('左对齐'),
      )
      return rendered
    })
    expect(tableState).toEqual({
      found: true,
      headers: ['左对齐', '居中对齐', '右对齐', '默认对齐'],
      alignments: ['md-table-align-left', 'md-table-align-center', 'md-table-align-right', null],
      clickedCellSource: '普通文本',
      sourceRestoredAtCaret: true,
      keyboardCellFocusable: true,
      keyboardCellSource: '123.45',
      previewRestored: true,
    })

    const detailsState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const detailsOffset = source.indexOf('<details>')
      if (!view || detailsOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: detailsOffset + 2 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(detailsOffset).top - view.scrollDOM.clientHeight / 2)
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(detailsOffset).top - view.scrollDOM.clientHeight / 2)
      const preview = document.querySelector('details.cm-md-details-preview')
      if (!preview) return { found: false }
      const summary = preview.querySelector('summary')
      const body = preview.querySelector('.cm-md-details-body')
      const rendered = {
        found: true,
        summary: summary?.textContent?.trim(),
        listItems: body?.querySelectorAll('li').length ?? 0,
        sourceTagsHidden: !preview.textContent?.includes('<details>'),
      }
      summary?.click()
      rendered['toggledOpen'] = preview.open
      view.dispatch({ selection: { anchor: source.indexOf('<summary>') + 3 } })
      rendered['restoresSourceAtCaret'] = !document.querySelector('details.cm-md-details-preview')
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(detailsOffset).top - view.scrollDOM.clientHeight / 2)
      rendered['previewRestored'] = Boolean(document.querySelector('details.cm-md-details-preview'))
      return rendered
    })
    expect(detailsState).toMatchObject({
      found: true,
      summary: '点击展开：折叠内容',
      sourceTagsHidden: true,
      toggledOpen: true,
      restoresSourceAtCaret: true,
      previewRestored: true,
    })
    expect(detailsState.listItems).toBeGreaterThan(0)

    const htmlBlockState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const htmlOffset = source.indexOf('<strong>HTML 块：</strong>')
      if (!view || htmlOffset < 0) return { found: false }
      view.dispatch({ selection: { anchor: htmlOffset + 2 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(htmlOffset).top - view.scrollDOM.clientHeight / 2)
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(htmlOffset).top - view.scrollDOM.clientHeight / 2)
      const preview = document.querySelector('.cm-md-html-block-preview')
      const rendered = {
        found: Boolean(preview),
        strong: preview?.querySelector('strong')?.textContent?.trim(),
        unsafeScriptRemoved: !preview?.querySelector('script'),
      }
      view.dispatch({ selection: { anchor: htmlOffset + 2 } })
      rendered['sourceRestoredAtCaret'] = !document.querySelector('.cm-md-html-block-preview')
      view.dispatch({ selection: { anchor: 0 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(htmlOffset).top - view.scrollDOM.clientHeight / 2)
      rendered['previewRestored'] = Boolean(document.querySelector('.cm-md-html-block-preview'))
      return rendered
    })
    expect(htmlBlockState).toEqual({
      found: true,
      strong: 'HTML 块：',
      unsafeScriptRemoved: true,
      sourceRestoredAtCaret: true,
      previewRestored: true,
    })

    await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const position = source.indexOf('块级公式：')
      if (!view || position < 0) return
      view.dispatch({ selection: { anchor: position + 1 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(position).top - view.scrollDOM.clientHeight / 2)
    })
    await browser.waitUntil(async () => (await $$('.cm-md-math-preview')).length >= 2)
    expect((await $$('.cm-md-math-preview')).length).toBeGreaterThanOrEqual(2)
    await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const position = source.indexOf('[^first]')
      if (!view || position < 0) return
      const target = view.domAtPos(position)
      const element = target.node.nodeType === 1 ? target.node : target.node.parentElement
      element?.closest('.cm-line')?.scrollIntoView({ block: 'center' })
    })
    await browser.waitUntil(async () => (await $$('.cm-md-footnote-reference')).length >= 1)

    await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const position = source.indexOf('### Mermaid 饼图')
      if (!view || position < 0) return
      view.dispatch({ selection: { anchor: position + 5 } })
      view.scrollDOM.scrollTop = Math.max(0, view.lineBlockAt(position).top - view.scrollDOM.clientHeight / 2)
    })
    await browser.waitUntil(async () =>
      browser.execute(() => [...document.querySelectorAll('.cm-line')].some((line) => line.textContent?.includes('Mermaid 饼图'))),
    )
    await browser.execute(() => {
      const heading = [...document.querySelectorAll('.cm-line')].find((line) => line.textContent?.includes('Mermaid 饼图'))
      heading?.click()
    })
    await browser.keys('END')
    await browser.waitUntil(async () => (await $$('.cm-md-mermaid-preview')).length >= 1)
    const headingMarkerState = await browser.execute(() => {
      const heading = [...document.querySelectorAll('.cm-line')].find((line) => line.textContent?.includes('Mermaid 饼图'))
      const marker = heading?.querySelector('.cm-md-heading-marker')
      return {
        className: marker?.className,
        fontSize: marker ? getComputedStyle(marker).fontSize : null,
      }
    })
    expect(headingMarkerState.className).toContain('cm-md-heading-marker')
    expect(headingMarkerState.fontSize).toBe('0px')
    const markerVisibility = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const from = view?.state.doc.toString().indexOf('### Mermaid 饼图') ?? -1
      if (!view || from < 0) return { revealed: false, hiddenAfterCaretLeaves: false }

      view.dispatch({ selection: { anchor: from + 1 } })
      const heading = [...document.querySelectorAll('.cm-line')].find((line) => line.textContent?.includes('Mermaid 饼图'))
      const marker = heading?.querySelector('.cm-md-heading-marker')
      const revealed = marker?.classList.contains('cm-md-source-revealed') ?? false
      const revealedFontSize = marker ? getComputedStyle(marker).fontSize : null

      view.dispatch({ selection: { anchor: from + 5 } })
      const updatedHeading = [...document.querySelectorAll('.cm-line')].find((line) => line.textContent?.includes('Mermaid 饼图'))
      const updatedMarker = updatedHeading?.querySelector('.cm-md-heading-marker')
      return {
        revealed,
        revealedFontSize,
        hiddenAfterCaretLeaves: updatedMarker ? getComputedStyle(updatedMarker).fontSize === '0px' : false,
      }
    })
    expect(markerVisibility.revealed).toBe(true)
    expect(Number.parseFloat(markerVisibility.revealedFontSize)).toBeGreaterThan(0)
    expect(markerVisibility.hiddenAfterCaretLeaves).toBe(true)
    expect(await $$('.cm-md-mermaid-preview')).not.toHaveLength(0)

    const taskEnterState = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      if (!view) return { found: false }
      const original = view.state.doc.toString()
      const task = '- [x] 已完成事项'
      const taskStart = original.indexOf(task)
      if (taskStart < 0) return { found: false }
      view.focus()
      view.dispatch({ selection: { anchor: taskStart + task.length } })
      return { found: true, original, taskStart, task }
    })
    expect(taskEnterState.found).toBe(true)
    await browser.keys('Enter')
    const continuedTask = await browser.execute(() => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const firstTask = '- [x] 已完成事项'
      const start = source.indexOf(firstTask)
      const nextLine = source.slice(start + firstTask.length).split('\n')[1] ?? ''
      return { nextLine, selection: view?.state.selection.main.head ?? -1 }
    })
    expect(continuedTask.nextLine).toBe('- [ ] ')
    await browser.keys('Enter')
    const exitedEmptyTask = await browser.execute((original) => {
      const view = window.__TEXTMARK_EDITOR_VIEW__
      const source = view?.state.doc.toString() ?? ''
      const firstTask = '- [x] 已完成事项'
      const start = source.indexOf(firstTask)
      const separatorPreserved = start >= 0 && source.slice(start + firstTask.length).startsWith('\n\n')
      if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } })
      return { separatorPreserved, restored: view?.state.doc.toString() === original }
    }, taskEnterState.original)
    expect(exitedEmptyTask).toEqual({ separatorPreserved: true, restored: true })

    await $('button[aria-label="停止编辑并返回预览"]').click()
    await expect(await $('.app-shell')).not.toHaveClassContaining('mode-edit')
  })
})
