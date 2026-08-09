import path from "node:path";

const binaryName = process.platform === "win32" ? "textmark.exe" : "textmark";

export const config = {
  runner: "local",
  framework: "mocha",
  specs: ["./e2e/**/*.spec.mjs"],
  maxInstances: 1,
  logLevel: "warn",
  waitforTimeout: 10_000,
  connectionRetryTimeout: 30_000,
  mochaOpts: { timeout: 30_000 },
  capabilities: [{ browserName: "tauri" }],
  services: [["tauri", {
    appBinaryPath: path.resolve("src-tauri", "target", "debug", binaryName),
    driverProvider: "embedded",
    embeddedPort: 4445,
  }]],
};
