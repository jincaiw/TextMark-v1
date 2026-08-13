import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [url = "http://127.0.0.1:1420/", output = join(tmpdir(), "textmark-ui.png"), widthText = "1440", heightText = "900", scenario = "preview"] = process.argv.slice(2);
const width = Number(widthText);
const height = Number(heightText);
const chrome = process.env.TEXTMARK_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(chrome)) throw new Error(`Chrome is unavailable: ${chrome}`);

const profile = mkdtempSync(join(tmpdir(), "textmark-chrome-"));
const processHandle = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=0",
  `--window-size=${width},${height}`, `--user-data-dir=${profile}`, url,
], { stdio: ["ignore", "ignore", "pipe"] });
let chromeLog = "";
let chromeExitCode;
processHandle.stderr.on("data", (chunk) => { chromeLog += chunk.toString(); });
processHandle.once("exit", (code) => { chromeExitCode = code; });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
for (let attempt = 0; attempt < 600 && !existsSync(join(profile, "DevToolsActivePort")) && chromeExitCode === undefined; attempt += 1) await delay(50);
if (!existsSync(join(profile, "DevToolsActivePort"))) throw new Error(`Chrome debugging endpoint did not start (exit ${chromeExitCode ?? "still running"}).\n${chromeLog}`);
const [port] = readFileSync(join(profile, "DevToolsActivePort"), "utf8").trim().split("\n");

let page;
for (let attempt = 0; attempt < 50; attempt += 1) {
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  page = targets.find((target) => target.type === "page" && target.url.startsWith(url));
  if (page) break;
  await delay(50);
}
if (!page) throw new Error("Chrome page target was not found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let commandId = 0;
const pending = new Map();
const failures = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") failures.push(message.params.exceptionDetails.text + ": " + (message.params.exceptionDetails.exception?.description ?? ""));
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) failures.push(message.params.args.map((argument) => argument.value ?? argument.description).join(" "));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
let ready = false;
for (let attempt = 0; attempt < 120; attempt += 1) {
  const result = await send("Runtime.evaluate", { expression: "Boolean(document.querySelector('.markdown-body h1'))", returnByValue: true });
  if (result.result.value) { ready = true; break; }
  await delay(50);
}
if (scenario === "edit") {
  await send("Runtime.evaluate", { expression: `(() => {
    const button = document.querySelector('[aria-label="切换编辑模式"], [aria-label="Toggle Edit Mode"]');
    button?.click();
    return Boolean(button);
  })()`, returnByValue: true });
} else if (scenario === "customizer") {
  await send("Runtime.evaluate", { expression: `(() => {
    document.querySelector('.more-menu > summary')?.click();
    const button = [...document.querySelectorAll('.more-menu .menu-popover button')]
      .find((candidate) => /自定工具栏|Customize Toolbar/.test(candidate.textContent ?? ''));
    button?.click();
    return Boolean(button);
  })()`, returnByValue: true });
} else if (scenario === "dark") {
  await send("Runtime.evaluate", { expression: `(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
    return true;
  })()`, returnByValue: true });
}
const expectedSelector = scenario === "edit" ? ".editor-pane" : scenario === "customizer" ? '[role="dialog"]' : ".markdown-body h1";
for (let attempt = 0; attempt < 40; attempt += 1) {
  const result = await send("Runtime.evaluate", { expression: `Boolean(document.querySelector(${JSON.stringify(expectedSelector)}))`, returnByValue: true });
  if (result.result.value) break;
  await delay(50);
}
await delay(250);
const state = await send("Runtime.evaluate", { expression: "({title:document.title,html:document.querySelector('.markdown-body')?.innerHTML ?? '',language:document.documentElement.lang,renderer:document.documentElement.dataset.renderer ?? 'unset',theme:document.documentElement.dataset.theme ?? 'unset'})", returnByValue: true });
if (!ready) failures.push("Rendered heading did not become visible within 6 seconds");
if (state.result.value.renderer !== "worker") failures.push(`Expected worker renderer, received ${state.result.value.renderer}`);
const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(screenshot.data, "base64"));

socket.close();
processHandle.kill("SIGTERM");
await Promise.race([new Promise((resolve) => processHandle.once("exit", resolve)), delay(2_000)]);
rmSync(profile, { recursive: true, force: true });

console.log(JSON.stringify({ output, scenario, ready, title: state.result.value.title, language: state.result.value.language, renderer: state.result.value.renderer, theme: state.result.value.theme, htmlBytes: state.result.value.html.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
