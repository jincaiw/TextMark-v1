import { describe, expect, it } from 'vitest'
import { clampScrollFraction } from './scrollFraction'

describe('clampScrollFraction', () => {
  it('clamps out-of-range fractions', () => {
    expect(clampScrollFraction(-0.5)).toBe(0)
    expect(clampScrollFraction(1.5)).toBe(1)
  })
  it('passes valid fractions through', () => {
    expect(clampScrollFraction(0)).toBe(0)
    expect(clampScrollFraction(0.42)).toBe(0.42)
    expect(clampScrollFraction(1)).toBe(1)
  })
  it('treats non-finite input as the top of the document', () => {
    expect(clampScrollFraction(NaN)).toBe(0)
    expect(clampScrollFraction(Infinity)).toBe(0)
  })
})
