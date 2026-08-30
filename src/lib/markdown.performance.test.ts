import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('long-document rendering budget', () => {
  it('renders a deterministic 1,200-section document without a catastrophic slowdown', () => {
    const source = Array.from(
      { length: 1_200 },
      (_, index) =>
        `## Section ${index}\n\nParagraph ${index} with **bold**, [link](https://example.com/${index}), and inline \`code\`.\n\n| A | B |\n| --- | ---: |\n| ${index} | ${index + 1} |`,
    ).join('\n\n')
    const started = performance.now()
    const rendered = renderMarkdown(source)
    const elapsed = performance.now() - started

    expect(source.length).toBeGreaterThan(150_000)
    expect(rendered.outline).toHaveLength(1_200)
    expect(rendered.tables).toHaveLength(1_200)
    expect(rendered.html.length).toBeGreaterThan(source.length)
    expect(elapsed).toBeLessThan(5_000)
  })
})
