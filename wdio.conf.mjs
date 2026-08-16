import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const binaryName = process.platform === 'win32' ? 'textmark.exe' : 'textmark'
const fixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e.md')
const movedFixturePath = path.join(os.tmpdir(), 'textmark-v030-e2e-renamed.md')
const configPath = path.join(os.tmpdir(), 'textmark-v030-e2e-config')
rmSync(fixturePath, { force: true })
rmSync(movedFixturePath, { force: true })
rmSync(configPath, { recursive: true, force: true })
mkdirSync(configPath, { recursive: true })
writeFileSync(
  fixturePath,
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
  specs: ['./e2e/**/*.spec.mjs'],
  maxInstances: 1,
  logLevel: 'warn',
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
    rmSync(fixturePath, { force: true })
    rmSync(movedFixturePath, { force: true })
    rmSync(configPath, { recursive: true, force: true })
  },
}
