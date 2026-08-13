import { describe, expect, it } from "vitest";

import windowsWixFragment from "../platform/windows/installer/TextMarkPreview.wxs?raw";
import windowsInstallerTest from "../platform/windows/test-installer.ps1?raw";
import macosPackageTest from "../platform/macos/test-package.sh?raw";
import linuxConfig from "../src-tauri/tauri.linux.conf.json";
import kdeConfig from "../src-tauri/tauri.linux-kde.conf.json";
import macosConfig from "../src-tauri/tauri.macos.conf.json";

describe("Linux package file mappings", () => {
  it.each(["deb", "rpm"] as const)(
    "maps %s package destinations to repository sources",
    (kind) => {
      expect(linuxConfig.bundle.linux[kind].files).toEqual({
        "/usr/share/mime/packages/app.textmark.xml":
          "../platform/linux/app.textmark.xml",
        "/usr/share/thumbnailers/textmark.thumbnailer":
          "../platform/linux/textmark.thumbnailer",
      });
    },
  );

  it("maps the KDE thumbnail plugin destination to its built library", () => {
    expect(kdeConfig.bundle.linux.rpm.files).toEqual({
      "/usr/lib/textmark/platform/kde/textmarkthumbnail.so":
        "../platform/linux/build/package/textmarkthumbnail.so",
    });
  });
});

describe("native desktop package integration", () => {
  it("embeds the macOS Quick Look extension at the app bundle destination", () => {
    expect(macosConfig.bundle.macOS.files).toEqual({
      "PlugIns/TextMarkQuickLook.appex":
        "../platform/macos/build/TextMarkQuickLook.appex",
    });
  });

  it("links the Windows preview handler to Tauri's WiX install directory", () => {
    expect(windowsWixFragment).toContain('<DirectoryRef Id="INSTALLDIR">');
    expect(windowsWixFragment).toContain(
      'Value="[INSTALLDIR]TextMarkPreview\\TextMarkPreviewHandler.dll"',
    );
    expect(windowsWixFragment).toContain('Win64="yes"');
    expect(windowsWixFragment).not.toContain("INSTALLFOLDER");
  });

  it("preserves spaced Windows installer and preview paths as single arguments", () => {
    expect(windowsInstallerTest).toContain(
      "[System.Diagnostics.ProcessStartInfo]::new()",
    );
    expect(windowsInstallerTest).toContain(
      "$startInfo.ArgumentList.Add($argument)",
    );
    expect(windowsInstallerTest).not.toContain(
      "Start-Process -FilePath $FilePath -ArgumentList $Arguments",
    );
  });

  it("waits for the detached NSIS uninstaller to finish registry cleanup", () => {
    expect(windowsInstallerTest).toContain(
      "function Wait-InstallationRemoved",
    );
    expect(windowsInstallerTest).toContain("Start-Sleep -Milliseconds 250");
    expect(windowsInstallerTest).toContain(
      "TextMark installation state was not removed within $TimeoutSeconds seconds",
    );
    expect(windowsInstallerTest).toContain(
      "Test-Path $installedPreviewDll",
    );
    expect(windowsInstallerTest).toContain("Wait-InstallationRemoved");
  });

  it("keeps the macOS CLI smoke thumbnail's PNG extension intact", () => {
    expect(macosPackageTest).toContain(
      'thumbnail="$cli_temp_dir/thumbnail.png"',
    );
    expect(macosPackageTest).not.toContain("textmark-cli.XXXXXX.png");
  });

  it("strictly validates Quick Look metadata while accounting for ad-hoc signing", () => {
    expect(macosConfig.bundle.macOS.signingIdentity).toBe("-");
    expect(macosPackageTest).toContain(
      "NSExtension.NSExtensionPointIdentifier",
    );
    expect(macosPackageTest).toContain("QLSupportedContentTypes");
    expect(macosPackageTest).toContain("Signature=adhoc");
    expect(macosPackageTest).toContain(
      "Developer ID Quick Look extension was not accepted by PlugInKit.",
    );
  });
});
