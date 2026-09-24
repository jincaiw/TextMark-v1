import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Content overlays never consume a workspace grid row. Measure actual height
 * (including narrow-column wrapping) rather than duplicating it in React/CSS. */
export function DocumentTools({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const tools = ref.current
    const workspace = tools?.parentElement
    if (!tools || !workspace) return
    let previous = 0
    const measure = () => {
      const height = tools.getBoundingClientRect().height
      if (height === previous) return
      workspace.style.setProperty('--document-tools-height', `${height}px`)
      // Content inset and visible edge move by the same delta. Leave scrollTop
      // alone; scroll anchoring is disabled on the two real scroll containers.
      previous = height
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(tools)
    return () => {
      observer.disconnect()
      workspace.style.removeProperty('--document-tools-height')
    }
  }, [])
  return (
    <div className="document-tools" ref={ref}>
      {children}
    </div>
  )
}
