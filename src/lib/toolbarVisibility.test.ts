import { describe, expect, it } from 'vitest'
import { readToolbarVisibility, saveToolbarVisibility, toolbarVisibilityStorageKey } from './toolbarVisibility'

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('toolbar visibility', () => {
  it('stores visibility separately for each native window', () => {
    const first = toolbarVisibilityStorageKey('document-a')
    const second = toolbarVisibilityStorageKey('document-b')
    const values = storage()

    saveToolbarVisibility(values, first, false)

    expect(readToolbarVisibility(values, first)).toBe(false)
    expect(readToolbarVisibility(values, second)).toBe(true)
  })

  it('defaults to visible and tolerates unavailable storage', () => {
    expect(readToolbarVisibility(storage(), 'toolbar')).toBe(true)
    expect(
      readToolbarVisibility(
        {
          getItem: () => {
            throw new Error('storage unavailable')
          },
          setItem: () => {},
        },
        'toolbar',
      ),
    ).toBe(true)
    expect(() =>
      saveToolbarVisibility(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('storage unavailable')
          },
        },
        'toolbar',
        false,
      ),
    ).not.toThrow()
  })
})
