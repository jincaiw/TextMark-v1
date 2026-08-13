# Platform integration assets

`linux/` contains the Freedesktop desktop action, MIME declaration and thumbnailer contract installed by DEB/RPM packaging. The thumbnailer calls the bundled `textmark --thumbnail` headless mode, so it does not depend on a running WebView. The AppImage deliberately does not install system files.

The Windows Preview Handler and macOS Quick Look extension are separate native targets. They must consume the same sanitized renderer contract and are built only on their native CI runners; this keeps COM/AppKit APIs out of the Tauri process.

TextMark 0.3 ships file associations, the headless Linux thumbnail command, Freedesktop quick-preview action, KDE 6 thumbnail creator, Windows Explorer Preview Handler and macOS Quick Look extension. Every adapter remains guarded by its native host, package registration and uninstall tests; a compiled desktop bundle alone is never treated as integration success.
