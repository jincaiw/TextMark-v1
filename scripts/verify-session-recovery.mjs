import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const binaryName = process.platform === 'win32' ? 'textmark.exe' : 'textmark'
const binaryPath = process.env.TEXTMARK_RECOVERY_BINARY
  ? path.resolve(process.env.TEXTMARK_RECOVERY_BINARY)
  : path.resolve('src-tauri', 'target', 'debug', binaryName)
const root = path.join(os.tmpdir(), `textmark-session-recovery-${process.pid}`)
const configDir = path.join(root, 'config')
const fixtureA = path.join(root, 'recovery-a.md')
const fixtureB = path.join(root, 'recovery-b.md')
const manifestPath = path.join(configDir, 'session-v1.json')
const settingsPath = path.join(configDir, 'settings-v3.json')

if (!existsSync(binaryPath)) throw new Error(`E2E binary does not exist: ${binaryPath}`)
rmSync(root, { recursive: true, force: true })
mkdirSync(configDir, { recursive: true })
writeFileSync(fixtureA, '# Recovery A\n\nSession recovery fixture A.\n', 'utf8')
writeFileSync(fixtureB, '# Recovery B\n\nSession recovery fixture B.\n', 'utf8')
writeFileSync(settingsPath, JSON.stringify({ schemaVersion: 7, openDocumentsInTabs: true, locale: 'zh-CN' }), 'utf8')

// Keep the process-level abnormal-exit probe single-document. Multi-document
// tab behavior is covered by the WebDriver E2E; the startup settings load is
// asynchronous, so explicit multi-path launch is not a stable process probe.

const env = { ...process.env, TEXTMARK_E2E_CONFIG_DIR: configDir }

function start(args) {
  const child = spawn(binaryPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr.on('data', (chunk) => process.stderr.write(`[textmark:${child.pid}] ${chunk}`))
  child.on('exit', (code, signal) => {
    if (code !== null || signal) process.stderr.write(`[textmark:${child.pid}] exited code=${code ?? '-'} signal=${signal ?? '-'}\n`)
  })
  return child
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const observedFiles = []
  if (existsSync(root)) {
    const stack = [root]
    while (stack.length) {
      const current = stack.pop()
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) stack.push(fullPath)
        else observedFiles.push(fullPath)
      }
    }
  }
  throw new Error(`Timed out waiting for ${label}; observed files: ${observedFiles.join(', ')}`)
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

let first = start([fixtureA])
try {
  await waitFor(() => existsSync(manifestPath), 30_000, 'session manifest after initial launch')
  const initial = readManifest()
  const normalizedFixtureA = realpathSync(fixtureA)
  const hasFixtureA = initial.windows?.some((window) => window.documents.some((document) => realpathSync(document) === normalizedFixtureA))
  if (initial.version !== 1 || !hasFixtureA) {
    throw new Error(`Initial session manifest did not contain ${fixtureA}: ${JSON.stringify(initial)}`)
  }

  process.kill(first.pid, 'SIGKILL')
  await waitFor(
    () => {
      try {
        process.kill(first.pid, 0)
        return false
      } catch {
        return true
      }
    },
    10_000,
    'initial TextMark process to exit',
  )
  first = null

  const preserved = readManifest()
  if (!preserved.windows?.length) throw new Error('Session manifest was lost after abnormal termination')

  const second = start([])
  try {
    await waitFor(
      () => {
        try {
          process.kill(second.pid, 0)
          return true
        } catch {
          return false
        }
      },
      10_000,
      'TextMark restart process',
    )
    await waitFor(() => existsSync(manifestPath), 10_000, 'session manifest during restart')
    const restored = readManifest()
    if (!restored.windows?.length) throw new Error('Restart did not retain a restorable session manifest')
    console.log(`B14 abnormal-exit persistence passed: ${restored.windows.length} session window(s) retained`)
  } finally {
    if (second.exitCode === null && second.signalCode === null) second.kill('SIGKILL')
  }
} finally {
  if (first && first.exitCode === null && first.signalCode === null) first.kill('SIGKILL')
  rmSync(root, { recursive: true, force: true })
}
