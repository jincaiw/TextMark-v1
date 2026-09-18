import { afterEach, describe, expect, it } from 'vitest'
import {
  detectPlatform,
  detectRuntime,
  discoverApplications,
  errorCode,
  isMacos,
  parentDirectory,
  resolveSiblingPath,
  shouldUseDedicatedSettingsWindow,
} from './platform'

const mockUserAgent = (agent: string, platform = '') => {
  Object.defineProperty(navigator, 'userAgent', { value: agent, configurable: true })
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true })
}

describe('platform detection adapter', () => {
  afterEach(() => {
    mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'MacIntel')
  })

  it('detects Windows, Linux and macOS from the user agent', () => {
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Win32')
    expect(detectPlatform()).toBe('windows')
    mockUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', 'Linux x86_64')
    expect(detectPlatform()).toBe('linux')
    mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'MacIntel')
    expect(detectPlatform()).toBe('macos')
  })

  it('reports the tauri runtime only when the IPC bridge is present', () => {
    expect(detectRuntime()).toBe('browser')
    ;(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    expect(detectRuntime()).toBe('tauri')
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    expect(detectRuntime()).toBe('browser')
  })

  it('isMacos only matches Apple platforms', () => {
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Win32')
    expect(isMacos()).toBe(false)
    mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'MacIntel')
    expect(isMacos()).toBe(true)
  })

  it('keeps Settings in the primary window on Windows', () => {
    expect(shouldUseDedicatedSettingsWindow('windows', true, false)).toBe(false)
    expect(shouldUseDedicatedSettingsWindow('linux', true, false)).toBe(true)
    expect(shouldUseDedicatedSettingsWindow('macos', true, false)).toBe(true)
    expect(shouldUseDedicatedSettingsWindow('macos', false, false)).toBe(false)
    expect(shouldUseDedicatedSettingsWindow('macos', true, true)).toBe(false)
  })
})

describe('platform paths', () => {
  it('finds POSIX and Windows parent directories', () => {
    expect(parentDirectory('/work/docs/readme.md')).toBe('/work/docs')
    expect(parentDirectory('C:\\work\\docs\\readme.md')).toBe('C:\\work\\docs')
  })

  it('resolves relative Markdown links on every desktop platform', () => {
    expect(resolveSiblingPath('/work/docs', '../README.md')).toBe('/work/README.md')
    expect(resolveSiblingPath('C:\\work\\docs', '../README.md')).toBe('C:\\work\\README.md')
  })
  it('drops query and fragment components from sibling links', () =>
    expect(resolveSiblingPath('/work/docs', 'guide.md?raw=1#intro')).toBe('/work/docs/guide.md'))
  it('normalizes same-directory segments', () =>
    expect(resolveSiblingPath('C:\\work\\docs', '.\\guide.md')).toBe('C:\\work\\docs\\guide.md'))
  it('extracts stable structured error codes', () => expect(errorCode({ code: 'save_conflict' })).toBe('save_conflict'))
  it('extracts serialized error codes without exposing text', () => {
    expect(errorCode('{"code":"not_found","detail":"secret"}')).toBe('not_found')
    expect(errorCode('arbitrary platform error')).toBeNull()
  })
})

describe('external application discovery', () => {
  it('keeps all supported AI handoff targets available in browser mode', async () => {
    const applications = await discoverApplications()
    expect(
      applications.filter((application) => application.kind === 'llm' && application.available).map((application) => application.id),
    ).toEqual(['codex', 'claude', 'chatgpt'])
  })
})
