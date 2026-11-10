import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import morphdom from 'morphdom'
import { openUrl } from '@tauri-apps/plugin-opener'
import { writeKatexSelectionToClipboard } from '../lib/copyTex'
import { sanitizeMermaidSvg } from '../lib/sanitize'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, loadLocalAsset } from '../lib/platform'
import { t } from '../lib/i18n'
import { nextZoomStep } from '../constants'
import { clampScrollFraction } from '../lib/scrollFraction'
import { attachDiagramInteractions, getDiagramController } from '../lib/diagramInteractions'
import { blockIcon } from '../lib/blockIcons'
import { editableMarkdownTables, synchronizeTableHeaderAccessibility, synchronizeTableSourceCoordinates } from '../lib/table'
import { buildSearchPattern } from '../lib/search'
import type { ContentWidth, Locale, RenderedMarkdown, SearchMode, TableEdit, TableEditRequest } from '../types'

interface PreviewPaneProps {
  rendered: RenderedMarkdown
  documentKey: string
  initialScrollTop: number
  /** Scroll fraction (0–1) handed over from the editor when leaving edit mode. */
  initialScrollFraction?: number
  baseDirectory: string | null
  workspacePath: string | null
  zoom: number
  contentWidth: ContentWidth
  searchQuery: string
  searchIndex: number
  matchCase: boolean
  searchMode: SearchMode
  locale: Locale
  /** Stable identity for one fully rendered preview. Used by output actions to
   * wait until async assets and diagrams are present in the live DOM. */
  renderKey?: string
  onHydrated?: (renderKey: string) => void
  onSearchCount: (count: number) => void
  onActiveHeading: (id: string | null) => void
  onZoomChange: (zoom: number) => void
  onOpenRelative: (path: string) => void
  onRenameImage: (path: string) => void
  onToggleTask: (index: number, checked: boolean) => void
  onEditTable: (table: number, row: number, column: number, request: TableEditRequest) => void
}

const hasRtl = (value: string) => /[\u0590-\u08ff]/.test(value)
const disclosureKey = (details: HTMLDetailsElement, index: number) =>
  `${index}:${details.querySelector('summary')?.textContent?.trim() ?? ''}`

function DiagramLightbox({ html, locale, onClose }: { html: string; locale: Locale; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = viewportRef.current
    const stage = viewport?.querySelector<HTMLElement>('.diagram-lightbox-stage')
    if (!viewport || !stage) return
    const output = viewport.parentElement?.querySelector<HTMLOutputElement>('.diagram-lightbox-hud output')
    const fit = viewport.parentElement?.querySelector<HTMLButtonElement>('[data-lightbox-action="fit"]')
    const controller = attachDiagramInteractions(viewport, stage, {
      minimumZoom: 25,
      maximumZoom: 400,
      onChange: (state) => {
        if (output) output.value = `${state.zoom}%`
        if (fit) {
          fit.setAttribute('aria-pressed', String(state.fitWidth))
          fit.title = t(locale, state.fitWidth ? 'actualSize' : 'fitWidth')
        }
      },
    })
    return () => controller.destroy()
  }, [html, locale])
  return (
    <div className="diagram-lightbox" role="dialog" aria-modal="true" aria-label={t(locale, 'diagramWindow')} onClick={onClose}>
      <div className="diagram-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div ref={viewportRef} className="diagram-lightbox-viewport">
          <div className="diagram-lightbox-stage" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div
          className="diagram-lightbox-hud"
          onClick={(event) => {
            const action = (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.lightboxAction
            const controller = getDiagramController(viewportRef.current)
            if (action === 'in') controller?.zoomIn()
            else if (action === 'out') controller?.zoomOut()
            else if (action === 'reset') controller?.reset()
            else if (action === 'fit') controller?.toggleFitWidth()
          }}
        >
          <button data-lightbox-action="out" aria-label={t(locale, 'zoomOut')}>
            −
          </button>
          <output>100%</output>
          <button data-lightbox-action="in" aria-label={t(locale, 'zoomIn')}>
            +
          </button>
          <button data-lightbox-action="reset" title={t(locale, 'actualSize')}>
            1:1
          </button>
          <button data-lightbox-action="fit" title={t(locale, 'actualSize')} aria-pressed="true">
            ↔
          </button>
        </div>
      </div>
      <button className="diagram-lightbox-close" aria-label={t(locale, 'close')} onClick={onClose}>
        ×
      </button>
    </div>
  )
}

export function PreviewPane(props: PreviewPaneProps) {
  const paneRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLElement>(null)
  const gestureZoomRef = useRef<number | null>(null)
  const [diagram, setDiagram] = useState<string | null>(null)
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; table: number; row: number; column: number } | null>(null)
  const [tableSelection, setTableSelection] = useState<{
    table: number
    startRow: number
    startColumn: number
    endRow: number
    endColumn: number
  } | null>(null)
  // Parent callbacks are re-created on every App render. Reading them through a
  // ref keeps them out of the hydration effect's dependency list: an unstable
  // `onHydrated` made that effect clean up and restart on each parent render,
  // which discarded the in-flight `mermaid.render` result it was waiting on.
  const onHydratedRef = useRef(props.onHydrated)
  onHydratedRef.current = props.onHydrated

  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = props.initialScrollTop
  }, [props.documentKey, props.initialScrollTop])

  useEffect(() => {
    if (props.initialScrollFraction == null || !paneRef.current) return
    const pane = paneRef.current
    pane.scrollTop = clampScrollFraction(props.initialScrollFraction) * Math.max(0, pane.scrollHeight - pane.clientHeight)
  }, [props.initialScrollFraction])

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const onGestureStart = () => {
      gestureZoomRef.current = props.zoom
    }
    const onGestureChange = (event: Event) => {
      const scale = (event as { scale?: number }).scale
      if (gestureZoomRef.current == null || typeof scale !== 'number') return
      event.preventDefault()
      props.onZoomChange(Math.min(300, Math.max(50, Math.round(gestureZoomRef.current * scale))))
    }
    const onGestureEnd = () => {
      gestureZoomRef.current = null
    }
    pane.addEventListener('gesturestart', onGestureStart)
    pane.addEventListener('gesturechange', onGestureChange)
    pane.addEventListener('gestureend', onGestureEnd)
    return () => {
      pane.removeEventListener('gesturestart', onGestureStart)
      pane.removeEventListener('gesturechange', onGestureChange)
      pane.removeEventListener('gestureend', onGestureEnd)
    }
  }, [props.zoom, props.onZoomChange])

  useEffect(() => {
    const pane = paneRef.current
    const root = containerRef.current
    if (!pane || !root) return
    let frame = 0
    const update = () => {
      frame = 0
      const overlay = parseFloat(getComputedStyle(pane).getPropertyValue('--document-tools-height')) || 0
      const top = pane.getBoundingClientRect().top + overlay + 28
      let active: string | null = null
      for (const heading of root.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')) {
        if (heading.getBoundingClientRect().top <= top) active = heading.id
        else break
      }
      props.onActiveHeading(active ?? root.querySelector<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')?.id ?? null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    pane.addEventListener('scroll', schedule, { passive: true })
    update()
    return () => {
      pane.removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
    }
  }, [props.documentKey, props.rendered.html, props.onActiveHeading])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    root.querySelectorAll('.table-cell-selected').forEach((cell) => cell.classList.remove('table-cell-selected'))
    if (!tableSelection) return
    const table = editableMarkdownTables(root)[tableSelection.table]
    const minRow = Math.min(tableSelection.startRow, tableSelection.endRow)
    const maxRow = Math.max(tableSelection.startRow, tableSelection.endRow)
    const minColumn = Math.min(tableSelection.startColumn, tableSelection.endColumn)
    const maxColumn = Math.max(tableSelection.startColumn, tableSelection.endColumn)
    Array.from(table?.querySelectorAll('tr') ?? []).forEach((row, rowIndex) => {
      Array.from(row.querySelectorAll('th, td')).forEach((cell, columnIndex) => {
        if (rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minColumn && columnIndex <= maxColumn)
          cell.classList.add('table-cell-selected')
      })
    })
  }, [tableSelection, props.rendered.html])

  const cellCoordinates = (target: EventTarget | null) => {
    const cell = (target as HTMLElement | null)?.closest<HTMLTableCellElement>('td, th')
    const table = cell?.closest('table')
    const row = cell?.closest('tr')
    if (!cell || !table || !row || !containerRef.current) return null
    return {
      table: editableMarkdownTables(containerRef.current).indexOf(table),
      row: Array.from(table.querySelectorAll('tr')).indexOf(row),
      column: Array.from(row.querySelectorAll('th, td')).indexOf(cell),
    }
  }

  const openDiagram = async (figure: HTMLElement) => {
    const sourceNode = figure.querySelector<HTMLElement>('.mermaid[data-mermaid-source]')
    const source = sourceNode?.dataset.mermaidSource ? decodeURIComponent(sourceNode.dataset.mermaidSource) : ''
    if (isTauri() && source) {
      const id = `diagram-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(`textmark.${id}`, source)
      try {
        await invoke('open_mermaid_window', { id, locale: props.locale, title: nearestHeadingText(figure) })
      } catch {
        localStorage.removeItem(`textmark.${id}`)
        setDiagram(figure.innerHTML)
      }
      return
    }
    setDiagram(sourceNode?.innerHTML ?? figure.innerHTML)
  }
  const nearestHeadingText = (figure: HTMLElement): string => {
    // The popup window is titled from the nearest preceding heading, matching
    // the upstream "open diagram in a separate window" behavior.
    const headings = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]') ?? [])
    let text = ''
    for (const heading of headings) {
      if (heading.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING) text = heading.textContent?.trim() ?? ''
      else break
    }
    return text
  }

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const disclosureStates = new Map(
      Array.from(root.querySelectorAll<HTMLDetailsElement>('details')).map(
        (details, index) => [disclosureKey(details, index), details.open] as const,
      ),
    )
    const next = document.createElement('article')
    next.innerHTML = props.rendered.html
    morphdom(root, next, {
      childrenOnly: true,
      onBeforeElUpdated(from, to) {
        if (from instanceof HTMLDetailsElement && from.open) (to as HTMLDetailsElement).open = true
        if (
          from instanceof HTMLElement &&
          to instanceof HTMLElement &&
          from.matches('.mermaid[data-mermaid-rendered="true"]') &&
          from.dataset.mermaidSource === to.dataset.mermaidSource
        )
          return false
        if (from instanceof HTMLElement && from.isContentEditable) return false
        return true
      },
    })
    Array.from(root.querySelectorAll<HTMLDetailsElement>('details')).forEach((details, index) => {
      const open = disclosureStates.get(disclosureKey(details, index))
      if (open !== undefined) details.open = open
    })
    synchronizeTableSourceCoordinates(root, props.rendered.tables)
    synchronizeTableHeaderAccessibility(root, (index) => t(props.locale, 'unnamedColumn', { index }))
    let cancelled = false
    const diagramControllers: ReturnType<typeof attachDiagramInteractions>[] = []

    root.querySelectorAll<HTMLElement>('p, li, blockquote, td, th').forEach((node) => {
      if (hasRtl(node.textContent ?? '')) node.dir = 'rtl'
    })

    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('md-code-wrap')) return
      // The upstream code card: a hairline tray with a header row carrying the
      // language and a pill of Wrap + Copy icon buttons (`decorateCodeBlocks`).
      const wrap = document.createElement('div')
      wrap.className = 'md-code-wrap'
      pre.parentNode?.insertBefore(wrap, pre)
      wrap.appendChild(pre)
      const header = document.createElement('div')
      header.className = 'md-code-header'
      const language = document.createElement('span')
      language.className = 'md-code-language'
      language.textContent = pre.dataset.codeLanguage || 'text'
      header.appendChild(language)
      const actions = document.createElement('span')
      actions.className = 'md-code-actions'
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'md-code-action md-code-toggle-wrap'
      toggle.innerHTML = blockIcon('wrap')
      toggle.title = t(props.locale, 'wrapCode')
      toggle.setAttribute('aria-label', t(props.locale, 'wrapCode'))
      toggle.setAttribute('aria-pressed', 'false')
      actions.appendChild(toggle)
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.className = 'md-code-action md-code-copy'
      copy.innerHTML = blockIcon('copy')
      copy.title = t(props.locale, 'copyCode')
      copy.setAttribute('aria-label', t(props.locale, 'copyCode'))
      actions.appendChild(copy)
      header.appendChild(actions)
      wrap.insertBefore(header, pre)
    })

    if (props.searchQuery) {
      const pattern = buildSearchPattern(props.searchQuery, props.matchCase, props.searchMode)
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.parentElement?.closest('.katex-mathml, button, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      })
      const nodes: Text[] = []
      while (walker.nextNode()) nodes.push(walker.currentNode as Text)
      for (const textNode of nodes) {
        const value = textNode.data
        pattern.lastIndex = 0
        let match = pattern.exec(value)
        if (!match) continue
        const fragment = document.createDocumentFragment()
        let cursor = 0
        do {
          fragment.append(value.slice(cursor, match.index))
          const mark = document.createElement('mark')
          mark.className = 'search-match'
          mark.textContent = match[0]
          fragment.append(mark)
          cursor = match.index + match[0].length
          if (!match[0].length) pattern.lastIndex += 1
          match = pattern.exec(value)
        } while (match)
        fragment.append(value.slice(cursor))
        textNode.replaceWith(fragment)
      }
    }

    const matches = Array.from(root.querySelectorAll<HTMLElement>('mark.search-match'))
    props.onSearchCount(matches.length)
    const active = matches[props.searchIndex % Math.max(matches.length, 1)]
    if (active) {
      active.classList.add('active')
      active.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    const hydrate = async () => {
      if (props.baseDirectory && isTauri()) {
        await Promise.all(
          Array.from(root.querySelectorAll<HTMLImageElement>('img[data-local-src]')).map(async (image) => {
            try {
              image.src = await loadLocalAsset(props.baseDirectory!, image.dataset.localSrc ?? '', props.workspacePath)
            } catch {
              image.classList.add('asset-error')
              image.alt = `${image.alt || 'Image'} — local asset unavailable`
            }
          }),
        )
      }
      if (props.rendered.hasMermaid) {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          flowchart: { htmlLabels: true },
        })
        await Promise.all(
          Array.from(root.querySelectorAll<HTMLElement>('.mermaid[data-mermaid-source]:not([data-mermaid-rendered="true"])')).map(
            async (node, index) => {
              try {
                const source = decodeURIComponent(node.dataset.mermaidSource ?? '')
                const { svg } = await mermaid.render(`textmark-diagram-${Date.now()}-${index}`, source)
                if (!cancelled) {
                  node.innerHTML = sanitizeMermaidSvg(svg)
                  node.dataset.mermaidRendered = 'true'
                  const figure = node.closest('figure')
                  if (figure && !figure.querySelector('.diagram-hud')) {
                    // The upstream diagram HUD: a zoom pill (out / level / in)
                    // and an actions pill (copy / open in window), top-trailing,
                    // revealed on hover (`mermaid-hud`).
                    const hud = document.createElement('div')
                    hud.className = 'diagram-hud'
                    hud.setAttribute('aria-hidden', 'true')
                    hud.innerHTML =
                      `<div class="diagram-hud-group diagram-hud-zoom">` +
                      `<button type="button" class="diagram-hud-btn" data-diagram-action="out" tabindex="-1" aria-label="${t(props.locale, 'zoomOut')}">${blockIcon('out')}</button>` +
                      `<button type="button" class="diagram-hud-btn diagram-hud-level" data-diagram-action="reset" tabindex="-1" aria-label="${t(props.locale, 'resetZoom')}">100%</button>` +
                      `<button type="button" class="diagram-hud-btn" data-diagram-action="in" tabindex="-1" aria-label="${t(props.locale, 'zoomIn')}">${blockIcon('in')}</button>` +
                      `</div>` +
                      `<div class="diagram-hud-group diagram-hud-actions">` +
                      `<button type="button" class="diagram-hud-btn diagram-hud-copy" data-diagram-action="copy" tabindex="-1" aria-label="${t(props.locale, 'copy')}" title="${t(props.locale, 'copy')}">${blockIcon('copy')}</button>` +
                      `<button type="button" class="diagram-hud-btn diagram-hud-popup" data-diagram-action="open" tabindex="-1" aria-label="${t(props.locale, 'openInWindow')}" title="${t(props.locale, 'openInWindow')}">${blockIcon('popup')}</button>` +
                      `</div>`
                    figure.append(hud)
                  }
                  if (figure) {
                    const level = figure.querySelector<HTMLButtonElement>('.diagram-hud-level')
                    diagramControllers.push(
                      attachDiagramInteractions(figure, node, {
                        onChange: (state) => {
                          if (level) level.textContent = `${state.zoom}%`
                        },
                      }),
                    )
                  }
                }
              } catch {
                if (!cancelled)
                  node.textContent = props.locale === 'zh-CN' ? '无法渲染 Mermaid 图表。' : 'Unable to render this Mermaid diagram.'
              }
            },
          ),
        )
      }
    }
    void hydrate().then(async () => {
      // `document.fonts.ready` and image decoding are both part of the visible
      // document. Reporting earlier races export/print against late layout.
      await document.fonts?.ready
      await Promise.all(Array.from(root.querySelectorAll<HTMLImageElement>('img')).map((image) => image.decode().catch(() => undefined)))
      if (!cancelled && props.renderKey) props.onHydrated?.(props.renderKey)
    })
    return () => {
      cancelled = true
      diagramControllers.forEach((controller) => controller.destroy())
    }
  }, [
    props.rendered.html,
    props.rendered.hasMermaid,
    props.baseDirectory,
    props.workspacePath,
    props.searchQuery,
    props.searchIndex,
    props.matchCase,
    props.searchMode,
    props.locale,
    props.renderKey,
  ])

  return (
    <section
      ref={paneRef}
      className="preview-pane"
      aria-label="Rendered Markdown preview"
      tabIndex={0}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        props.onZoomChange(nextZoomStep(props.zoom, event.deltaY < 0 ? 1 : -1))
      }}
      onCopy={(event) => {
        if (!containerRef.current) return
        if (!tableSelection) {
          writeKatexSelectionToClipboard(event.nativeEvent, containerRef.current)
          return
        }
        const table = editableMarkdownTables(containerRef.current)[tableSelection.table]
        const rows = Array.from(table?.querySelectorAll('tr') ?? [])
        const minRow = Math.min(tableSelection.startRow, tableSelection.endRow)
        const maxRow = Math.max(tableSelection.startRow, tableSelection.endRow)
        const minColumn = Math.min(tableSelection.startColumn, tableSelection.endColumn)
        const maxColumn = Math.max(tableSelection.startColumn, tableSelection.endColumn)
        const text = rows
          .slice(minRow, maxRow + 1)
          .map((row) =>
            Array.from(row.querySelectorAll('th, td'))
              .slice(minColumn, maxColumn + 1)
              .map((cell) => cell.textContent?.trim() ?? '')
              .join('\t'),
          )
          .join('\n')
        event.preventDefault()
        event.clipboardData.setData('text/plain', text)
      }}
    >
      <article
        ref={containerRef}
        className={`markdown-body content-${props.contentWidth}`}
        style={{ fontSize: `${(15 * props.zoom) / 100}px` }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('a, button, input, [contenteditable=true]')) return
          const cell = cellCoordinates(event.target)
          if (!cell) {
            setTableSelection(null)
            return
          }
          event.preventDefault()
          paneRef.current?.focus({ preventScroll: true })
          setTableSelection({ table: cell.table, startRow: cell.row, startColumn: cell.column, endRow: cell.row, endColumn: cell.column })
        }}
        onPointerMove={(event) => {
          if (!(event.buttons & 1) || !tableSelection) return
          const cell = cellCoordinates(event.target)
          if (!cell || cell.table !== tableSelection.table) return
          setTableSelection((selection) => (selection ? { ...selection, endRow: cell.row, endColumn: cell.column } : selection))
        }}
        onDoubleClick={(event) => {
          const image = (event.target as HTMLElement).closest<HTMLImageElement>('img[data-local-src]')
          if (image?.dataset.localSrc) {
            props.onRenameImage(image.dataset.localSrc)
            return
          }
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td, th')
          if (cell) {
            event.preventDefault()
            cell.contentEditable = 'plaintext-only'
            cell.classList.add('editing')
            cell.focus()
            const selection = window.getSelection()
            selection?.selectAllChildren(cell)
          }
        }}
        onContextMenu={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td, th')
          const table = cell?.closest('table')
          if (!cell || !table || !containerRef.current) return
          event.preventDefault()
          const tables = editableMarkdownTables(containerRef.current)
          const rows = Array.from(table.querySelectorAll('tr'))
          const cells = Array.from(cell.parentElement?.querySelectorAll('th, td') ?? [])
          setTableMenu({
            x: event.clientX,
            y: event.clientY,
            table: tables.indexOf(table),
            row: rows.indexOf(cell.parentElement as HTMLTableRowElement),
            column: cells.indexOf(cell),
          })
        }}
        onChange={(event) => {
          const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>('input.task-list-item-checkbox')
          if (!checkbox) return
          const boxes = Array.from(containerRef.current?.querySelectorAll('input.task-list-item-checkbox') ?? [])
          props.onToggleTask(boxes.indexOf(checkbox), checkbox.checked)
        }}
        onInput={(event) => {
          const header = (event.target as HTMLElement).closest<HTMLTableCellElement>('th[data-table-column]')
          if (!header) return
          const index = Number(header.dataset.tableColumn ?? 0) + 1
          if (header.textContent?.trim()) {
            header.removeAttribute('data-placeholder')
            header.removeAttribute('aria-label')
          } else {
            const placeholder = t(props.locale, 'unnamedColumn', { index })
            header.dataset.placeholder = placeholder
            header.setAttribute('aria-label', placeholder)
          }
        }}
        onBlur={(event) => {
          const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td[contenteditable], th[contenteditable]')
          if (!cell || !containerRef.current) return
          const table = cell.closest('table')
          const row = cell.closest('tr')
          if (!table || !row) return
          const tables = editableMarkdownTables(containerRef.current)
          const rows = Array.from(table.querySelectorAll('tr'))
          const cells = Array.from(row.querySelectorAll('th, td'))
          cell.contentEditable = 'false'
          cell.classList.remove('editing')
          props.onEditTable(tables.indexOf(table), rows.indexOf(row), cells.indexOf(cell), {
            edit: 'setCell',
            value: cell.textContent ?? '',
          })
        }}
        onClick={(event) => {
          setTableMenu(null)
          const target = event.target as HTMLElement
          const codeCopy = target.closest<HTMLButtonElement>('.md-code-copy')
          if (codeCopy) {
            const code = codeCopy.closest('.md-code-wrap')?.querySelector('pre > code')
            void navigator.clipboard.writeText(code?.textContent ?? '').then(() => {
              codeCopy.innerHTML = blockIcon('check')
              codeCopy.classList.add('is-copied')
              codeCopy.title = t(props.locale, 'codeCopied')
              codeCopy.setAttribute('aria-label', t(props.locale, 'codeCopied'))
              window.setTimeout(() => {
                codeCopy.innerHTML = blockIcon('copy')
                codeCopy.classList.remove('is-copied')
                codeCopy.title = t(props.locale, 'copyCode')
                codeCopy.setAttribute('aria-label', t(props.locale, 'copyCode'))
              }, 1100)
            })
            return
          }
          const codeWrap = target.closest<HTMLButtonElement>('.md-code-toggle-wrap')
          if (codeWrap) {
            const wrapped = codeWrap.closest('.md-code-wrap')?.classList.toggle('is-wrapped') ?? false
            codeWrap.setAttribute('aria-pressed', String(wrapped))
            codeWrap.title = t(props.locale, wrapped ? 'unwrapCode' : 'wrapCode')
            codeWrap.innerHTML = blockIcon(wrapped ? 'unwrap' : 'wrap')
            return
          }
          const diagramAction = target.closest<HTMLButtonElement>('[data-diagram-action]')
          if (diagramAction) {
            const figure = diagramAction.closest<HTMLElement>('.diagram')
            if (!figure) return
            const action = diagramAction.dataset.diagramAction
            if (action === 'open') {
              void openDiagram(figure)
              return
            }
            if (action === 'copy') {
              const sourceNode = figure.querySelector<HTMLElement>('.mermaid[data-mermaid-source]')
              const source = sourceNode?.dataset.mermaidSource
                ? decodeURIComponent(sourceNode.dataset.mermaidSource).replace(/\s+$/, '')
                : ''
              if (source)
                void navigator.clipboard.writeText(source).then(() => {
                  diagramAction.innerHTML = blockIcon('check')
                  diagramAction.classList.add('is-copied')
                  diagramAction.setAttribute('aria-label', t(props.locale, 'copied'))
                  window.setTimeout(() => {
                    diagramAction.innerHTML = blockIcon('copy')
                    diagramAction.classList.remove('is-copied')
                    diagramAction.setAttribute('aria-label', t(props.locale, 'copy'))
                  }, 1100)
                })
              return
            }
            const controller = getDiagramController(figure)
            if (action === 'in') controller?.zoomIn()
            else if (action === 'out') controller?.zoomOut()
            else if (action === 'reset') controller?.reset()
            return
          }
          const formula = target.closest<HTMLElement>('.katex')
          if (formula) {
            const source = formula.querySelector('annotation')?.textContent
            if (source) void navigator.clipboard.writeText(source)
            return
          }
          const anchor = target.closest<HTMLAnchorElement>('a[href]')
          if (!anchor) return
          const href = anchor.getAttribute('href') ?? ''
          if (href.startsWith('#')) return
          event.preventDefault()
          if (/^https?:/i.test(href)) isTauri() ? void openUrl(href) : window.open(href, '_blank', 'noopener,noreferrer')
          else if (/\.(?:md|markdown|mdown|mkd|mkdn)(?:[?#].*)?$/i.test(href)) props.onOpenRelative(href)
        }}
      />
      <div className="sr-only" aria-live="polite" />
      {tableMenu ? (
        <div
          className="table-context-menu"
          style={{ left: tableMenu.x, top: tableMenu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {(
            [
              'addRowBefore',
              'addRowAfter',
              'duplicateRow',
              'deleteRow',
              'addColumnBefore',
              'addColumnAfter',
              'duplicateColumn',
              'deleteColumn',
            ] as TableEdit[]
          ).map((edit) => {
            const labels: Record<Exclude<TableEdit, 'setCell'>, Parameters<typeof t>[1]> = {
              addRowBefore: 'addRowAbove',
              addRowAfter: 'addRowBelow',
              duplicateRow: 'duplicateRow',
              deleteRow: 'deleteRow',
              addColumnBefore: 'addColumnBefore',
              addColumnAfter: 'addColumnAfter',
              duplicateColumn: 'duplicateColumn',
              deleteColumn: 'deleteColumn',
            }
            if (edit === 'deleteRow' && tableMenu.row === 0) return null
            return (
              <button
                key={edit}
                role="menuitem"
                onClick={() => {
                  props.onEditTable(tableMenu.table, tableMenu.row, tableMenu.column, { edit })
                  setTableMenu(null)
                }}
              >
                {t(props.locale, labels[edit as Exclude<TableEdit, 'setCell'>])}
              </button>
            )
          })}
        </div>
      ) : null}
      {diagram ? <DiagramLightbox html={diagram} locale={props.locale} onClose={() => setDiagram(null)} /> : null}
    </section>
  )
}
