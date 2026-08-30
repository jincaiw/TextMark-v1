import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const binaryName = process.platform === 'win32' ? 'textmark.exe' : 'textmark'
const generatedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e.md')
const movedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e-renamed.md')
const configPath = path.join(os.tmpdir(), 'textmark-v030-e2e-config')
const pastedImageDirectory = path.join(os.tmpdir(), 'Pictures', 'textmark-v030-e2e')
const syntaxFixturePath = process.env.TEXTMARK_SYNTAX_FIXTURE
if (syntaxFixturePath && !existsSync(syntaxFixturePath)) throw new Error(`TEXTMARK_SYNTAX_FIXTURE does not exist: ${syntaxFixturePath}`)
const fixturePath = syntaxFixturePath || generatedFixturePath
const usesExternalFixture = Boolean(syntaxFixturePath)
rmSync(generatedFixturePath, { force: true })
rmSync(movedFixturePath, { force: true })
rmSync(configPath, { recursive: true, force: true })
rmSync(pastedImageDirectory, { recursive: true, force: true })
mkdirSync(configPath, { recursive: true })
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
  specs: usesExternalFixture ? ['./e2e/markdown-syntax.spec.mjs'] : ['./e2e/shell.spec.mjs'],
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
        appArgs: [fixturePath],
        env: { TEXTMARK_E2E_CONFIG_DIR: configPath },
        driverProvider: 'embedded',
        embeddedPort: 4445,
      },
    ],
  ],
  onComplete() {
    if (!usesExternalFixture) rmSync(generatedFixturePath, { force: true })
    rmSync(movedFixturePath, { force: true })
    rmSync(configPath, { recursive: true, force: true })
    rmSync(pastedImageDirectory, { recursive: true, force: true })
  },
}
