# 安装 TextMark / Install TextMark

从 [Releases](https://github.com/jincaiw/TextMark-v1/releases/latest) 下载与操作系统和处理器架构匹配的文件。发布页中的 `SHA256SUMS.txt` 是所有下载文件的校验清单。

## 选择下载包

| 系统 | 推荐下载 | 何时选择其他包 |
| --- | --- | --- |
| Windows x64 | `*_x64_*.msi` | 需要传统安装器时选 NSIS；没有管理员权限或不希望写入系统设置时选 `*_portable.zip`。 |
| Windows on ARM | `*_arm64_*.msi` | 与 x64 相同；请勿在 ARM 设备上下载 x64 安装器。 |
| macOS（Intel 或 Apple 芯片） | `*.dmg` | DMG 是 Universal 版本，同一个文件支持两种 Mac。 |
| Debian / Ubuntu | `*.deb` | 想免安装、随身携带时选 `*.AppImage`。 |
| Fedora / RHEL / openSUSE | `*.rpm` | 想免安装、随身携带时选 `*.AppImage`。 |
| 其他 Linux 发行版 | `*.AppImage` | AppImage 不会安装系统级文件关联或缩略图服务。 |

`MSI`、`NSIS`、`DEB`、`RPM` 和 `DMG` 会安装系统集成：文件关联及相应平台的预览/缩略图功能。Windows 便携版和 AppImage 不会修改系统设置。

## 安装前校验

只从官方 Release 页面下载，并将结果与同一发布页的 `SHA256SUMS.txt` 中对应文件核对。

Windows PowerShell：

```powershell
Get-FileHash .\TextMark_<版本>_<架构>_<安装类型> -Algorithm SHA256
```

macOS：

```sh
shasum -a 256 TextMark_<版本>_universal.dmg
```

Linux：

```sh
sha256sum TextMark_<版本>_<架构>.<deb|rpm|AppImage>
```

## Windows

1. 大多数电脑选择与架构相符的 MSI；安装需要管理员许可，以注册资源管理器预览和文件关联。
2. 双击安装包，按向导完成安装。首次启动后可直接打开 Markdown 文件。
3. 公司设备或无管理员权限时，解压 portable ZIP 后运行 `TextMark.exe`。它不注册文件关联或资源管理器预览。
4. Windows 10/11 需要 Microsoft Edge WebView2 Runtime；通常系统已自带。如应用无法启动，请先安装该运行库。

安装包当前未使用 Windows Authenticode 签名，因此 SmartScreen 可能提示警告。请先完成 SHA-256 校验；无法确认来源时不要继续安装。

## macOS

1. 打开 DMG，并将 TextMark 拖入“应用程序”。
2. 从“应用程序”启动。DMG 内含 Quick Look 扩展；安装后如 Finder 未立刻显示预览，重启 Finder 或重新登录即可刷新扩展注册。
3. “Install CLI…” 位于应用菜单中，可按需安装 `textmark`、`tm` 和 `text-mark` 命令行入口。

当前构建使用 ad-hoc 运行签名，尚未通过 Apple Developer ID 公证。完成 SHA-256 校验后，若 macOS 阻止首次打开，请在“系统设置 → 隐私与安全性”中确认该已验证的应用；无法确认来源时不要放行。

## Linux

Debian / Ubuntu：

```sh
sudo apt install ./TextMark_<版本>_<架构>.deb
```

Fedora / RHEL / openSUSE：

```sh
sudo dnf install ./TextMark_<版本>_<架构>.rpm
```

AppImage：

```sh
chmod +x TextMark_<版本>_<架构>.AppImage
./TextMark_<版本>_<架构>.AppImage
```

DEB/RPM 会提供 `textmark`、`tm`、`text-mark` 命令，并注册 MIME 类型与缩略图；AppImage 保持便携，不执行这些系统集成。部分发行版运行 AppImage 需要 FUSE / `libfuse2`。

## 更新与卸载

在应用的偏好设置中使用“检查更新”或“安装并重启”。更新包有独立签名校验；校验失败时应用会拒绝安装。

- Windows：从“已安装的应用”卸载 TextMark；便携版只需删除解压目录。
- macOS：退出应用后，将 TextMark 从“应用程序”移到废纸篓。
- Linux：使用系统包管理器卸载 DEB/RPM；AppImage 只需删除文件。

---

# Install TextMark

Download the matching asset from [Releases](https://github.com/jincaiw/TextMark-v1/releases/latest) and verify it against `SHA256SUMS.txt` before installing. MSI/NSIS, DEB/RPM, and DMG install platform integration; Windows portable ZIP and AppImage remain self-contained.

Choose MSI for Windows (x64 or ARM64) when administrator access is available, the Universal DMG for any supported Mac, DEB for Debian/Ubuntu, RPM for Fedora/RHEL/openSUSE, and AppImage or the portable ZIP when no installation is wanted. See the Chinese instructions above for the exact verification, installation, update, and uninstall commands.

The current Windows installers are not Authenticode-signed and the macOS build is not Apple-notarized. A SmartScreen or Gatekeeper warning may appear. Only proceed after verifying the SHA-256 checksum and confirming the download came from the official release page.
