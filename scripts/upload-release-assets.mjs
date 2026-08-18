#!/usr/bin/env node
/**
 * Uploads a release asset with clobber semantics through the GitHub API.
 *
 * The Linux bundle jobs run inside containers that have no gh CLI, so this
 * script replaces `gh release upload` with plain fetch + GITHUB_TOKEN (the
 * same approach as release-lock.mjs). It resolves the release through
 * GraphQL, deletes any same-name asset, then uploads to uploads.github.com,
 * retrying transient HTTP 5xx/429 responses.
 *
 * Usage: node scripts/upload-release-assets.mjs <release-tag> <file>
 */

import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (!token) {
  console.error('GITHUB_TOKEN is required')
  process.exit(2)
}
const repoName = process.env.GITHUB_REPOSITORY
if (!repoName) {
  console.error('GITHUB_REPOSITORY is required')
  process.exit(2)
}

const [rawTag, file] = process.argv.slice(2)
if (!rawTag || !file) {
  console.error('Usage: node scripts/upload-release-assets.mjs <release-tag> <file>')
  process.exit(2)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url, options) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`)
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`)
    } catch (error) {
      lastError = error
      if (error.message.includes('HTTP 4')) throw error
    }
    await sleep(5_000 * (attempt + 1))
  }
  throw lastError ?? new Error(`Request failed for ${url}`)
}

async function releaseId(tag) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:
            'query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { releases(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { databaseId tagName } } } }',
          variables: { owner: repoName.split('/')[0], name: repoName.split('/')[1] },
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} for GraphQL`)
      const payload = await response.json()
      const match = payload?.data?.repository?.releases?.nodes?.find((release) => release.tagName === tag)
      if (!match) throw new Error(`Cannot resolve release ${tag}`)
      return match.databaseId
    } catch (error) {
      if (error.message.includes('Cannot resolve')) throw error
      await sleep(5_000 * (attempt + 1))
    }
  }
  throw new Error(`Cannot resolve release ${tag}`)
}

async function deleteAssetIfExists(id, name) {
  const response = await fetchWithRetry(`https://api.github.com/repos/${repoName}/releases/${id}/assets`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  const assets = await response.json()
  const existing = (Array.isArray(assets) ? assets : []).find((asset) => asset.name === name)
  if (existing) {
    await fetchWithRetry(`https://api.github.com/repos/${repoName}/releases/assets/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

const name = basename(file)
const size = statSync(file).size
const id = await releaseId(rawTag)
// Clobber semantics: delete any same-name asset, then upload. When the
// delete races a transient API failure, the upload 422s because the old
// asset still exists — retry the whole delete+upload sequence instead of
// failing fast.
for (let attempt = 0; attempt < 4; attempt += 1) {
  await deleteAssetIfExists(id, name)
  const response = await fetchWithRetry(
    `https://uploads.github.com/repos/${repoName}/releases/${id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
      },
      body: readFileSync(file),
    },
  )
  if (response.ok) {
    console.log(`Uploaded ${name}`)
    process.exit(0)
  }
  if (response.status !== 422) throw new Error(`Upload failed: HTTP ${response.status} for ${name}`)
  console.error(`Conflict on ${name}, retrying delete+upload (${attempt + 1}/4)`)
  await sleep(5_000 * (attempt + 1))
}
throw new Error(`Upload failed after conflicts for ${name}`)
