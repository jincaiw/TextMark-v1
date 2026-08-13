param(
  [Parameter(Mandatory = $true)][ValidateSet("msi", "nsis")][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][ValidateSet("x64", "arm64")][string]$Architecture,
  [Parameter(Mandatory = $true)][string]$PreviewSmokeHost
)

$ErrorActionPreference = "Stop"
$previewClsid = "{7D5DF7F4-1BD8-4A2D-9CE8-BE7F554D1A07}"
$previewShellex = "{8895B1C6-B41F-4C1C-A562-0D564250836F}"
$extensions = @(".md", ".markdown", ".mdown", ".mkd", ".mkdn", ".mdwn", ".mdtxt", ".mdtext", ".rmd", ".txt")
$installerPath = (Resolve-Path $Installer).Path
$smokeHostPath = (Resolve-Path $PreviewSmokeHost).Path

function Invoke-CheckedProcess([string]$FilePath, [string[]]$Arguments) {
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  $startInfo.UseShellExecute = $false
  foreach ($argument in $Arguments) {
    [void]$startInfo.ArgumentList.Add($argument)
  }
  $process = [System.Diagnostics.Process]::Start($startInfo)
  if ($null -eq $process) { throw "$FilePath could not be started" }
  try {
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "$FilePath failed with exit code $($process.ExitCode)" }
  } finally {
    $process.Dispose()
  }
}

function Get-InstalledPreviewDll {
  $key = "Registry::HKEY_LOCAL_MACHINE\Software\Classes\CLSID\$previewClsid\InprocServer32"
  if (-not (Test-Path $key)) { throw "Explorer preview CLSID registration is missing" }
  return (Get-Item $key).GetValue("")
}

function Get-PeMachine([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $reader = [System.IO.BinaryReader]::new($stream)
    $stream.Position = 0x3c
    $peOffset = $reader.ReadInt32()
    $stream.Position = $peOffset + 4
    return $reader.ReadUInt16()
  } finally {
    $stream.Dispose()
  }
}

function Assert-Registration {
  $approvedKey = "Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\PreviewHandlers"
  if ((Get-Item $approvedKey).GetValue($previewClsid) -ne "TextMark Markdown Preview Handler") { throw "PreviewHandlers approval registration is missing" }
  $serverKey = "Registry::HKEY_LOCAL_MACHINE\Software\Classes\CLSID\$previewClsid\InprocServer32"
  if ((Get-Item $serverKey).GetValue("ThreadingModel") -ne "Apartment") { throw "Preview handler apartment registration is missing" }
  if ((Get-Item $serverKey).GetValue("ProgID") -ne "TextMark.Markdown") { throw "Preview handler ProgID registration is missing" }
  foreach ($extension in $extensions) {
    $key = "Registry::HKEY_LOCAL_MACHINE\Software\Classes\$extension\shellex\$previewShellex"
    if (-not (Test-Path $key) -or (Get-Item $key).GetValue("") -ne $previewClsid) { throw "Preview registration is missing for $extension" }
  }
}

function Find-TextMarkUninstaller {
  $entries = Get-ChildItem "Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue
  foreach ($entry in $entries) {
    $properties = Get-ItemProperty $entry.PSPath
    if ($properties.DisplayName -like "TextMark*") { return $properties.UninstallString }
  }
  throw "TextMark uninstaller registration was not found"
}

try {
  if ($Kind -eq "msi") {
    Invoke-CheckedProcess "msiexec.exe" @("/i", $installerPath, "/qn", "/norestart")
  } else {
    Invoke-CheckedProcess $installerPath @("/S")
  }

  Assert-Registration
  $previewDll = Get-InstalledPreviewDll
  if (-not (Test-Path $previewDll)) { throw "Installed preview DLL is missing: $previewDll" }
  if (-not (Test-Path (Join-Path (Split-Path $previewDll) "web\preview.html"))) { throw "Shared preview web host is missing" }
  $installRoot = Split-Path (Split-Path $previewDll)
  foreach ($alias in @("tm.cmd", "text-mark.cmd")) {
    $aliasPath = Join-Path $installRoot $alias
    if (-not (Test-Path $aliasPath)) { throw "Installed CLI alias is missing: $aliasPath" }
    if ((Get-Content $aliasPath -Raw) -notmatch "TextMark\.exe") { throw "Installed CLI alias does not target TextMark.exe: $aliasPath" }
  }
  $expectedMachine = if ($Architecture -eq "arm64") { 0xAA64 } else { 0x8664 }
  if ((Get-PeMachine $previewDll) -ne $expectedMachine) { throw "Installed preview DLL architecture does not match $Architecture" }

  $sample = Join-Path $env:TEMP "textmark-installed-preview-$Architecture.md"
  Set-Content -Path $sample -Encoding UTF8 -Value "# TextMark 安装验证`n`nExplorer preview handler smoke test."
  Invoke-CheckedProcess $smokeHostPath @($previewDll, $sample)
  Remove-Item $sample -Force
} finally {
  if ($Kind -eq "msi") {
    Invoke-CheckedProcess "msiexec.exe" @("/x", $installerPath, "/qn", "/norestart")
  } else {
    $uninstall = Find-TextMarkUninstaller
    if ($uninstall -match '^"([^"]+)"') { $uninstallExecutable = $Matches[1] }
    else { $uninstallExecutable = ($uninstall -split "\s+")[0] }
    Invoke-CheckedProcess $uninstallExecutable @("/S")
  }
}

$clsidKey = "Registry::HKEY_LOCAL_MACHINE\Software\Classes\CLSID\$previewClsid"
if (Test-Path $clsidKey) { throw "Explorer preview CLSID was not removed during uninstall" }
foreach ($extension in $extensions) {
  if (Test-Path "Registry::HKEY_LOCAL_MACHINE\Software\Classes\$extension\shellex\$previewShellex") { throw "Preview registration for $extension was not removed" }
}
Write-Host "TextMark $Kind $Architecture install/preview/uninstall smoke passed."
