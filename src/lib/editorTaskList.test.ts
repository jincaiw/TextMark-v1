import { describe, expect, it } from 'vitest'
import { taskListEnterPlan } from './editorTaskList'

describe('Markdown task list Enter behavior', () => {
  it('continues a task as an unchecked item and preserves text after the caret', () => {
    const source = '- [x] task content'
    const position = source.indexOf('content')
    expect(taskListEnterPlan(source, position)).toEqual({
      handled: true,
      change: { from: position, to: position, insert: '\n- [ ] ' },
      selection: position + 7,
    })
  })

  it('increments ordered task markers and preserves indentation', () => {
    const source = '  8) [ ] next task'
    const position = source.indexOf('task') + 4
    expect(taskListEnterPlan(source, position)).toMatchObject({
      handled: true,
      change: { insert: '\n  9) [ ] ' },
    })
  })

  it('removes an empty task marker and leaves a blank separator', () => {
    const source = 'before\n- [ ] \nafter'
    const taskStart = source.indexOf('- [ ]')
    expect(taskListEnterPlan(source, taskStart + 6)).toEqual({
      handled: true,
      change: { from: taskStart, to: taskStart + 6, insert: '' },
      selection: taskStart,
    })
  })

  it('leaves an empty line when exiting an empty end-of-document task', () => {
    const source = '- [ ] '
    expect(taskListEnterPlan(source, source.length)).toEqual({
      handled: true,
      change: { from: 0, to: source.length, insert: '\n' },
      selection: 1,
    })
  })

  it('does not override Enter for selected text or non-task lines', () => {
    expect(taskListEnterPlan('- [ ] selected', 8, false)).toEqual({ handled: false })
    expect(taskListEnterPlan('ordinary paragraph', 8)).toEqual({ handled: false })
    expect(taskListEnterPlan('- [ ] text', 4)).toEqual({ handled: false })
  })
})
