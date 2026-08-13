import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const [directory = "release-assets", rawTag = "v0.3.0"] = process.argv.slice(2);
const version = rawTag.replace(/^v/, "");
const root = resolve(directory);
const files = readdirSync(root).sort();
const fail = (message) => { throw new Error(`${message}\nAssets:\n${files.join("\n")}`); };
const findMatch = (label, expressions) => {
  const match = files.find((file) => expressions.some((expression) => expression.test(file)));
  if (!match) fail(`Missing ${label}`);
  return match;
};
const requireSigned = (label, expressions) => {
  const asset = findMatch(label, expressions);
  if (!files.includes(`${asset}.sig`)) fail(`Missing updater signature for ${asset}`);
};

for (const architecture of ["x64", "arm64"]) {
  requireSigned(`Windows ${architecture} MSI`, [new RegExp(`^TextMark[_-]${version}[_-]${architecture}(?:[_-][^.]+)?\\.msi$`, "i")]);
  requireSigned(`Windows ${architecture} NSIS`, [new RegExp(`^TextMark[_-]${version}[_-]${architecture}-setup\\.exe$`, "i")]);
  findMatch(`Windows ${architecture} portable ZIP`, [new RegExp(`^TextMark[_-]${version}[_-]windows_${architecture}_portable\\.zip$`, "i")]);
}

for (const architecture of [
  { label: "x64", appImage: "amd64", deb: "amd64", rpm: "x86_64" },
  { label: "arm64", appImage: "aarch64", deb: "arm64", rpm: "aarch64" },
]) {
  requireSigned(`Linux ${architecture.label} AppImage`, [new RegExp(`^TextMark[_-]${version}[_-]${architecture.appImage}\\.AppImage$`, "i")]);
  requireSigned(`Linux ${architecture.label} DEB`, [new RegExp(`^TextMark[_-]${version}[_-]${architecture.deb}\\.deb$`, "i")]);
  requireSigned(`Linux ${architecture.label} RPM`, [new RegExp(`^TextMark-${version}-[^.]+\\.${architecture.rpm}\\.rpm$`, "i")]);
}

findMatch("macOS Universal DMG", [new RegExp(`^TextMark[_-]${version}[_-]universal\\.dmg$`, "i")]);
requireSigned("macOS Universal updater archive", [new RegExp(`^TextMark[_-]${version}[_-]universal\\.app\\.tar\\.gz$`, "i")]);
findMatch("signed updater metadata", [/^latest\.json$/]);

const metadata = JSON.parse(readFileSync(resolve(root, "latest.json"), "utf8"));
if (metadata.version !== version) fail(`latest.json has version ${metadata.version}, expected ${version}`);
const platforms = Object.keys(metadata.platforms ?? {});
for (const expected of ["darwin-aarch64", "darwin-x86_64", "linux-x86_64", "linux-aarch64", "windows-x86_64", "windows-aarch64"]) {
  if (!platforms.includes(expected)) fail(`latest.json is missing ${expected}`);
}
for (const [platform, item] of Object.entries(metadata.platforms)) {
  if (!item?.url || !item?.signature) fail(`latest.json has an unsigned or empty entry for ${platform}`);
}

console.log(`Verified ${files.length} release assets for ${basename(rawTag)} across six updater platforms.`);
