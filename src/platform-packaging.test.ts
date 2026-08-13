import { describe, expect, it } from "vitest";

import windowsWixFragment from "../platform/windows/installer/TextMarkPreview.wxs?raw";
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
});
