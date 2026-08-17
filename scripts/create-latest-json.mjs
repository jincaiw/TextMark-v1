#!/usr/bin/env node
/**
 * Generates the signed updater manifest (latest.json) from a directory of
 * release assets, mirroring the format tauri-action produced. The publish
 * job runs this on the downloaded draft assets before the inventory check,
 * so releases no longer depend on tauri-action's release management.
 *
 * Usage: node scripts/create-latest-json.mjs <assets-dir> <release-tag>
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [directory, rawTag] = process.argv.slice(2)
if (!directory || !rawTag) {
  console.error('Usage: node scripts/create-latest-json.mjs <assets-dir> <release-tag>')
  process.exit(2)
}
const version = rawTag.replace(/^v/, '')
const root = resolve(directory)
const files = readdirSync(root)
  .filter((name) => statSync(resolve(root, name)).isFile())
  .sort()

const find = (pattern) => files.find((name) => pattern.test(name))
const signatureOf = (name) => (files.includes(`${name}.sig`) ? readFileSync(resolve(root, `${name}.sig`), 'utf8').trim() : null)
const urlFor = (name) =>
  `https://github.com/${process.env.GITHUB_REPOSITORY || 'jincaiw/TextMark-v1'}/releases/download/${rawTag}/${encodeURIComponent(name)}`

const asset = (pattern) => {
  const name = find(pattern)
  if (!name) return null
  const signature = signatureOf(name)
  if (!signature) throw new Error(`Missing updater signature for ${name}`)
  return { signature, url: urlFor(name) }
}

const platforms = {}
const put = (key, value) => {
  if (value) platforms[key] = value
}

// macOS universal updater archive serves all four darwin keys.
const macArchive = asset(/^TextMark(?:[_-]\d+\.[_-]?\d+[._-]?\d+)?[_-]universal[.]app[.]tar[.]gz$/i)
for (const key of ['darwin-aarch64', 'darwin-x86_64', 'darwin-aarch64-app', 'darwin-x86_64-app']) put(key, macArchive)

for (const [arch, appImageSuffix, debSuffix, rpmSuffix] of [
  ['x86_64', 'amd64', 'amd64', 'x86_64'],
  ['aarch64', 'aarch64', 'arm64', 'aarch64'],
]) {
  const appImage = asset(new RegExp(`^TextMark[_-]${version}[_-]${appImageSuffix}[.]AppImage$`, 'i'))
  put(`linux-${arch}`, appImage)
  put(`linux-${arch}-appimage`, appImage)
  put(`linux-${arch}-deb`, asset(new RegExp(`^TextMark[_-]${version}[_-]${debSuffix}[.]deb$`, 'i')))
  put(`linux-${arch}-rpm`, asset(new RegExp(`^TextMark-${version}-[^.]+[.]${rpmSuffix}[.]rpm$`, 'i')))
}

for (const arch of ['x86_64', 'aarch64']) {
  const short = arch === 'x86_64' ? 'x64' : 'arm64'
  put(`windows-${arch}`, asset(new RegExp(`^TextMark[_-]${version}[_-]${short}_zh-CN[.]msi$`, 'i')))
  put(`windows-${arch}-msi`, asset(new RegExp(`^TextMark[_-]${version}[_-]${short}_en-US[.]msi$`, 'i')))
  put(`windows-${arch}-nsis`, asset(new RegExp(`^TextMark[_-]${version}[_-]${short}-setup[.]exe$`, 'i')))
}

const manifest = {
  version,
  notes: 'See RELEASE_NOTES.md / 发布说明见 RELEASE_NOTES.md',
  pub_date: new Date().toISOString(),
  platforms,
}
writeFileSync(resolve(root, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Generated latest.json with ${Object.keys(platforms).length} platform entries for ${rawTag}.`)
