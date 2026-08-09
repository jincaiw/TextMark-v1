# Platform integration assets

`linux/` contains the Freedesktop desktop action, MIME declaration and thumbnailer contract installed by DEB/RPM packaging. The thumbnailer calls the bundled `textmark --thumbnail` headless mode, so it does not depend on a running WebView. The AppImage deliberately does not install system files.

The Windows Preview Handler and macOS Quick Look extension are separate native targets. They must consume the same sanitized renderer contract and are built only on their native CI runners; this keeps COM/AppKit APIs out of the Tauri process.

TextMark 0.2 ships file associations, a headless Linux thumbnail command and a Freedesktop quick-preview action. Native Explorer and Quick Look installers remain guarded behind their native-host test jobs and are not claimed as complete merely because the desktop bundle builds.
