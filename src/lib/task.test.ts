import { describe, expect, it } from 'vitest'
import { setTaskChecked } from './task'

describe('source-aware task toggling', () => {
  const source = '- [ ] Same\n  - [x] Nested\n- [ ] Same\n'
  it('targets the exact repeated source line', () =>
    expect(setTaskChecked(source, 3, true)).toBe('- [ ] Same\n  - [x] Nested\n- [x] Same\n'))
  it('unchecks a nested task', () => expect(setTaskChecked(source, 2, false)).toBe('- [ ] Same\n  - [ ] Nested\n- [ ] Same\n'))
  it('rejects non-task and out-of-range lines', () => {
    expect(setTaskChecked('Plain', 1, true)).toBeNull()
    expect(setTaskChecked('- [ ] Task', 2, true)).toBeNull()
  })
  it('supports quoted ordered tasks', () => expect(setTaskChecked('> 1. [ ] Quoted', 1, true)).toBe('> 1. [x] Quoted'))
})
