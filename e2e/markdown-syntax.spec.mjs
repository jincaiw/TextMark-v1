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
    await expect(await $('.markdown-body h1')).toHaveText('Markdown 语法全景测试文档')
    await browser.waitUntil(async () => (await $$('.mermaid[data-mermaid-rendered="true"]')).length >= 3)

    const state = await browser.execute(() => {
      const body = document.querySelector('.markdown-body')
      const syntaxTable = [...body.querySelectorAll('table')].find((table) => table.textContent.includes('默认端口'))
      const alignment = syntaxTable ? [...syntaxTable.querySelectorAll('th')].map((cell) => getComputedStyle(cell).textAlign) : []
      const softLine = [...body.querySelectorAll('p')].find((paragraph) => paragraph.textContent.includes('这是第一段'))
      const hardLine = [...body.querySelectorAll('p')].find((paragraph) => paragraph.textContent.includes('这是第二段'))
      const longCode = [...body.querySelectorAll('pre')].find((node) => node.textContent.includes('这一行非常长'))
      const dataImage = [...body.querySelectorAll('img')].find((image) => image.getAttribute('src')?.startsWith('data:image/svg+xml'))
      return {
        frontmatter: Boolean(body.querySelector('.md-frontmatter')),
        tables: body.querySelectorAll('table').length,
        tasks: body.querySelectorAll('input.task-list-item-checkbox').length,
        footnotes: Boolean(body.querySelector('.footnotes')),
        math: body.querySelectorAll('.katex').length,
        alerts: body.querySelectorAll('.markdown-alert').length,
        mermaid: body.querySelectorAll('.mermaid[data-mermaid-rendered="true"]').length,
        scripts: body.querySelectorAll('script').length,
        iframes: body.querySelectorAll('iframe').length,
        unsafeHandlers: body.querySelectorAll('[onerror],[onclick],[onload]').length,
        dataImageWidth: dataImage?.naturalWidth ?? 0,
        alignment,
        manualAnchor: Boolean(document.getElementById('一标题与分隔线')),
        softLineBreaks: softLine?.querySelectorAll('br').length ?? 0,
        hardLineBreaks: hardLine?.querySelectorAll('br').length ?? 0,
        longCodeOverflows: Boolean(longCode && longCode.scrollWidth > longCode.clientWidth),
      }
    })

    expect(state).toMatchObject({
      frontmatter: true,
      footnotes: true,
      scripts: 0,
      iframes: 0,
      unsafeHandlers: 0,
      manualAnchor: true,
      softLineBreaks: 0,
      hardLineBreaks: 1,
      longCodeOverflows: true,
    })
    expect(state.tables).toBeGreaterThanOrEqual(10)
    expect(state.tasks).toBeGreaterThanOrEqual(8)
    expect(state.math).toBeGreaterThanOrEqual(4)
    expect(state.alerts).toBeGreaterThanOrEqual(5)
    expect(state.mermaid).toBe(3)
    expect(state.dataImageWidth).toBeGreaterThan(0)
    expect(state.alignment).toEqual(['left', 'left', 'right', 'center'])
  })
})
