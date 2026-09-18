import { useEffect, useRef } from 'react'

interface PanelResizerProps {
  side: 'sidebar' | 'inspector'
  width: number
  min: number
  max: number
  onWidthChange: (width: number) => void
}

export function PanelResizer({ side, width, min, max, onWidthChange }: PanelResizerProps) {
  const startRef = useRef<{ x: number; width: number } | null>(null)

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const delta = side === 'sidebar' ? event.clientX - start.x : start.x - event.clientX
      onWidthChange(Math.min(max, Math.max(min, Math.round(start.width + delta))))
    }
    const end = () => {
      startRef.current = null
      document.body.classList.remove('resizing-panel')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [max, min, onWidthChange, side])

  return (
    <div
      className={`panel-resizer panel-resizer-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'sidebar' ? '调整侧栏宽度' : '调整检查器宽度'}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        startRef.current = { x: event.clientX, width }
        document.body.classList.add('resizing-panel')
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const direction = side === 'sidebar' ? (event.key === 'ArrowRight' ? 1 : -1) : event.key === 'ArrowLeft' ? 1 : -1
        onWidthChange(Math.min(max, Math.max(min, width + direction * (event.shiftKey ? 10 : 1))))
      }}
    />
  )
}
