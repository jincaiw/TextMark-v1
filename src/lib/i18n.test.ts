import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, t } from './i18n'

describe('TextMark localization', () => {
  it('starts in Simplified Chinese', () => expect(DEFAULT_LOCALE).toBe('zh-CN'))
  it('keeps the application name stable across locales', () => {
    expect(t('zh-CN', 'appName')).toBe('TextMark')
    expect(t('en', 'appName')).toBe('TextMark')
  })
})
