import { describe, expect, it } from 'vitest'
import { detectCodeFenceLanguage, parseCodeFenceInfo } from './codeFence'

describe('upstream CodeFenceInfo parity', () => {
  it.each([
    ['Swift', 'swift', ''],
    ['mermaid some-name', 'mermaid', 'some-name'],
    ['ts\ttitle="foo.ts"', 'ts', 'title="foo.ts"'],
    ['ts  Title="Foo Bar"  {1,3}', 'ts', 'Title="Foo Bar"  {1,3}'],
    ['   mermaid   some-name   ', 'mermaid', 'some-name'],
    [null, '', ''],
    ['', '', ''],
    ['   \t  ', '', ''],
  ] as const)('parses %s', (raw, language, metadata) => {
    expect(parseCodeFenceInfo(raw)).toMatchObject({ language, metadata })
  })

  it('normalizes every shell alias to the bash highlighter', () => {
    for (const alias of ['shell', 'sh', 'zsh', 'console', 'bash']) expect(parseCodeFenceInfo(alias).highlightLanguage).toBe('bash')
    expect(parseCodeFenceInfo('swift').highlightLanguage).toBe('swift')
  })

  it.each([
    ['{"name":"TextMark"}', 'json'],
    ['#!/usr/bin/env bash\necho ready', 'bash'],
    ['resource "aws_s3_bucket" "example" {}', 'hcl'],
    ['import Foundation\nfunc launch() {}', 'swift'],
    ['def test():\n  return True', 'python'],
    ['SELECT name FROM documents', 'sql'],
    ['const title: string = "TextMark"', 'javascript'],
    ['title: TextMark\ntags: docs', 'yaml'],
    ['.card { color: red; }', 'css'],
    ['<section>TextMark</section>', 'html'],
  ])('detects unlabeled %s as %s', (source, language) => expect(detectCodeFenceLanguage(source)).toBe(language))

  it('does not guess for prose or empty fences', () => {
    expect(detectCodeFenceLanguage('A plain paragraph.')).toBeNull()
    expect(detectCodeFenceLanguage('   \n')).toBeNull()
  })
})
