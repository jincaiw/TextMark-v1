# Platform integration assets

`linux/` contains the Freedesktop desktop action, MIME declaration and thumbnailer contract installed by DEB/RPM packaging. The AppImage deliberately does not install them.

The Windows Preview Handler and macOS Quick Look extension are separate native targets. They must consume the same sanitized renderer contract and are built only on their native CI runners; this keeps COM/AppKit APIs out of the Tauri process.

The v0.1.0 public beta ships the file associations and Linux quick-preview action. Native Explorer and Quick Look installers are guarded behind their platform signing and native-host test jobs.
