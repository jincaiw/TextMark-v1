#!/usr/bin/env node
/**
 * Cross-job mutex for release asset uploads.
 *
 * Concurrent tauri-action jobs uploading to one draft release race on the
 * shared draft (one job's replace/cleanup can delete another job's freshly
 * uploaded assets, and a delete can 404 mid-flight). This script serializes
 * the upload phase: acquire waits until no fresh "release-lock" asset exists
 * and then creates one — the GitHub API rejects a second upload with the same
 * asset name, so only one job can hold the lock at a time. release deletes
 * the lock, best-effort.
 *
 * Implemented with plain fetch + GITHUB_TOKEN so it runs in any job
 * environment (including Linux build containers that have no gh CLI).
 *
 * Usage: node scripts/release-lock.mjs <acquire|release> <release-tag>
 */

const lockName = 'release-lock'
const lockTtlMs = 30 * 60 * 1000
const pollMs = 10_000
const acquireDeadlineMs = 20 * 60 * 1000

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
    body: options.body,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${path}`)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function releaseId(tag) {
  // The REST releases list endpoint does not return this repository's drafts,
  // so resolve through GraphQL (gh release view uses the same path).
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query:
        'query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { releases(first: 50, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { databaseId tagName } } } }',
      variables: { owner: repoName.split('/')[0], name: repoName.split('/')[1] },
    }),
  })
  const payload = await response.json()
  const nodes = payload?.data?.repository?.releases?.nodes ?? []
  const match = nodes.find((release) => release.tagName === tag)
  if (!match) throw new Error(`Cannot resolve release ${tag}`)
  return match.databaseId
}

async function listAssets(tag) {
  const id = await releaseId(tag)
  return api(`/repos/${repoName}/releases/${id}/assets`)
}

async function deleteAsset(id) {
  try {
    await api(`/repos/${repoName}/releases/assets/${id}`, { method: 'DELETE' })
  } catch {
    /* already gone */
  }
}

async function createLock(tag) {
  // Asset uploads go to the uploads.github.com host, not api.github.com.
  const id = await releaseId(tag)
  const response = await fetch(`https://uploads.github.com/repos/${repoName}/releases/${id}/assets?name=${lockName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/octet-stream',
    },
    body: new Date().toISOString(),
  })
  if (!response.ok) {
    if (response.status === 422) throw new Error('LOCK_TAKEN')
    throw new Error(`HTTP ${response.status} ${response.statusText} for asset upload`)
  }
}

async function acquire(tag) {
  const deadline = Date.now() + acquireDeadlineMs
  for (;;) {
    const locks = (await listAssets(tag)).filter((asset) => asset.name === lockName)
    const live = locks.filter((asset) => Date.now() - Date.parse(asset.created_at) < lockTtlMs)
    if (live.length) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for the release upload lock')
      await sleep(pollMs)
      continue
    }
    if (locks.length) await deleteAsset(locks[0].id)
    try {
      await createLock(tag)
      return
    } catch (error) {
      if (error.message !== 'LOCK_TAKEN') throw error
      /* raced with another acquirer; loop again */
    }
  }
}

async function release(tag) {
  for (const asset of await listAssets(tag)) {
    if (asset.name === lockName) await deleteAsset(asset.id)
  }
}

const [action, tag] = process.argv.slice(2)
if (!action || !tag) {
  console.error('Usage: node scripts/release-lock.mjs <acquire|release> <release-tag>')
  process.exit(2)
}
if (action === 'acquire') {
  await acquire(tag)
  console.log('release-lock acquired')
} else if (action === 'release') {
  await release(tag)
  console.log('release-lock released')
} else {
  console.error(`Unknown action: ${action}`)
  process.exit(2)
}
