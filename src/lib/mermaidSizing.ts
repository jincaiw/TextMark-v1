export interface Size {
  width: number
  height: number
}

export const MERMAID_POPUP_SCREEN_FRACTION = 0.82
export const MERMAID_POPUP_MINIMUM_WIDTH = 420

export function preferredMermaidPopupSize(natural: Size, display: Size, screen: Size): Size {
  const source = natural.width > 0 && natural.height > 0 ? natural : display
  if (source.width <= 0 || source.height <= 0) return { width: MERMAID_POPUP_MINIMUM_WIDTH, height: 320 }
  const maxWidth = Math.max(320, screen.width * MERMAID_POPUP_SCREEN_FRACTION)
  const maxHeight = Math.max(240, screen.height * MERMAID_POPUP_SCREEN_FRACTION)
  const minimumScale = Math.max(1, MERMAID_POPUP_MINIMUM_WIDTH / source.width, 100 / source.height)
  const maximumScale = Math.min(maxWidth / source.width, maxHeight / source.height)
  const scale = Math.min(minimumScale, maximumScale)
  return { width: source.width * scale, height: source.height * scale }
}

export const canPresentMermaid = (svg: string) => /<svg\b/i.test(svg)
