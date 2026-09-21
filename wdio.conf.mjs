import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const binaryName = process.platform === 'win32' ? 'textmark.exe' : 'textmark'
const generatedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e.md')
const movedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e-renamed.md')
const configPath = process.env.TEXTMARK_E2E_CONFIG_DIR || path.join(os.tmpdir(), 'textmark-v030-e2e-config')
const pastedImageDirectory = path.join(os.tmpdir(), 'Pictures', 'textmark-v030-e2e')
const syntaxFixturePath = process.env.TEXTMARK_SYNTAX_FIXTURE
const cleanupFixturePath = process.env.TEXTMARK_SESSION_CLEANUP_FIXTURE
const secondaryFixturePath = process.env.TEXTMARK_SECONDARY_FIXTURE
const layoutGeometrySpec = process.env.TEXTMARK_LAYOUT_GEOMETRY === '1'
const updaterRuntimeSpec = process.env.TEXTMARK_UPDATER_RUNTIME === '1'
const recoveryFixturePaths = process.env.TEXTMARK_SESSION_RECOVERY_FIXTURES?.split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
if (syntaxFixturePath && !existsSync(syntaxFixturePath)) throw new Error(`TEXTMARK_SYNTAX_FIXTURE does not exist: ${syntaxFixturePath}`)
if (cleanupFixturePath && !existsSync(cleanupFixturePath))
  throw new Error(`TEXTMARK_SESSION_CLEANUP_FIXTURE does not exist: ${cleanupFixturePath}`)
if (secondaryFixturePath && !existsSync(secondaryFixturePath))
  throw new Error(`TEXTMARK_SECONDARY_FIXTURE does not exist: ${secondaryFixturePath}`)
for (const recoveryFixturePath of recoveryFixturePaths ?? []) {
  if (!existsSync(recoveryFixturePath)) throw new Error(`TEXTMARK_SESSION_RECOVERY_FIXTURE does not exist: ${recoveryFixturePath}`)
}
const fixturePath = syntaxFixturePath || cleanupFixturePath || secondaryFixturePath || generatedFixturePath
const usesExternalFixture = Boolean(syntaxFixturePath || cleanupFixturePath || secondaryFixturePath || recoveryFixturePaths?.length)
const cleanupSpec = Boolean(cleanupFixturePath)
const secondarySpec = Boolean(secondaryFixturePath)
const recoverySpec = Boolean(recoveryFixturePaths?.length)
const appArgs = recoveryFixturePaths?.length ? [recoveryFixturePaths[0]] : [fixturePath]
if (recoverySpec) process.env.TEXTMARK_SESSION_RECOVERY_SECOND_FIXTURE = recoveryFixturePaths?.[1] ?? ''
rmSync(generatedFixturePath, { force: true })
rmSync(movedFixturePath, { force: true })
rmSync(configPath, { recursive: true, force: true })
rmSync(pastedImageDirectory, { recursive: true, force: true })
mkdirSync(configPath, { recursive: true })
if (recoverySpec || secondarySpec) {
  writeFileSync(
    path.join(configPath, 'settings-v3.json'),
    JSON.stringify({ schemaVersion: 7, openDocumentsInTabs: true, locale: 'zh-CN' }),
    'utf8',
  )
}
if (!usesExternalFixture)
  writeFileSync(
    generatedFixturePath,
    `---
title: Native shell fixture
owner: TextMark QA
---
# E2E Native Document

TextMark exercises the real Tauri filesystem boundary.

- [ ] Verify native task editing

<details>
<summary>Persistent details</summary>
This state must survive incremental preview updates.
</details>

| Item | Status |
| --- | --- |
| Preview | Ready |
| Editor | Ready |
`,
    'utf8',
  )
process.env.TEXTMARK_E2E_CONFIG_DIR = configPath

export const config = {
  runner: 'local',
  framework: 'mocha',
  specs: updaterRuntimeSpec
    ? ['./e2e/updater-runtime.spec.mjs']
    : layoutGeometrySpec
      ? ['./e2e/layout-geometry.spec.mjs']
      : cleanupSpec
        ? ['./e2e/session-cleanup.spec.mjs']
        : secondarySpec
          ? ['./e2e/secondary-session.spec.mjs']
          : recoverySpec
            ? ['./e2e/session-recovery.spec.mjs']
            : syntaxFixturePath
              ? ['./e2e/markdown-syntax.spec.mjs']
              : ['./e2e/shell.spec.mjs'],
  maxInstances: 1,
  logLevel: 'warn',
  logLevels: { 'tauri-service:service': 'error' },
  waitforTimeout: 20_000,
  connectionRetryTimeout: 60_000,
  mochaOpts: { timeout: 90_000 },
  capabilities: [{ browserName: 'tauri' }],
  services: [
    [
      'tauri',
      {
        appBinaryPath: path.resolve('src-tauri', 'target', 'debug', binaryName),
        appArgs,
        env: {
          TEXTMARK_E2E_CONFIG_DIR: configPath,
          ...(secondaryFixturePath ? { TEXTMARK_SECONDARY_FIXTURE: secondaryFixturePath } : {}),
          ...(recoveryFixturePaths?.[0] ? { TEXTMARK_SESSION_RECOVERY_FIRST_FIXTURE: recoveryFixturePaths[0] } : {}),
          ...(recoveryFixturePaths?.[1] ? { TEXTMARK_SESSION_RECOVERY_SECOND_FIXTURE: recoveryFixturePaths[1] } : {}),
        },
        driverProvider: 'embedded',
        embeddedPort: 4445,
        autoInstallTauriDriver: true,
      },
    ],
  ],
  onComplete() {
    if (!usesExternalFixture) rmSync(generatedFixturePath, { force: true })
    rmSync(movedFixturePath, { force: true })
    if (!process.env.TEXTMARK_PRESERVE_E2E_CONFIG) rmSync(configPath, { recursive: true, force: true })
    rmSync(pastedImageDirectory, { recursive: true, force: true })
  },
}
