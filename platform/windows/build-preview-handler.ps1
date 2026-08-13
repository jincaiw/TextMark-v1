param(
  [ValidateSet("x64", "arm64")][string]$Architecture = "x64"
)
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoDir = Resolve-Path (Join-Path $scriptDir "../..")
$sourceDir = Join-Path $scriptDir "preview-handler"
$buildDir = Join-Path $scriptDir "build/$Architecture"
$packageDir = Join-Path $scriptDir "build/package"
$packagesDir = Join-Path $scriptDir ".packages"
$webViewVersion = "1.0.4078.44"

npm --prefix $repoDir run build
New-Item -ItemType Directory -Force -Path $packagesDir | Out-Null
if (-not (Get-Command nuget -ErrorAction SilentlyContinue)) { throw "nuget.exe is required" }
nuget install Microsoft.Web.WebView2 -Version $webViewVersion -OutputDirectory $packagesDir -ExcludeVersion -NonInteractive
$webViewRoot = Join-Path $packagesDir "Microsoft.Web.WebView2"
$generatorArchitecture = if ($Architecture -eq "arm64") { "ARM64" } else { "x64" }
cmake -S $sourceDir -B $buildDir -A $generatorArchitecture -DWEBVIEW2_ROOT="$webViewRoot" -DTEXTMARK_WEB_DIST="$repoDir/dist"
cmake --build $buildDir --config Release --parallel
ctest --test-dir $buildDir -C Release --output-on-failure

if (Test-Path $packageDir) { Remove-Item -Recurse -Force $packageDir }
New-Item -ItemType Directory -Force -Path (Join-Path $packageDir "web") | Out-Null
Copy-Item (Join-Path $buildDir "Release/TextMarkPreviewHandler.dll") $packageDir
Copy-Item (Join-Path $repoDir "dist/*") (Join-Path $packageDir "web") -Recurse -Force
$sample = Join-Path $packageDir "preview-smoke.md"
Set-Content -Path $sample -Encoding UTF8 -Value "# TextMark Explorer Preview`n`nWindows $Architecture native host smoke test."
& (Join-Path $buildDir "Release/TextMarkPreviewHostSmoke.exe") (Join-Path $packageDir "TextMarkPreviewHandler.dll") $sample
if ($LASTEXITCODE -ne 0) { throw "Native Explorer preview host smoke failed" }
Remove-Item $sample
