import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, resolveLocale, t } from './i18n'

describe('TextMark localization', () => {
  it('starts in Simplified Chinese', () => expect(DEFAULT_LOCALE).toBe('zh-CN'))
  it('keeps the application name stable across locales', () => {
    expect(t('zh-CN', 'appName')).toBe('TextMark')
    expect(t('en', 'appName')).toBe('TextMark')
  })
})

describe('resolveLocale', () => {
  it('keeps explicit language choices verbatim', () => {
    expect(resolveLocale('en', ['zh-CN'])).toBe('en')
    expect(resolveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
  })
  it('follows the system language list for the system setting', () => {
    expect(resolveLocale('system', ['en-US', 'zh-CN'])).toBe('en')
    expect(resolveLocale('system', ['zh-Hans-CN', 'en'])).toBe('zh-CN')
  })
  it('falls back to Chinese when no bundled language matches', () => {
    expect(resolveLocale('system', ['fr-FR', 'ja-JP'])).toBe('zh-CN')
    expect(resolveLocale('system', [])).toBe('zh-CN')
  })
  it('treats unknown stored values like the system default', () => {
    expect(resolveLocale('fr', ['en-GB'])).toBe('en')
  })
})
