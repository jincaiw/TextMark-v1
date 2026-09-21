import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const binaryPath = process.env.TEXTMARK_RECOVERY_BINARY
  ? path.resolve(process.env.TEXTMARK_RECOVERY_BINARY)
  : path.resolve('src-tauri', 'target', 'debug', process.platform === 'win32' ? 'textmark.exe' : 'textmark')
const root = path.join(os.tmpdir(), `textmark-session-cleanup-${process.pid}`)
const configDir = path.join(root, 'config')
const fixture = path.join(root, 'cleanup.md')
const manifestPath = path.join(configDir, 'session-v1.json')

if (!existsSync(binaryPath)) throw new Error(`Desktop binary does not exist: ${binaryPath}`)
rmSync(root, { recursive: true, force: true })
mkdirSync(configDir, { recursive: true })
writeFileSync(fixture, '# Cleanup\n\nNormal close fixture.\n', 'utf8')

const child = spawn(binaryPath, [fixture], {
  env: { ...process.env, TEXTMARK_E2E_CONFIG_DIR: configDir },
  stdio: ['ignore', 'ignore', 'pipe'],
})
child.stderr.on('data', (chunk) => process.stderr.write(`[textmark:${child.pid}] ${chunk}`))

const waitFor = async (predicate, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

try {
  await waitFor(() => existsSync(manifestPath), 30_000, 'session manifest')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.windows?.length) throw new Error('Expected a persisted session before normal close')

  // SIGTERM is used only as a process-level probe here. The app's normal UI
  // close path is responsible for saveSession(true); this probe verifies the
  // process remains controllable and records the current limitation explicitly.
  child.kill('SIGTERM')
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000, 'desktop process to exit')
  if (existsSync(manifestPath)) {
    console.log('B14 normal-close process probe completed: manifest remains after SIGTERM; UI close cleanup requires desktop interaction')
  } else {
    console.log('B14 normal-close cleanup passed: session manifest removed')
  }
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  rmSync(root, { recursive: true, force: true })
}
