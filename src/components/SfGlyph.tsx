import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { sfSymbolImages, type SfSymbolImage, type SfSymbolSpec } from '../lib/platform'

/** Rasterised symbols are the same bitmap for every caller, so one request per
 * (name, size, weight) serves the whole window. Failed requests are cached as
 * null; the caller then keeps its hand-drawn fallback. */
const cache = new Map<string, SfSymbolImage | null>()
const pending = new Map<string, Promise<SfSymbolImage>>()

const specKey = ({ name, points, weight }: SfSymbolSpec) => `${name}|${points}|${weight}`

function loadSymbol(spec: SfSymbolSpec): Promise<SfSymbolImage> {
  const key = specKey(spec)
  const existing = pending.get(key)
  if (existing) return existing
  const request = sfSymbolImages([spec])
    .then(([image]) => {
      const resolved = image?.url ? image : null
      cache.set(key, resolved)
      return resolved ?? { url: '', width: 0, height: 0 }
    })
    .catch(() => {
      cache.set(key, null)
      return { url: '', width: 0, height: 0 }
    })
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

interface SfGlyphProps extends SfSymbolSpec {
  className?: string
  /** The hand-drawn glyph used off macOS, or until the raster arrives. */
  fallback?: ReactNode
}

/** A titlebar symbol drawn by AppKit and tinted here: the PNG becomes a CSS
 * mask over `currentColor`, so the glyph follows every text colour the
 * surrounding button already sets. The mask box is the symbol's point size,
 * which keeps the 2x raster on whole pixels. */
export function SfGlyph({ name, points, weight, className, fallback }: SfGlyphProps) {
  const key = specKey({ name, points, weight })
  const [image, setImage] = useState<SfSymbolImage | null | undefined>(() => cache.get(key))

  useEffect(() => {
    if (cache.has(key)) {
      setImage(cache.get(key) ?? null)
      return
    }
    let active = true
    void loadSymbol({ name, points, weight }).then((resolved) => {
      if (active) setImage(resolved.url ? resolved : null)
    })
    return () => {
      active = false
    }
  }, [key, name, points, weight])

  if (!image?.url) return <>{fallback ?? null}</>

  // AppKit's symbol image carries the symbol's own alignment padding, so the
  // ink is only part of the image. Drawing the image at its natural size — no
  // `contain` rescale into a 22pt box — reproduces the reference's ink exactly;
  // the box is set inline so it also overrides the stylesheet's fixed sizes.
  const style: CSSProperties = {
    width: `${image.width}px`,
    height: `${image.height}px`,
    WebkitMaskImage: `url("${image.url}")`,
    maskImage: `url("${image.url}")`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  }
  return <span className={className ? `sf-glyph ${className}` : 'sf-glyph'} style={style} aria-hidden="true" />
}
