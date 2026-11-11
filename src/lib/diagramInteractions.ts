export interface DiagramViewState {
  zoom: number
  panX: number
  panY: number
  fitWidth: boolean
}

export interface DiagramController {
  getState: () => DiagramViewState
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  toggleFitWidth: () => void
  destroy: () => void
}

interface DiagramOptions {
  minimumZoom?: number
  maximumZoom?: number
  initialFitWidth?: boolean
  onChange?: (state: DiagramViewState) => void
}

const controllers = new WeakMap<HTMLElement, DiagramController>()

// Upstream keeps the scale fractional (0.25–8) and rounds only for the HUD
// label, so repeated ×1.25/×0.8 steps compound exactly as the reference does.
export const clampDiagramZoom = (zoom: number, minimum = 25, maximum = 800) => Math.min(maximum, Math.max(minimum, zoom))

export function panForZoomPoint(state: DiagramViewState, nextZoom: number, point: { x: number; y: number }) {
  const ratio = nextZoom / state.zoom
  return {
    panX: point.x - (point.x - state.panX) * ratio,
    panY: point.y - (point.y - state.panY) * ratio,
  }
}

export function getDiagramController(viewport: HTMLElement | null) {
  return viewport ? controllers.get(viewport) : undefined
}

export function attachDiagramInteractions(viewport: HTMLElement, content: HTMLElement, options: DiagramOptions = {}): DiagramController {
  controllers.get(viewport)?.destroy()
  const svg = content.querySelector<SVGSVGElement>('svg')
  const minimum = options.minimumZoom ?? 25
  const maximum = options.maximumZoom ?? 800
  const naturalWidth =
    svg?.viewBox?.baseVal?.width || Number.parseFloat(svg?.getAttribute('width') ?? '') || Math.max(content.scrollWidth, 320)
  const state: DiagramViewState = { zoom: 100, panX: 0, panY: 0, fitWidth: options.initialFitWidth ?? true }
  const pointers = new Map<number, { x: number; y: number }>()
  let dragOrigin: { x: number; y: number; panX: number; panY: number } | null = null

  const apply = () => {
    content.classList.toggle('diagram-fit-width', state.fitWidth)
    content.style.width = state.fitWidth ? '100%' : `${naturalWidth}px`
    content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom / 100})`
    viewport.dataset.diagramZoom = String(state.zoom)
    viewport.dataset.diagramFitWidth = String(state.fitWidth)
    options.onChange?.({ ...state })
  }
  const relativePoint = (clientX: number, clientY: number) => {
    const bounds = viewport.getBoundingClientRect()
    return { x: clientX - bounds.left, y: clientY - bounds.top }
  }
  const setZoom = (value: number, point = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) => {
    const next = clampDiagramZoom(value, minimum, maximum)
    if (next === state.zoom) return
    const pan = panForZoomPoint(state, next, point)
    state.zoom = next
    state.panX = pan.panX
    state.panY = pan.panY
    apply()
  }
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setZoom(state.zoom * Math.exp(-event.deltaY * 0.01), relativePoint(event.clientX, event.clientY))
  }
  const onDoubleClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('.diagram-hud')) return
    event.preventDefault()
    event.stopPropagation()
    // Upstream: any non-100% scale resets to fit; at 100% a double-click zooms ×2.
    if (Math.abs(state.zoom - 100) > 0.1) {
      state.zoom = 100
      state.panX = 0
      state.panY = 0
      apply()
    } else {
      setZoom(state.zoom * 2, relativePoint(event.clientX, event.clientY))
    }
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.diagram-hud')) return
    event.preventDefault()
    event.stopPropagation()
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragOrigin = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY }
    viewport.setPointerCapture?.(event.pointerId)
    viewport.classList.add('diagram-panning')
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) || !dragOrigin) return
    event.preventDefault()
    event.stopPropagation()
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    state.panX = dragOrigin.panX + event.clientX - dragOrigin.x
    state.panY = dragOrigin.panY + event.clientY - dragOrigin.y
    apply()
  }
  const onPointerEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return
    dragOrigin = null
    viewport.releasePointerCapture?.(event.pointerId)
    viewport.classList.remove('diagram-panning')
  }

  viewport.addEventListener('wheel', onWheel, { passive: false })
  viewport.addEventListener('dblclick', onDoubleClick)
  viewport.addEventListener('pointerdown', onPointerDown)
  viewport.addEventListener('pointermove', onPointerMove)
  viewport.addEventListener('pointerup', onPointerEnd)
  viewport.addEventListener('pointercancel', onPointerEnd)
  apply()

  const controller: DiagramController = {
    getState: () => ({ ...state }),
    zoomIn: () => setZoom(state.zoom * 1.25),
    zoomOut: () => setZoom(state.zoom * 0.8),
    reset: () => {
      state.zoom = 100
      state.panX = 0
      state.panY = 0
      apply()
    },
    toggleFitWidth: () => {
      state.fitWidth = !state.fitWidth
      state.panX = 0
      state.panY = 0
      apply()
    },
    destroy: () => {
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('dblclick', onDoubleClick)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', onPointerEnd)
      viewport.removeEventListener('pointercancel', onPointerEnd)
      viewport.classList.remove('diagram-panning')
      if (controllers.get(viewport) === controller) controllers.delete(viewport)
    },
  }
  controllers.set(viewport, controller)
  return controller
}
