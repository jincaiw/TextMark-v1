use atomic_write_file::AtomicWriteFile;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use font8x8::UnicodeFonts;
use image::{ImageBuffer, ImageFormat, Rgb};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher, event::ModifyKind};
use percent_encoding::{NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::{
    fs::{self, OpenOptions},
    io::{Cursor, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        LazyLock, Mutex, OnceLock,
        atomic::{AtomicU64, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
    menu::{CheckMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};
use tauri_plugin_updater::{Error as UpdaterError, UpdaterExt};

const MARKDOWN_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mdx", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "rmd", "txt",
];
const ASSET_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"];
const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;
static TEMP_EXPORT_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static PASTED_IMAGE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn run_cli_mode() -> bool {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.first().map(String::as_str) != Some("--thumbnail") {
        return false;
    }
    if args.len() < 3 {
        return true;
    }
    let input = percent_decode_str(args[1].strip_prefix("file://").unwrap_or(&args[1]))
        .decode_utf8_lossy()
        .to_string();
    let size = args
        .get(3)
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(512)
        .clamp(128, 1024);
    let _ = render_thumbnail(Path::new(&input), Path::new(&args[2]), size);
    true
}

fn render_thumbnail(input: &Path, output: &Path, size: u32) -> std::io::Result<()> {
    const MAX_THUMBNAIL_SOURCE_BYTES: u64 = 32 * 1024 * 1024;
    if fs::metadata(input)?.len() > MAX_THUMBNAIL_SOURCE_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "thumbnail source exceeds 32 MiB",
        ));
    }
    let source = fs::read_to_string(input)?;
    let mut image = ImageBuffer::from_pixel(size, size, Rgb([255u8, 255, 255]));
    let accent_height = (size / 48).max(5);
    for y in 0..accent_height {
        for x in 0..size {
            image.put_pixel(x, y, Rgb([244, 103, 34]));
        }
    }
    let scale = (size / 256).max(1);
    let glyph = 8 * scale;
    let margin = 16 * scale;
    let max_columns = ((size.saturating_sub(margin * 2)) / glyph).max(1) as usize;
    let max_lines =
        ((size.saturating_sub(margin * 2 + accent_height)) / (glyph + 4 * scale)).max(1) as usize;
    let mut visible = Vec::new();
    for line in source.lines() {
        let cleaned = line
            .trim()
            .trim_start_matches(['#', '>', '-', '*', '+', '`', '|'])
            .trim();
        if cleaned.is_empty() {
            continue;
        }
        visible.push(
            cleaned
                .chars()
                .filter(|character| !character.is_control())
                .take(max_columns)
                .collect::<String>(),
        );
        if visible.len() >= max_lines {
            break;
        }
    }
    for (line_index, line) in visible.iter().enumerate() {
        let y = margin + accent_height + line_index as u32 * (glyph + 4 * scale);
        for (column, character) in line.chars().enumerate() {
            let Some(bitmap) = font8x8::BASIC_FONTS.get(character) else {
                continue;
            };
            let x = margin + column as u32 * glyph;
            for (row, bits) in bitmap.iter().enumerate() {
                for bit in 0..8u32 {
                    if bits & (1 << bit) == 0 {
                        continue;
                    }
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let px = x + bit * scale + dx;
                            let py = y + row as u32 * scale + dy;
                            if px < size && py < size {
                                image.put_pixel(px, py, Rgb([45, 46, 50]));
                            }
                        }
                    }
                }
            }
        }
    }
    image.save(output).map_err(std::io::Error::other)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextDocument {
    path: String,
    name: String,
    contents: String,
    created_ms: Option<u128>,
    modified_ms: Option<u128>,
    size_bytes: u64,
    revision: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedPastedImage {
    relative_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RenamedPastedImage {
    relative_path: String,
    document: TextDocument,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileNode {
    name: String,
    path: String,
    is_directory: bool,
    children: Vec<FileNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalApplication {
    id: String,
    name: String,
    kind: &'static str,
    available: bool,
    /// macOS app bundle path (or historic bundle name) used to load the app's
    /// real Finder icon; None on other platforms or for the system target.
    mac_app: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IntegrationResult {
    ok: bool,
    detail: Option<String>,
}

#[derive(Clone, Copy, Default)]
struct MenuUiState {
    appearance: &'static str,    // "system" | "light" | "dark"
    content_width: &'static str, // "normal" | "full"
    sidebar_mode: &'static str,  // "outline" | "files"
    sidebar_visible: bool,
    toolbar_hidden: bool,
    always_on_top: bool,
    /// The reference hides its tab strip from View ▸ Hide Tab Bar; the label
    /// flips once the strip is hidden.
    tabs_hidden: bool,
    /// Number of open documents in the focused window. AppKit reveals its
    /// alternate "Close All" item only while Option is held; because muda has
    /// no alternate-item support, TextMark shows the command once a window
    /// actually has more than one document.
    // The reference always shows Close All, so the count no longer gates the
    // item; the field stays because the frontend still reports it.
    #[allow(dead_code)]
    session_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
// The menu builder reads these fields only on macOS; other targets parse them
// to keep the command payload identical.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct MenuRefreshRequest {
    locale: String,
    appearance: String,
    content_width: String,
    sidebar_mode: String,
    sidebar_visible: bool,
    toolbar_visible: bool,
    always_on_top: bool,
    #[serde(default)]
    tabs_hidden: bool,
    // The reference always shows Close All, so the count no longer gates the
    // item; the field stays because the frontend still reports it.
    #[allow(dead_code)]
    session_count: usize,
    /// True while the document is being edited rather than previewed.
    #[serde(default)]
    editable: bool,
    /// True when the document differs from what is on disk.
    #[serde(default)]
    dirty: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCheck {
    version: String,
    date: Option<String>,
    notes: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDownloadProgress {
    channel: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    progress: Option<u8>,
    finished: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct OpenPathRequest {
    path: String,
    is_directory: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupRequest {
    paths: Vec<OpenPathRequest>,
    new_window: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskChangeEvent {
    kind: &'static str,
    paths: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppError {
    code: &'static str,
    // Details are intentionally omitted: the frontend localizes stable error
    // codes and never leaks an operating-system path or error message.
}

type AppResult<T> = Result<T, AppError>;

#[derive(Default)]
struct WatchState(Mutex<HashMap<String, RecommendedWatcher>>);

#[derive(Default)]
struct PendingOpenPaths(Mutex<Vec<OpenPathRequest>>);

fn enqueue_pending_open_paths(
    state: &PendingOpenPaths,
    paths: impl IntoIterator<Item = OpenPathRequest>,
) {
    if let Ok(mut pending) = state.0.lock() {
        for path in paths {
            if !pending.contains(&path) {
                pending.push(path);
            }
        }
    }
}

/// Directory that holds `settings-v3.json`, `session-v1.json` and
/// `recent.json`.
///
/// macOS has historically shared this directory with the QuickLook extension
/// through an App Group container. A group container is only accessible to
/// processes macOS recognises as belonging to that group, and a locally built
/// (ad-hoc or development-signed) bundle is not: opening a file inside it
/// fails with `EPERM`. The same bundle launched directly instead of through
/// LaunchServices keeps access, which is why this only shows up in a normal
/// double-click launch. Probing once per process and falling back keeps
/// settings, session restore and recents working in every launch context.
fn data_directory() -> AppResult<PathBuf> {
    static RESOLVED: OnceLock<PathBuf> = OnceLock::new();
    if let Some(directory) = RESOLVED.get() {
        return Ok(directory.clone());
    }
    // The isolated directory is an explicit test/diagnostic override. Keeping
    // it available in the normal debug binary lets recovery tests exercise the
    // real desktop process without touching the user's Group Container.
    if let Some(directory) = std::env::var_os("TEXTMARK_E2E_CONFIG_DIR").map(PathBuf::from) {
        fs::create_dir_all(&directory).map_err(io_error)?;
        let _ = RESOLVED.set(directory.clone());
        return Ok(directory);
    }
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or(AppError {
            code: "invalid_path",
        })?;
        let shared = home.join("Library/Group Containers/group.app.textmark.desktop");
        let directory = if is_writable_directory(&shared) {
            shared
        } else {
            let fallback = home.join("Library/Application Support/TextMark");
            fs::create_dir_all(&fallback).map_err(io_error)?;
            migrate_legacy_data(&shared, &fallback);
            fallback
        };
        let _ = RESOLVED.set(directory.clone());
        Ok(directory)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let directory = dirs::config_dir()
            .map(|root| root.join("TextMark"))
            .ok_or(AppError {
                code: "invalid_path",
            })?;
        fs::create_dir_all(&directory).map_err(io_error)?;
        let _ = RESOLVED.set(directory.clone());
        Ok(directory)
    }
}

/// True when the process can actually create and remove a file in
/// `directory`, which is what every settings and session write needs.
// Only `data_directory`'s macOS branch and the tests call this.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn is_writable_directory(directory: &Path) -> bool {
    if fs::create_dir_all(directory).is_err() {
        return false;
    }
    let probe = directory.join(".textmark-write-probe");
    if fs::write(&probe, b"1").is_err() {
        return false;
    }
    let _ = fs::remove_file(&probe);
    true
}

/// Copies anything the previous data directory still holds into the new one
/// without overwriting newer values. Used only when the App Group container is
/// not accessible, so failures are expected and ignored.
// Only `data_directory`'s macOS branch and the tests call this.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn migrate_legacy_data(from: &Path, to: &Path) {
    for name in ["settings-v3.json", "session-v1.json", "recent.json"] {
        let target = to.join(name);
        if target.exists() {
            continue;
        }
        let _ = fs::copy(from.join(name), target);
    }
}

fn settings_path() -> AppResult<PathBuf> {
    Ok(data_directory()?.join("settings-v3.json"))
}

fn app_data_file(name: &str) -> AppResult<PathBuf> {
    Ok(data_directory()?.join(name))
}

fn recent_files_path() -> AppResult<PathBuf> {
    app_data_file("recent.json")
}

fn session_manifest_path() -> AppResult<PathBuf> {
    app_data_file("session-v1.json")
}

/// In-memory cache of the recent files list. Startup (`setup`) must not do
/// blocking I/O on the main thread: the Group Container backing store can
/// block for tens of seconds while macOS (re)provisions it, which previously
/// stalled `applicationDidFinishLaunching` and kept the main window from
/// appearing. The cache is warmed on a background thread and the menu is
/// rebuilt once it is ready.
static RECENT_FILES_CACHE: LazyLock<Mutex<Option<Vec<String>>>> =
    LazyLock::new(|| Mutex::new(None));

fn read_recent_files_from_disk() -> Vec<String> {
    let Ok(path) = recent_files_path() else {
        return Vec::new();
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<String>>(&contents).unwrap_or_default()
}

fn recent_cache() -> std::sync::MutexGuard<'static, Option<Vec<String>>> {
    RECENT_FILES_CACHE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn load_recent_files() -> Vec<String> {
    if let Some(files) = recent_cache().as_ref() {
        return files.clone();
    }
    let files = read_recent_files_from_disk();
    let mut cache = recent_cache();
    if cache.is_none() {
        *cache = Some(files.clone());
    }
    files
}

fn update_recent_cache(files: Vec<String>) {
    *recent_cache() = Some(files);
}

fn save_recent_files(files: &[String]) -> AppResult<()> {
    let path = recent_files_path()?;
    let contents = serde_json::to_vec_pretty(files).map_err(io_error)?;
    fs::write(path, contents).map_err(io_error)
}

#[tauri::command]
fn record_recent_file(path: String) -> AppResult<()> {
    let mut files = load_recent_files();
    files.retain(|existing| existing != &path);
    files.insert(0, path);
    files.truncate(15);
    save_recent_files(&files)?;
    update_recent_cache(files);
    Ok(())
}

#[tauri::command]
fn clear_recent_files() -> AppResult<()> {
    save_recent_files(&[])?;
    update_recent_cache(Vec::new());
    Ok(())
}

/// Recent-document paths for UI surfaces such as the file search palette,
/// mirroring the upstream palette's merge of app-wide recents.
#[tauri::command]
fn list_recent_files() -> Vec<String> {
    load_recent_files()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionWindowGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    #[serde(default)]
    monitor: Option<SessionMonitorSnapshot>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionMonitorSnapshot {
    name: Option<String>,
    position: SessionPoint,
    work_area: SessionWorkArea,
    scale_factor: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct SessionPoint {
    x: i32,
    y: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct SessionWorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionWindowSnapshot {
    window_id: String,
    documents: Vec<String>,
    active_index: usize,
    workspace_path: Option<String>,
    #[serde(default)]
    geometry: Option<SessionWindowGeometry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionManifest {
    version: u8,
    updated_at: u64,
    windows: Vec<SessionWindowSnapshot>,
}

fn empty_session_manifest() -> SessionManifest {
    SessionManifest {
        version: 1,
        updated_at: 0,
        windows: Vec::new(),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
fn load_session_manifest() -> AppResult<Option<SessionManifest>> {
    let path = session_manifest_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(path).map_err(io_error)?;
    let manifest = serde_json::from_str::<SessionManifest>(&contents).map_err(io_error)?;
    if manifest.version != 1 {
        return Ok(None);
    }
    Ok(Some(manifest))
}

fn remove_session_window_from_manifest(window_id: &str) -> AppResult<()> {
    let path = session_manifest_path()?;
    let Some(manifest) = load_session_manifest()? else {
        return Ok(());
    };
    let manifest = remove_window_from_manifest(manifest, window_id);
    let contents = serde_json::to_vec_pretty(&manifest).map_err(io_error)?;
    let mut file = AtomicWriteFile::open(&path).map_err(io_error)?;
    file.write_all(&contents).map_err(io_error)?;
    file.commit().map_err(io_error)?;
    Ok(())
}

#[tauri::command]
fn remove_session_window(window_id: String) -> AppResult<()> {
    remove_session_window_from_manifest(&window_id)
}

#[tauri::command]
fn remove_current_window_session(window: tauri::WebviewWindow) -> AppResult<()> {
    remove_session_window_from_manifest(window.label())
}

fn remove_window_from_manifest(mut manifest: SessionManifest, window_id: &str) -> SessionManifest {
    manifest
        .windows
        .retain(|window| window.window_id != window_id);
    manifest
}

fn normalize_session_snapshot(
    mut snapshot: SessionWindowSnapshot,
) -> Option<SessionWindowSnapshot> {
    let mut documents = Vec::new();
    for document in snapshot.documents {
        if !documents.contains(&document) {
            documents.push(document);
        }
    }
    if documents.is_empty() {
        return None;
    }
    snapshot.active_index = snapshot.active_index.min(documents.len() - 1);
    snapshot.documents = documents;
    Some(snapshot)
}

#[tauri::command]
fn save_session_snapshot(snapshot: SessionWindowSnapshot) -> AppResult<()> {
    let path = session_manifest_path()?;
    let mut manifest = load_session_manifest()?.unwrap_or_else(empty_session_manifest);
    manifest.updated_at = now_ms();
    manifest
        .windows
        .retain(|window| window.window_id != snapshot.window_id);
    if let Some(snapshot) = normalize_session_snapshot(snapshot) {
        manifest.windows.push(snapshot);
    }
    let contents = serde_json::to_vec_pretty(&manifest).map_err(io_error)?;
    let mut file = AtomicWriteFile::open(&path).map_err(io_error)?;
    file.write_all(&contents).map_err(io_error)?;
    file.commit().map_err(io_error)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(io_error)?;
    }
    Ok(())
}

#[tauri::command]
fn load_settings() -> AppResult<Option<serde_json::Value>> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(path).map_err(io_error)?;
    serde_json::from_str(&contents).map(Some).map_err(io_error)
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> AppResult<()> {
    let path = settings_path()?;
    let contents = serde_json::to_vec_pretty(&settings).map_err(io_error)?;
    let mut file = AtomicWriteFile::open(&path).map_err(io_error)?;
    file.write_all(&contents).map_err(io_error)?;
    file.commit().map_err(io_error)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(io_error)?;
    }
    Ok(())
}

#[tauri::command]
fn watch_paths(
    window: tauri::WebviewWindow,
    state: State<'_, WatchState>,
    paths: Vec<String>,
) -> AppResult<()> {
    let handle = window.clone();
    let event_handle = handle.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        if let Ok(event) = result {
            let kind = match event.kind {
                EventKind::Create(_) => "create",
                EventKind::Modify(ModifyKind::Name(_)) => "rename",
                EventKind::Modify(_) => "modify",
                EventKind::Remove(_) => "remove",
                _ => "other",
            };
            let paths = event
                .paths
                .into_iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect::<Vec<_>>();
            if !paths.is_empty() {
                let _ = event_handle.emit("disk-change", DiskChangeEvent { kind, paths });
            }
        }
    })
    .map_err(io_error)?;
    for raw in paths {
        let path = PathBuf::from(raw);
        if path.is_dir() {
            watcher
                .watch(&path, RecursiveMode::Recursive)
                .map_err(io_error)?;
        } else if let Some(parent) = path.parent() {
            // Atomic saves replace the document inode, so watching the file
            // itself stops receiving events after the first replacement. Watch
            // the containing directory and let the frontend filter events by
            // the active document/workspace path instead.
            watcher
                .watch(parent, RecursiveMode::NonRecursive)
                .map_err(io_error)?;
        }
    }
    let label = window.label().to_string();
    state.0.lock().map_err(io_error)?.insert(label, watcher);
    Ok(())
}

#[cfg(target_os = "macos")]
fn known_application_name(application_id: &str) -> Option<&'static str> {
    match application_id {
        "vscode" => Some("Visual Studio Code"),
        "vscode-insiders" => Some("Visual Studio Code - Insiders"),
        "vscodium" => Some("VSCodium"),
        "cursor" => Some("Cursor"),
        "windsurf" => Some("Windsurf"),
        "trae" => Some("Trae"),
        "zed" => Some("Zed"),
        "fleet" => Some("Fleet"),
        "intellij" => Some("IntelliJ IDEA"),
        "sublime" => Some("Sublime Text"),
        "obsidian" => Some("Obsidian"),
        "typora" => Some("Typora"),
        "markedit" => Some("MarkEdit"),
        "mellow" => Some("Mellow"),
        "taio" => Some("Taio"),
        "marktext" => Some("MarkText"),
        "macdown" => Some("MacDown"),
        "bbedit" => Some("BBEdit"),
        "nova" => Some("Nova"),
        "coteditor" => Some("CotEditor"),
        "textmate" => Some("TextMate"),
        "macvim" => Some("MacVim"),
        "xcode" => Some("Xcode"),
        "textedit" => Some("TextEdit"),
        "emacs" => Some("Emacs"),
        _ => None,
    }
}

fn spawn_known_application(path: &str, application_id: &str) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    let mut command = {
        if application_id == "system" {
            let mut command = Command::new("open");
            command.args(["-t", path]);
            return command.spawn().map(|_| ()).map_err(io_error);
        }
        let mut command = Command::new("open");
        match known_application_name(application_id) {
            // Curated targets launch by application name so renamed bundles
            // still resolve through Launch Services' own lookup.
            Some(name) => {
                command.args(["-a", name]).arg(path);
            }
            // Dynamic Open With entries carry the bundle identifier, which is
            // the only stable handle for an app discovered at runtime. Anything
            // else is not a target this build knows how to launch.
            None if application_id.contains('.') => {
                command.args(["-b", application_id]).arg(path);
            }
            None => return Err(AppError { code: "invalid_path" }),
        }
        command
    };
    #[cfg(not(target_os = "macos"))]
    let mut command = {
        let executable = match application_id {
            "vscode" => "code",
            "cursor" => "cursor",
            "windsurf" => "windsurf",
            "trae" => "trae",
            "zed" => "zed",
            "sublime" => {
                if cfg!(windows) {
                    "subl.exe"
                } else {
                    "subl"
                }
            }
            "notepadpp" if cfg!(windows) => "notepad++.exe",
            "obsidian" => "obsidian",
            "typora" => "typora",
            _ => {
                return Err(AppError {
                    code: "invalid_path",
                });
            }
        };
        let mut command = Command::new(executable);
        command.arg(path);
        command
    };
    command.spawn().map(|_| ()).map_err(io_error)
}

#[tauri::command]
fn open_external_application(path: String, application_id: String) -> AppResult<()> {
    let canonical = PathBuf::from(&path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !canonical.is_file() || !is_markdown(&canonical) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    spawn_known_application(&canonical.to_string_lossy(), &application_id)
}

#[tauri::command]
fn show_in_file_manager(path: String) -> AppResult<()> {
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut value = Command::new("open");
        value.arg("-R").arg(&canonical);
        value
    };
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut value = Command::new("explorer.exe");
        value.arg(format!("/select,{}", canonical.display()));
        value
    };
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut value = Command::new("xdg-open");
        value.arg(canonical.parent().unwrap_or(&canonical));
        value
    };
    command.spawn().map(|_| ()).map_err(io_error)
}

fn build_document_window(
    app: &tauri::AppHandle,
    path: String,
    label_prefix: &str,
    restore_window_id: Option<&str>,
) -> AppResult<()> {
    let request = resolve_open_path(path)?;
    let canonical = PathBuf::from(&request.path);
    let is_directory = request.is_directory;
    let label = format!(
        "{label_prefix}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let encoded = utf8_percent_encode(&canonical.to_string_lossy(), NON_ALPHANUMERIC).to_string();
    let query = if is_directory { "folder" } else { "open" };
    let mut url = format!("index.html?{query}={encoded}");
    if let Some(window_id) = restore_window_id {
        let encoded_window_id = utf8_percent_encode(window_id, NON_ALPHANUMERIC).to_string();
        url.push_str("&restoreWindowId=");
        url.push_str(&encoded_window_id);
    }
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title(canonical.file_name().unwrap_or_default().to_string_lossy())
        .inner_size(1100.0, 720.0)
        .min_inner_size(720.0, 480.0)
        .center()
        .resizable(true)
        .build()
        .map_err(io_error)?;
    style_macos_document_window(&window);
    Ok(())
}

#[tauri::command]
fn open_document_window(app: tauri::AppHandle, path: String) -> AppResult<()> {
    build_document_window(&app, path, "document", None)
}

#[tauri::command]
fn open_session_window(app: tauri::AppHandle, snapshot: SessionWindowSnapshot) -> AppResult<()> {
    let SessionWindowSnapshot {
        window_id,
        documents,
        ..
    } = snapshot;
    let path = documents
        .into_iter()
        .next()
        .ok_or(AppError { code: "not_found" })?;
    build_document_window(&app, path, "restored", Some(&window_id))
}

#[tauri::command]
fn resolve_open_path(path: String) -> AppResult<OpenPathRequest> {
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    let is_directory = canonical.is_dir();
    if !is_directory && (!canonical.is_file() || !is_markdown(&canonical)) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    Ok(OpenPathRequest {
        path: canonical.to_string_lossy().to_string(),
        is_directory,
    })
}

fn build_menu(
    app: &tauri::AppHandle,
    locale: &str,
    state: &MenuUiState,
    recent_files: &[String],
) -> tauri::Result<Menu<tauri::Wry>> {
    let zh = locale == "zh-CN";
    let item = |id: &str, zh_text: &str, en_text: &str, accelerator: Option<&str>| {
        let mut builder = MenuItemBuilder::with_id(id, if zh { zh_text } else { en_text });
        if let Some(value) = accelerator {
            builder = builder.accelerator(value);
        }
        builder.build(app)
    };
    // State toggles use a native check menu item: AppKit then draws the mark in
    // the standard gutter and VoiceOver/AX reports it as the item's mark char,
    // exactly like the reference, instead of a "✓ " text prefix.
    let state_item =
        |id: &str, checked: bool, zh_text: &str, en_text: &str, accelerator: Option<&str>| {
            let mut builder = CheckMenuItemBuilder::with_id(id, if zh { zh_text } else { en_text })
                .checked(checked);
            if let Some(value) = accelerator {
                builder = builder.accelerator(value);
            }
            builder.build(app)
        };
    // ⌃⌘ chords exist only on macOS (on Windows/Linux there is a single Ctrl key).
    let sidebar_pane_accel = |key: &str| -> Option<&str> {
        if cfg!(target_os = "macos") {
            match key {
                "1" => Some("CmdOrCtrl+Control+1"),
                "2" => Some("CmdOrCtrl+Control+2"),
                _ => Some("CmdOrCtrl+Control+3"),
            }
        } else {
            None
        }
    };

    // File menu
    // Upstream's New Tab opens a document chooser. TextMark retains a separate
    // explicit empty-document action for authors who need a scratch buffer.
    let new_document = item("new-document", "新建", "New", Some("CmdOrCtrl+N"))?;
    let new_tab = item("new-tab", "新建标签页", "New Tab", Some("CmdOrCtrl+T"))?;
    let close_tab = item("close-tab", "关闭", "Close", Some("CmdOrCtrl+W"))?;
    let close_all = item(
        "close-all",
        "全部关闭",
        "Close All",
        Some("CmdOrCtrl+Alt+W"),
    )?;
    let open = item("open", "打开…", "Open…", Some("CmdOrCtrl+O"))?;
    let search_documents = item(
        "search-documents",
        "搜索文稿…",
        "Search Documents…",
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let save = item("save", "存储…", "Save…", Some("CmdOrCtrl+S"))?;
    let save_as = item("save-as", "存储为…", "Save As…", Some("CmdOrCtrl+Shift+S"))?;
    let revert = item(
        "revert",
        "复原到已存储的版本",
        "Revert to Saved",
        Some("CmdOrCtrl+R"),
    )?;
    let export = item("export", "导出…", "Export…", None)?;
    let export_pdf = item("export-pdf", "导出为 PDF…", "Export as PDF…", None)?;
    let share_link = item("share-link", "以链接形式共享…", "Share as Link…", None)?;
    // AppKit fills this submenu from the system's sharing services; with no
    // shareable selection it holds a single disabled placeholder, which is the
    // state the reference shows as well.
    let share_none = MenuItemBuilder::with_id(
        "share-none",
        if zh { "无文稿" } else { "No Document" },
    )
    .enabled(false)
    .build(app)?;
    let share = SubmenuBuilder::new(app, if zh { "共享" } else { "Share" })
        .item(&share_none)
        .build()?;
    let print = item("print", "打印…", "Print…", Some("CmdOrCtrl+P"))?;

    // Open Recent submenu (dynamic; rebuilt by refresh_menu)
    let mut recent_builder = SubmenuBuilder::new(
        app,
        if zh {
            "打开最近使用"
        } else {
            "Open Recent"
        },
    );
    for (index, path) in recent_files.iter().enumerate() {
        // The reference's Open Recent lists file names, not the paths it stores.
        let label = std::path::Path::new(path)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone());
        let recent_item =
            MenuItemBuilder::with_id(format!("recent-{index}"), label).build(app)?;
        recent_builder = recent_builder.item(&recent_item);
    }
    if !recent_files.is_empty() {
        recent_builder = recent_builder.separator();
    }
    let clear_recent =
        MenuItemBuilder::with_id("clear-recent", if zh { "清除菜单" } else { "Clear Menu" })
            .build(app)?;
    let open_recent = recent_builder.item(&clear_recent).build()?;

    let file_builder = SubmenuBuilder::new(app, if zh { "文件" } else { "File" })
        .items(&[&new_document, &new_tab])
        .items(&[&open, &search_documents])
        .item(&open_recent)
        .separator()
        .item(&close_tab)
        .item(&close_all);
    let file_builder = file_builder
        .items(&[&save, &save_as, &revert])
        .separator()
        .items(&[&export, &export_pdf])
        .items(&[&share_link, &share])
        .separator()
        .item(&print);
    #[cfg(target_os = "windows")]
    let file_builder = file_builder.separator().quit_with_text(if zh {
        "退出 TextMark"
    } else {
        "Exit TextMark"
    });
    let file = file_builder.build()?;

    // Edit menu
    let undo = item("undo", "撤销", "Undo", Some("CmdOrCtrl+Z"))?;
    let redo = item("redo", "重做", "Redo", Some("CmdOrCtrl+Shift+Z"))?;
    let find = item("find", "查找…", "Find…", Some("CmdOrCtrl+F"))?;
    let find_replace = item(
        "find-replace",
        "查找和替换…",
        "Find and Replace…",
        Some("CmdOrCtrl+Alt+F"),
    )?;
    let find_next = item("find-next", "查找下一个", "Find Next", Some("CmdOrCtrl+G"))?;
    let find_prev = item(
        "find-prev",
        "查找上一个",
        "Find Previous",
        Some("CmdOrCtrl+Shift+G"),
    )?;
    let find_use_selection = item(
        "find-use-selection",
        "使用所选内容查找",
        "Use Selection for Find",
        None,
    )?;
    let find_jump_selection = item(
        "find-jump-selection",
        "跳到所选内容",
        "Jump to Selection",
        Some("CmdOrCtrl+J"),
    )?;
    // The reference groups its find commands in a Finder-style submenu.
    let find_menu = SubmenuBuilder::new(app, if zh { "查找" } else { "Find" })
        .items(&[&find, &find_replace, &find_next, &find_prev])
        .items(&[&find_use_selection, &find_jump_selection])
        .build()?;
    // Spelling and substitution commands are AppKit's standard text-editing
    // actions. They are dispatched down the responder chain (see
    // dispatch_responder_action), which WKWebView implements for its editable
    // content, so the menu edits the document exactly as a native text view
    // would.
    let spell_panel = item(
        "spell-show-panel",
        "显示拼写和语法",
        "Show Spelling and Grammar",
        Some("CmdOrCtrl+:"),
    )?;
    let spell_now = item(
        "spell-check-now",
        "立即检查文稿",
        "Check Document Now",
        Some("CmdOrCtrl+;"),
    )?;
    let spell_continuous = item(
        "spell-toggle-continuous",
        "键入时检查拼写",
        "Check Spelling While Typing",
        None,
    )?;
    let spell_grammar = item(
        "spell-toggle-grammar",
        "检查拼写和语法",
        "Check Grammar With Spelling",
        None,
    )?;
    let spell_autocorrect = item(
        "spell-toggle-autocorrect",
        "自动纠正拼写",
        "Correct Spelling Automatically",
        None,
    )?;
    let spell_menu = SubmenuBuilder::new(
        app,
        if zh {
            "拼写和语法"
        } else {
            "Spelling and Grammar"
        },
    )
    .items(&[&spell_panel, &spell_now])
    .separator()
    .items(&[&spell_continuous, &spell_grammar, &spell_autocorrect])
    .build()?;
    let substitutions_panel = item(
        "substitutions-panel",
        "显示替换",
        "Show Substitutions",
        None,
    )?;
    let substitutions_smart_insert = item(
        "substitutions-smart-insert",
        "智能拷贝/粘贴",
        "Smart Copy/Paste",
        None,
    )?;
    let substitutions_smart_quotes = item(
        "substitutions-smart-quotes",
        "智能引号",
        "Smart Quotes",
        None,
    )?;
    let substitutions_smart_dashes = item(
        "substitutions-smart-dashes",
        "智能破折号",
        "Smart Dashes",
        None,
    )?;
    let substitutions_smart_links = item(
        "substitutions-smart-links",
        "智能链接",
        "Smart Links",
        None,
    )?;
    let substitutions_data_detection = item(
        "substitutions-data-detection",
        "数据检测器",
        "Data Detectors",
        None,
    )?;
    let substitutions_text_replacement = item(
        "substitutions-text-replacement",
        "文本替换",
        "Text Replacement",
        None,
    )?;
    let substitutions_menu =
        SubmenuBuilder::new(app, if zh { "替换" } else { "Substitutions" })
            .item(&substitutions_panel)
            .separator()
            .items(&[
                &substitutions_smart_insert,
                &substitutions_smart_quotes,
                &substitutions_smart_dashes,
                &substitutions_smart_links,
                &substitutions_data_detection,
                &substitutions_text_replacement,
            ])
            .build()?;
    // Text-case conversion and speech are the parts of AppKit's text-editing
    // menus TextMark can honour in its own editor.
    let transform_upper = item("transform-upper", "变为大写", "Make Uppercase", None)?;
    let transform_lower = item("transform-lower", "变为小写", "Make Lowercase", None)?;
    let transform_capitalize = item("transform-capitalize", "首字母大写", "Capitalize", None)?;
    let transform = SubmenuBuilder::new(app, if zh { "转换" } else { "Transform" })
        .items(&[&transform_upper, &transform_lower, &transform_capitalize])
        .build()?;
    let speak_start = item("speak-start", "开始朗读", "Start Speaking", None)?;
    let speak_stop = item("speak-stop", "停止朗读", "Stop Speaking", None)?;
    let speech = SubmenuBuilder::new(app, if zh { "语音" } else { "Speech" })
        .items(&[&speak_start, &speak_stop])
        .build()?;
    let edit_mode = item(
        "edit-mode",
        "切换编辑模式",
        "Toggle Edit Mode",
        Some("CmdOrCtrl+E"),
    )?;
    let preferences = item("preferences", "设置…", "Settings…", Some("CmdOrCtrl+Comma"))?;
    let paste_match_style = item(
        "paste-match-style",
        "粘贴并匹配样式",
        "Paste and Match Style",
        Some("CmdOrCtrl+Alt+Shift+V"),
    )?;
    // AppKit binds Delete to the bare forward-delete key; no accelerator is
    // declared here so the menu does not swallow Backspace inside the editor.
    let delete_selection = item("delete-selection", "删除", "Delete", None)?;
    let edit_builder = SubmenuBuilder::new(app, if zh { "编辑" } else { "Edit" })
        .items(&[&undo, &redo])
        .separator()
        .cut_with_text(if zh { "剪切" } else { "Cut" })
        .copy_with_text(if zh { "拷贝" } else { "Copy" })
        .paste_with_text(if zh { "粘贴" } else { "Paste" })
        .item(&paste_match_style)
        .item(&delete_selection)
        .select_all_with_text(if zh { "全选" } else { "Select All" })
        .separator()
        .item(&find_menu)
        .separator()
        .item(&spell_menu)
        .item(&substitutions_menu)
        .item(&transform)
        .item(&speech);
    #[cfg(not(target_os = "macos"))]
    let edit_builder = edit_builder.separator().item(&preferences);
    let edit = edit_builder.build()?;

    // View menu
    let sidebar = item("sidebar", "切换边栏", "Toggle Sidebar", Some("CmdOrCtrl+L"))?;
    let sidebar_hide = state_item(
        "sidebar-hide",
        !state.sidebar_visible,
        "隐藏边栏",
        "Hide Sidebar",
        sidebar_pane_accel("1"),
    )?;
    let sidebar_outline = state_item(
        "sidebar-outline",
        state.sidebar_visible && state.sidebar_mode == "outline",
        "目录",
        "Table of Contents",
        sidebar_pane_accel("2"),
    )?;
    let sidebar_files = state_item(
        "sidebar-files",
        state.sidebar_visible && state.sidebar_mode == "files",
        "项目导航器",
        "Project Navigator",
        sidebar_pane_accel("3"),
    )?;
    // The reference exposes the inspector from the toolbar only; Cmd/Ctrl+I
    // stays available for italic while editing.
    let (show_toolbar_zh, show_toolbar_en) = toolbar_menu_labels(state.toolbar_hidden);
    let show_toolbar = item(
        "show-toolbar",
        show_toolbar_zh,
        show_toolbar_en,
        Some("CmdOrCtrl+Alt+T"),
    )?;
    // AppKit renders a literal "+" key equivalent as ⌘+; the deprecated Code
    // parser only knows "=" so macOS uses the numpad addition code, whose key
    // character is still "+".
    let zoom_in_accel = if cfg!(target_os = "macos") {
        "CmdOrCtrl+NUMPLUS"
    } else {
        "CmdOrCtrl+="
    };
    let zoom_in = item("zoom-in", "放大", "Zoom In", Some(zoom_in_accel))?;
    let zoom_out = item("zoom-out", "缩小", "Zoom Out", Some("CmdOrCtrl+-"))?;
    let zoom_reset = item("zoom-reset", "实际大小", "Actual Size", Some("CmdOrCtrl+0"))?;
    let customize = item(
        "customize-toolbar",
        "自定义工具栏…",
        "Customize Toolbar…",
        None,
    )?;
    // Upstream (markdown-preview) keeps the preview window in front; the
    // setting applies to the current window and is not persisted. ⌃⌘T is
    // macOS-only so it does not collide with the New Tab shortcut.
    let always_on_top = state_item(
        "always-on-top",
        state.always_on_top,
        "始终置顶",
        "Always on Top",
        if cfg!(target_os = "macos") {
            Some("CmdOrCtrl+Control+T")
        } else {
            None
        },
    )?;

    let appearance_auto = state_item(
        "appearance-auto",
        state.appearance == "system",
        "自动",
        "Automatic",
        None,
    )?;
    let appearance_light = state_item(
        "appearance-light",
        state.appearance == "light",
        "浅色",
        "Light",
        None,
    )?;
    let appearance_dark = state_item(
        "appearance-dark",
        state.appearance == "dark",
        "深色",
        "Dark",
        None,
    )?;
    let appearance = SubmenuBuilder::new(app, if zh { "外观" } else { "Appearance" })
        .items(&[&appearance_auto, &appearance_light, &appearance_dark])
        .build()?;

    let width_normal = state_item(
        "width-normal",
        state.content_width == "normal",
        "标准",
        "Normal",
        None,
    )?;
    let width_full = state_item(
        "width-full",
        state.content_width == "full",
        "全宽",
        "Full Width",
        None,
    )?;
    let content_width = SubmenuBuilder::new(app, if zh { "内容宽度" } else { "Content Width" })
        .items(&[&width_normal, &width_full])
        .build()?;

    // The reference's tab strip is AppKit's; TextMark draws its own, so the
    // toggle and the overview map onto the in-window document tabs.
    let tabs_toggle = item(
        "toggle-tab-bar",
        if state.tabs_hidden {
            "显示标签页栏"
        } else {
            "隐藏标签页栏"
        },
        if state.tabs_hidden {
            "Show Tab Bar"
        } else {
            "Hide Tab Bar"
        },
        None,
    )?;
    let show_all_tabs = item(
        "show-all-tabs",
        "显示所有标签页",
        "Show All Tabs",
        Some("CmdOrCtrl+Shift+Backslash"),
    )?;

    let view_builder = SubmenuBuilder::new(app, if zh { "显示" } else { "View" })
        .items(&[&tabs_toggle, &show_all_tabs])
        .separator()
        .item(&appearance)
        .item(&content_width)
        .separator()
        .items(&[&sidebar, &sidebar_hide, &sidebar_outline, &sidebar_files])
        .separator()
        .items(&[&show_toolbar, &customize])
        .separator()
        .item(&edit_mode)
        .separator()
        .items(&[&zoom_reset, &zoom_in, &zoom_out])
        // The reference keeps two separators between the zoom group and Always
        // on Top; AppKit draws the pair as one gap, but the structure matches.
        .separator()
        .separator()
        .item(&always_on_top);
    #[cfg(target_os = "macos")]
    let view_builder = view_builder.fullscreen_with_text(if zh {
        "进入全屏幕"
    } else {
        "Enter Full Screen"
    });
    let view = view_builder.build()?;

    // Format menu
    let format = SubmenuBuilder::new(app, if zh { "格式" } else { "Format" })
        .items(&[
            &item("format-h0", "正文", "Body", Some("CmdOrCtrl+Alt+0"))?,
            &item("format-h1", "标题 1", "Heading 1", Some("CmdOrCtrl+Alt+1"))?,
            &item("format-h2", "标题 2", "Heading 2", Some("CmdOrCtrl+Alt+2"))?,
            &item("format-h3", "标题 3", "Heading 3", Some("CmdOrCtrl+Alt+3"))?,
        ])
        .separator()
        .items(&[
            &item("format-bold", "粗体", "Bold", Some("CmdOrCtrl+B"))?,
            &item("format-italic", "斜体", "Italic", Some("CmdOrCtrl+I"))?,
            &item(
                "format-strikethrough",
                "删除线",
                "Strikethrough",
                Some("CmdOrCtrl+Shift+X"),
            )?,
            &item(
                "format-code",
                "行内代码",
                "Inline Code",
                Some("CmdOrCtrl+Shift+M"),
            )?,
            &item("format-link", "链接", "Link", Some("CmdOrCtrl+K"))?,
        ])
        .separator()
        .items(&[
            &item(
                "format-bulletList",
                "项目符号列表",
                "Bulleted List",
                Some("CmdOrCtrl+Shift+7"),
            )?,
            &item(
                "format-orderedList",
                "编号列表",
                "Numbered List",
                Some("CmdOrCtrl+Shift+9"),
            )?,
            &item(
                "format-taskList",
                "任务列表",
                "Checklist",
                Some("CmdOrCtrl+Shift+L"),
            )?,
            &item(
                "format-quote",
                "引用",
                "Block Quote",
                Some("CmdOrCtrl+Quote"),
            )?,
        ])
        .build()?;

    // Go menu
    let go = SubmenuBuilder::new(app, if zh { "前往" } else { "Go" })
        .items(&[
            &item("go-up", "向上", "Up", None)?,
            &item("go-down", "向下", "Down", None)?,
            &item("go-page-up", "上一页", "Page Up", None)?,
            &item("go-page-down", "下一页", "Page Down", None)?,
        ])
        .separator()
        .items(&[
            &item("go-prev-item", "上一项", "Previous Item", Some("Alt+Up"))?,
            &item("go-next-item", "下一项", "Next Item", Some("Alt+Down"))?,
        ])
        .separator()
        .items(&[
            &item(
                "go-top",
                "文稿开头",
                "Top of Document",
                Some("CmdOrCtrl+Up"),
            )?,
            &item(
                "go-bottom",
                "文稿结尾",
                "Bottom of Document",
                Some("CmdOrCtrl+Down"),
            )?,
        ])
        .build()?;

    #[cfg(target_os = "macos")]
    let previous_tab = item(
        "previous-tab",
        "显示上一个标签页",
        "Show Previous Tab",
        Some("Control+Shift+Tab"),
    )?;
    #[cfg(target_os = "macos")]
    let next_tab = item(
        "next-tab",
        "显示下一个标签页",
        "Show Next Tab",
        Some("Control+Tab"),
    )?;
    #[cfg(target_os = "macos")]
    let move_tab_window = item(
        "move-tab-window",
        "将标签页移到新窗口",
        "Move Tab to New Window",
        None,
    )?;
    // Native window tab groups are disabled in TextMark (the app draws its own
    // document tabs and opts out of AppKit tabbing), so there are no groups to
    // merge; the item keeps the reference's structure and stays disabled.
    #[cfg(target_os = "macos")]
    let merge_windows = MenuItemBuilder::with_id(
        "merge-windows",
        if zh {
            "合并所有窗口"
        } else {
            "Merge All Windows"
        },
    )
    .enabled(false)
    .build(app)?;
    #[cfg(target_os = "macos")]
    let window = SubmenuBuilder::new(app, if zh { "窗口" } else { "Window" })
        .minimize_with_text(if zh { "最小化" } else { "Minimize" })
        .maximize_with_text(if zh { "缩放" } else { "Zoom" })
        .separator()
        .bring_all_to_front_with_text(if zh {
            "前置全部窗口"
        } else {
            "Bring All to Front"
        })
        .separator()
        .items(&[&previous_tab, &next_tab, &move_tab_window, &merge_windows])
        // AppKit appends the window list after its own separator; the trailing
        // separator here reproduces the reference's blank line above that list.
        .separator()
        .separator()
        .build()?;
    #[cfg(target_os = "windows")]
    let window = SubmenuBuilder::new(app, if zh { "窗口" } else { "Window" })
        .minimize_with_text(if zh { "最小化" } else { "Minimize" })
        .maximize_with_text(if zh { "缩放" } else { "Zoom" })
        .build()?;

    let help_item = item("help", "TextMark 帮助", "TextMark Help", None)?;
    let whats_new = item("whats-new", "发布说明", "Release Notes", None)?;
    let check_updates = item("check-updates", "检查更新…", "Check for Updates…", None)?;
    let install_cli = item("install-cli", "安装命令行工具", "Install CLI", None)?;
    #[cfg(target_os = "macos")]
    let help_builder = SubmenuBuilder::new(app, if zh { "帮助" } else { "Help" })
        // The reference's Help menu opens with a separator before the help
        // book entry.
        .separator()
        .item(&help_item)
        .item(&whats_new);
    #[cfg(not(target_os = "macos"))]
    let about = item("about", "关于 TextMark", "About TextMark", None)?;
    #[cfg(not(target_os = "macos"))]
    let help_builder = SubmenuBuilder::new(app, if zh { "帮助" } else { "Help" })
        .item(&help_item)
        .separator()
        .items(&[&check_updates, &whats_new, &install_cli])
        .separator()
        .item(&about);
    let help = help_builder.build()?;

    #[cfg(target_os = "macos")]
    let application = SubmenuBuilder::new(app, "TextMark")
        .about_with_text(
            if zh {
                "关于 TextMark"
            } else {
                "About TextMark"
            },
            None,
        )
        .item(&check_updates)
        .separator()
        .item(&preferences)
        .item(&install_cli)
        .separator()
        .services_with_text(if zh { "服务" } else { "Services" })
        .separator()
        .hide_with_text(if zh {
            "隐藏 TextMark"
        } else {
            "Hide TextMark"
        })
        .hide_others_with_text(if zh { "隐藏其他" } else { "Hide Others" })
        .show_all_with_text(if zh { "全部显示" } else { "Show All" })
        .separator()
        .quit_with_text(if zh {
            "退出 TextMark"
        } else {
            "Quit TextMark"
        })
        .build()?;

    #[cfg(target_os = "macos")]
    return MenuBuilder::new(app)
        .items(&[
            &application,
            &file,
            &edit,
            &format,
            &view,
            &go,
            &window,
            &help,
        ])
        .build();
    #[cfg(target_os = "windows")]
    return MenuBuilder::new(app)
        .items(&[&file, &edit, &view, &format, &go, &window, &help])
        .build();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    MenuBuilder::new(app)
        .items(&[&file, &edit, &view, &format, &go, &help])
        .build()
}

fn toolbar_menu_labels(toolbar_hidden: bool) -> (&'static str, &'static str) {
    if toolbar_hidden {
        ("显示工具栏", "Show Toolbar")
    } else {
        ("隐藏工具栏", "Hide Toolbar")
    }
}

#[tauri::command]
fn refresh_menu(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    request: MenuRefreshRequest,
) -> AppResult<()> {
    // The macOS menu bar belongs to the application, while toolbar visibility
    // belongs to one window. A background window must not overwrite the menu
    // label and checked state of the active window.
    if app
        .webview_windows()
        .into_values()
        .any(|other| other.label() != window.label() && other.is_focused().unwrap_or(false))
    {
        return Ok(());
    }
    let state = MenuUiState {
        appearance: match request.appearance.as_str() {
            "light" => "light",
            "dark" => "dark",
            _ => "system",
        },
        content_width: match request.content_width.as_str() {
            "full" => "full",
            _ => "normal",
        },
        sidebar_mode: match request.sidebar_mode.as_str() {
            "files" => "files",
            _ => "outline",
        },
        sidebar_visible: request.sidebar_visible,
        toolbar_hidden: !request.toolbar_visible,
        always_on_top: request.always_on_top,
        tabs_hidden: request.tabs_hidden,
        session_count: request.session_count,
    };
    let menu = build_menu(&app, &request.locale, &state, &load_recent_files()).map_err(io_error)?;
    app.set_menu(menu).map_err(io_error)?;
    #[cfg(target_os = "macos")]
    apply_native_menu_key_equivalents(&app, request.editable, request.dirty);
    Ok(())
}

fn io_error(_error: impl std::fmt::Display) -> AppError {
    AppError { code: "io" }
}

fn timestamp_ms(value: std::io::Result<std::time::SystemTime>) -> Option<u128> {
    value
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
}

fn revision(metadata: &fs::Metadata) -> String {
    format!(
        "{}:{}",
        metadata.len(),
        timestamp_ms(metadata.modified()).unwrap_or_default()
    )
}

fn ensure_file_replaceable(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Ok(());
    }
    let metadata = fs::metadata(path).map_err(io_error)?;
    // AtomicWriteFile replaces an existing path through its parent directory.
    // Probe the file itself first so a writable parent cannot bypass the
    // target's mode bits, ACL, or platform read-only attribute.
    if metadata.permissions().readonly() || OpenOptions::new().write(true).open(path).is_err() {
        return Err(AppError { code: "read_only" });
    }
    Ok(())
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| MARKDOWN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn parse_launch_request<I>(arguments: I, working_directory: &Path) -> StartupRequest
where
    I: IntoIterator<Item = String>,
{
    let mut new_window = false;
    let mut seen = HashSet::new();
    let mut paths = Vec::new();
    for argument in arguments {
        if argument == "--new-window" {
            new_window = true;
            continue;
        }
        if argument.starts_with('-') {
            continue;
        }
        let raw = PathBuf::from(argument);
        let candidate = if raw.is_absolute() {
            raw
        } else {
            working_directory.join(raw)
        };
        let Ok(canonical) = candidate.canonicalize() else {
            continue;
        };
        let is_directory = canonical.is_dir();
        if !is_directory && (!canonical.is_file() || !is_markdown(&canonical)) {
            continue;
        }
        let path = canonical.to_string_lossy().to_string();
        if seen.insert(path.clone()) {
            paths.push(OpenPathRequest { path, is_directory });
        }
    }
    StartupRequest { paths, new_window }
}

fn application_available(commands: &[&str], mac_app: Option<&str>) -> bool {
    if let Some(app) = mac_app
        && (Path::new("/Applications").join(app).exists()
            || Path::new("/System/Applications").join(app).exists()
            || dirs::home_dir().is_some_and(|home| home.join("Applications").join(app).exists()))
    {
        return true;
    }
    std::env::var_os("PATH")
        .map(|path| {
            std::env::split_paths(&path).any(|directory| {
                commands.iter().any(|command| {
                    let candidate = directory.join(command);
                    candidate.is_file() || directory.join(format!("{command}.exe")).is_file()
                })
            })
        })
        .unwrap_or(false)
}

/// Bundle identifiers the reference's OpenTargetCatalog keeps out of its
/// Editors menu even though Launch Services reports editor roles for them.
#[cfg(target_os = "macos")]
const IGNORED_OPEN_WITH_BUNDLES: &[&str] = &[
    "com.microsoft.Word",
    "com.ideasoncanvas.mindnode.macos",
    "com.somac.subtitleburner",
];

/// Editors that declare plain-text document types without a Markdown one.
/// The reference admits these by bundle identifier rather than by capability
/// sniffing, which is why TextEdit appears but Numbers, Word and Excel do not.
#[cfg(target_os = "macos")]
const PREFERRED_OPEN_WITH_BUNDLES: &[&str] = &[
    "com.microsoft.VSCode",
    "com.todesktop.230313mzl4w4u92",
    "com.sublimetext.4",
    "com.sublimetext.3",
    "com.barebones.bbedit",
    "com.coteditor.CotEditor",
    "com.apple.TextEdit",
    "com.apple.dt.Xcode",
    "com.macromates.TextMate",
    "pro.writer.mac-setapp",
    "abnerworks.Typora",
    "com.uranusjr.macdown",
];

#[cfg(target_os = "macos")]
const MARKDOWN_UTIS: &[&str] = &["net.daringfireball.markdown", "public.markdown", "net.ia.markdown"];

/// Only the Markdown spellings: the broader `MARKDOWN_EXTENSIONS` list also
/// contains "txt", which would wrongly admit spreadsheets and word processors
/// that register plain text as an editor type.
#[cfg(target_os = "macos")]
const MARKDOWN_DOCUMENT_EXTENSIONS: &[&str] = &["md", "markdown"];

#[cfg(target_os = "macos")]
fn mac_bundle_info(bundle: &Path) -> Option<plist::Dictionary> {
    plist::Value::from_file(bundle.join("Contents/Info.plist"))
        .ok()?
        .into_dictionary()
}

#[cfg(target_os = "macos")]
fn mac_application_is_markdown_editor(info: &plist::Dictionary) -> bool {
    info.get("CFBundleDocumentTypes")
        .and_then(|value| value.as_array())
        .is_some_and(|document_types| {
            document_types.iter().any(|document_type| {
                let Some(document_type) = document_type.as_dictionary() else {
                    return false;
                };
                if document_type
                    .get("CFBundleTypeRole")
                    .and_then(|value| value.as_string())
                    != Some("Editor")
                {
                    return false;
                }
                let markdown_uti = document_type
                    .get("LSItemContentTypes")
                    .and_then(|value| value.as_array())
                    .is_some_and(|utis| {
                        utis.iter()
                            .filter_map(|value| value.as_string())
                            .any(|uti| MARKDOWN_UTIS.contains(&uti))
                    });
                markdown_uti
                    || document_type
                        .get("CFBundleTypeExtensions")
                        .and_then(|value| value.as_array())
                        .is_some_and(|extensions| {
                            extensions.iter().filter_map(|value| value.as_string()).any(
                                |extension| {
                                    MARKDOWN_DOCUMENT_EXTENSIONS
                                        .contains(&extension.to_ascii_lowercase().as_str())
                                },
                            )
                        })
            })
        })
}

/// TextMark's own bundle identifier and its parity/test clones; the reference
/// likewise omits itself from its Editors menu.
#[cfg(target_os = "macos")]
fn is_own_application_bundle(bundle_id: &str) -> bool {
    bundle_id == "app.textmark.desktop" || bundle_id.starts_with("app.textmark.desktop.")
}

/// Moves into a bundle name an application whose bundle identifier is in the
/// curated catalog, so stored default targets keep working after discovery
/// became dynamic.
#[cfg(target_os = "macos")]
fn curated_application_id(mac_app_file_name: &str) -> Option<&'static str> {
    APPLICATION_CATALOG
        .iter()
        .find(|entry| entry.5 == Some(mac_app_file_name))
        .map(|entry| entry.0)
}

/// Launch Services' ordered candidate list for a Markdown document, narrowed to
/// markdown-capable editors exactly as the reference's Editors menu does it.
/// The order is the reference menu order; bundle identifiers that are known
/// curated targets keep their historic ids.
#[cfg(target_os = "macos")]
fn mac_open_with_applications() -> Vec<ExternalApplication> {
    use objc2_app_kit::NSWorkspace;
    use objc2_foundation::{NSFileManager, NSString, NSURL};

    // Launch Services dispatches by file type; a tiny Markdown sample gives the
    // same candidate order for every document. It never needs refreshing.
    let sample_path = std::env::temp_dir().join("textmark-open-with.md");
    if !sample_path.exists() {
        let _ = fs::write(&sample_path, "# Markdown\n");
    }
    let sample_url = NSURL::fileURLWithPath(&NSString::from_str(&sample_path.to_string_lossy()));
    let workspace = NSWorkspace::sharedWorkspace();
    let file_manager = NSFileManager::defaultManager();
    let mut seen = HashSet::new();
    let mut applications = Vec::new();
    for url in workspace.URLsForApplicationsToOpenURL(&sample_url).iter() {
        let Some(bundle_path) = url.path() else {
            continue;
        };
        let bundle_path = PathBuf::from(bundle_path.to_string());
        let Some(info) = mac_bundle_info(&bundle_path) else {
            continue;
        };
        let Some(bundle_id) = info
            .get("CFBundleIdentifier")
            .and_then(|value| value.as_string())
        else {
            continue;
        };
        if is_own_application_bundle(bundle_id)
            || IGNORED_OPEN_WITH_BUNDLES.contains(&bundle_id)
            || (!mac_application_is_markdown_editor(&info)
                && !PREFERRED_OPEN_WITH_BUNDLES.contains(&bundle_id))
        {
            continue;
        }
        let Some(file_name) = bundle_path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let id = curated_application_id(file_name)
            .map(str::to_string)
            .unwrap_or_else(|| bundle_id.to_string());
        if !seen.insert(id.clone()) {
            continue;
        }
        let display_name = file_manager
            .displayNameAtPath(&NSString::from_str(&bundle_path.to_string_lossy()))
            .to_string();
        applications.push(ExternalApplication {
            id,
            // Finder's localized name ("妙言", "文本编辑") matches the
            // reference menu; strip the extension Finder keeps.
            name: display_name
                .strip_suffix(".app")
                .unwrap_or(&display_name)
                .to_string(),
            kind: "editor",
            available: true,
            mac_app: Some(bundle_path.to_string_lossy().to_string()),
        });
    }
    applications
}

/// Static catalog backing the non-macOS Open With menu and the LLM targets on
/// every platform. macOS editors come from Launch Services instead, because
/// the reference menu is the system's own ordered candidate list.
const APPLICATION_CATALOG: &[CatalogEntry] = &[
    (
            "vscode",
            "Visual Studio Code",
            "editor",
            false,
            &["code"],
            Some("Visual Studio Code.app"),
        ),
        (
            "vscode-insiders",
            "Visual Studio Code Insiders",
            "editor",
            false,
            &["code-insiders"],
            Some("Visual Studio Code - Insiders.app"),
        ),
        (
            "vscodium",
            "VSCodium",
            "editor",
            false,
            &["codium"],
            Some("VSCodium.app"),
        ),
        (
            "cursor",
            "Cursor",
            "editor",
            false,
            &["cursor"],
            Some("Cursor.app"),
        ),
        (
            "windsurf",
            "Windsurf",
            "editor",
            false,
            &["windsurf"],
            Some("Windsurf.app"),
        ),
        (
            "trae",
            "Trae",
            "editor",
            false,
            &["trae"],
            Some("Trae.app"),
        ),
        ("zed", "Zed", "editor", false, &["zed"], Some("Zed.app")),
        (
            "fleet",
            "Fleet",
            "editor",
            false,
            &["fleet"],
            Some("Fleet.app"),
        ),
        (
            "intellij",
            "IntelliJ IDEA",
            "editor",
            false,
            &["idea"],
            Some("IntelliJ IDEA.app"),
        ),
        (
            "sublime",
            "Sublime Text",
            "editor",
            false,
            &["subl", "sublime_text"],
            Some("Sublime Text.app"),
        ),
        (
            "notepadpp",
            "Notepad++",
            "editor",
            false,
            &["notepad++.exe"],
            None,
        ),
        (
            "obsidian",
            "Obsidian",
            "editor",
            false,
            &["obsidian"],
            Some("Obsidian.app"),
        ),
        (
            "typora",
            "Typora",
            "editor",
            false,
            &["typora"],
            Some("Typora.app"),
        ),
        (
            "markedit",
            "MarkEdit",
            "editor",
            false,
            &[],
            Some("MarkEdit.app"),
        ),
        (
            "mellow",
            "Mellow",
            "editor",
            false,
            &[],
            Some("Mellow.app"),
        ),
        ("taio", "Taio", "editor", false, &[], Some("Taio.app")),
        (
            "marktext",
            "MarkText",
            "editor",
            false,
            &["marktext"],
            Some("MarkText.app"),
        ),
        (
            "macdown",
            "MacDown",
            "editor",
            false,
            &[],
            Some("MacDown.app"),
        ),
        (
            "bbedit",
            "BBEdit",
            "editor",
            false,
            &[],
            Some("BBEdit.app"),
        ),
        ("nova", "Nova", "editor", false, &[], Some("Nova.app")),
        (
            "coteditor",
            "CotEditor",
            "editor",
            false,
            &[],
            Some("CotEditor.app"),
        ),
        (
            "textmate",
            "TextMate",
            "editor",
            false,
            &["mate"],
            Some("TextMate.app"),
        ),
        (
            "macvim",
            "MacVim",
            "editor",
            false,
            &["mvim"],
            Some("MacVim.app"),
        ),
        (
            "xcode",
            "Xcode",
            "editor",
            false,
            &["xed"],
            Some("Xcode.app"),
        ),
        (
            "textedit",
            "TextEdit",
            "editor",
            false,
            &[],
            Some("TextEdit.app"),
        ),
        (
            "emacs",
            "Emacs",
            "editor",
            false,
            &["emacs"],
            Some("Emacs.app"),
        ),
        (
            "codex",
            "Codex",
            "llm",
            false,
            &["codex"],
            Some("Codex.app"),
        ),
        (
            "claude",
            "Claude",
            "llm",
            false,
            &["claude"],
            Some("Claude.app"),
        ),
        (
            "chatgpt",
            "ChatGPT",
            "llm",
            false,
            &["chatgpt"],
            Some("ChatGPT.app"),
        ),
    ];

type CatalogEntry = (
    &'static str,
    &'static str,
    &'static str,
    bool,
    &'static [&'static str],
    Option<&'static str>,
);

fn catalog_application(entry: &CatalogEntry) -> ExternalApplication {
    ExternalApplication {
        id: entry.0.to_string(),
        name: entry.1.to_string(),
        kind: entry.2,
        available: entry.3 || application_available(entry.4, entry.5),
        mac_app: entry.5.map(str::to_string),
    }
}

#[tauri::command]
fn discover_applications() -> Vec<ExternalApplication> {
    let mut applications = vec![ExternalApplication {
        id: "system".to_string(),
        name: "System Default".to_string(),
        kind: "system",
        available: true,
        mac_app: None,
    }];
    #[cfg(target_os = "macos")]
    applications.extend(mac_open_with_applications());
    #[cfg(not(target_os = "macos"))]
    applications.extend(
        APPLICATION_CATALOG
            .iter()
            .filter(|entry| entry.2 == "editor")
            .map(catalog_application),
    );
    applications.extend(
        APPLICATION_CATALOG
            .iter()
            .filter(|entry| entry.2 == "llm")
            .map(catalog_application),
    );
    applications
}

fn scan_directory(path: &Path, depth: usize) -> AppResult<Vec<FileNode>> {
    if depth == 0 {
        return Ok(Vec::new());
    }
    let mut entries = fs::read_dir(path)
        .map_err(io_error)?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let entry_path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist"
            {
                return None;
            }
            let is_directory = entry_path.is_dir();
            // macOS document bundles and package directories are containers,
            // not workspace folders. Traversing them exposes hundreds of
            // implementation files in the Markdown navigator and wastes the
            // scan budget before reaching documents the user can open.
            if is_directory && is_package_directory(&entry_path) {
                return None;
            }
            if !is_directory && !is_markdown(&entry_path) {
                return None;
            }
            let children = if is_directory {
                scan_directory(&entry_path, depth - 1).unwrap_or_default()
            } else {
                Vec::new()
            };
            Some(FileNode {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_directory,
                children,
            })
        })
        .collect::<Vec<_>>();
    // Natural sort like the upstream navigator's localizedStandardCompare:
    // digit runs compare numerically so file2 precedes file10, matching Finder.
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| natural_cmp(&a.name, &b.name))
    });
    Ok(entries)
}

/// Compare two names with embedded digit runs ordered numerically, falling
/// back to a case-insensitive comparison for the non-digit remainder.
fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let left = a.as_bytes();
    let right = b.as_bytes();
    let mut i = 0;
    let mut j = 0;
    while i < left.len() && j < right.len() {
        if left[i].is_ascii_digit() && right[j].is_ascii_digit() {
            // Compare whole digit runs numerically: shorter (after stripping
            // leading zeros) means smaller, then lexicographically.
            let l_end = digit_run_end(left, i);
            let r_end = digit_run_end(right, j);
            let l = &a[i..l_end];
            let r = &b[j..r_end];
            let l_trimmed = l.trim_start_matches('0');
            let r_trimmed = r.trim_start_matches('0');
            let order = l_trimmed
                .len()
                .cmp(&r_trimmed.len())
                .then_with(|| l_trimmed.cmp(r_trimmed));
            if order != std::cmp::Ordering::Equal {
                return order;
            }
            i = l_end;
            j = r_end;
        } else {
            let l = left[i].to_ascii_lowercase();
            let r = right[j].to_ascii_lowercase();
            if l != r {
                return l.cmp(&r);
            }
            i += 1;
            j += 1;
        }
    }
    (left.len() - i).cmp(&(right.len() - j))
}

/// End index (exclusive) of the ASCII digit run starting at `start`.
fn digit_run_end(bytes: &[u8], start: usize) -> usize {
    let mut end = start;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    end
}

fn is_package_directory(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "app" | "bundle" | "framework" | "rtfd" | "pkg" | "playground" | "photoslibrary"
            )
        })
}

#[tauri::command]
fn read_text_file(path: String) -> AppResult<TextDocument> {
    let canonical = PathBuf::from(&path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !canonical.is_file() || !is_markdown(&canonical) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    let metadata = fs::metadata(&canonical).map_err(io_error)?;
    let contents = fs::read_to_string(&canonical).map_err(io_error)?;
    let modified_ms = timestamp_ms(metadata.modified());
    Ok(TextDocument {
        name: canonical
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: canonical.to_string_lossy().to_string(),
        contents,
        created_ms: timestamp_ms(metadata.created()),
        modified_ms,
        size_bytes: metadata.len(),
        revision: revision(&metadata),
    })
}

#[tauri::command]
fn drain_pending_open_paths(state: State<'_, PendingOpenPaths>) -> Vec<OpenPathRequest> {
    state
        .0
        .lock()
        .map(|mut paths| std::mem::take(&mut *paths))
        .unwrap_or_default()
}

#[cfg(feature = "e2e")]
#[tauri::command]
fn test_open_path(
    app: tauri::AppHandle,
    state: State<'_, PendingOpenPaths>,
    path: String,
) -> AppResult<()> {
    let request = parse_launch_request([path], &std::env::current_dir().unwrap_or_default())
        .paths
        .into_iter()
        .next()
        .ok_or(AppError { code: "not_found" })?;
    enqueue_pending_open_paths(&state, vec![request.clone()]);
    app.emit("open-paths", vec![request]).map_err(io_error)
}

#[tauri::command]
fn startup_request() -> StartupRequest {
    parse_launch_request(
        std::env::args_os()
            .skip(1)
            .map(|value| value.to_string_lossy().to_string()),
        &std::env::current_dir().unwrap_or_default(),
    )
}

#[tauri::command]
fn write_text_file(
    path: String,
    contents: String,
    expected_revision: Option<String>,
    force: bool,
) -> AppResult<TextDocument> {
    let target = PathBuf::from(path);
    if !is_markdown(&target) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    if target.exists() {
        let current = fs::metadata(&target).map_err(io_error)?;
        // AtomicWriteFile replaces the destination inode at commit time. That
        // can bypass the file's write bit when its parent directory is
        // writable, so probe the existing file itself before creating the
        // replacement. Keep this check even for force saves: force resolves
        // revision conflicts, not OS read-only protection.
        ensure_file_replaceable(&target)?;
        if !force
            && let Some(expected) = expected_revision
            && revision(&current) != expected
        {
            return Err(AppError {
                code: "save_conflict",
            });
        }
    }
    let mut file = AtomicWriteFile::open(&target).map_err(io_error)?;
    file.write_all(contents.as_bytes()).map_err(io_error)?;
    file.commit().map_err(io_error)?;
    read_text_file(target.to_string_lossy().to_string())
}

#[tauri::command]
fn save_export_bytes(path: String, bytes: Vec<u8>) -> AppResult<()> {
    let target = PathBuf::from(path);
    ensure_file_replaceable(&target)?;
    let mut file = AtomicWriteFile::open(&target).map_err(io_error)?;
    file.write_all(&bytes).map_err(io_error)?;
    file.commit().map_err(io_error)
}

/// Reads the plain-text flavour of the system clipboard for Edit ▸ Paste and
/// Match Style. WebView clipboard reads need a transient user activation that a
/// menu invocation never has, so the read happens natively instead.
#[tauri::command]
fn read_clipboard_text() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
        let pasteboard = NSPasteboard::generalPasteboard();
        // SAFETY: the pasteboard type identifier is a constant AppKit exports.
        let data_type = unsafe { NSPasteboardTypeString };
        pasteboard
            .stringForType(data_type)
            .map(|value| value.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

/// Normalizes clipboard pixels to PNG and stores them next to the Markdown
/// document. The relative link is deliberately stable across platforms.
#[tauri::command]
fn save_pasted_image(document_path: String, bytes: Vec<u8>) -> AppResult<SavedPastedImage> {
    if bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError {
            code: "asset_too_large",
        });
    }
    let document = PathBuf::from(document_path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !document.is_file() || !is_markdown(&document) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    let image = image::load_from_memory(&bytes).map_err(|_| AppError {
        code: "asset_unsupported",
    })?;
    let mut png = Cursor::new(Vec::new());
    image
        .write_to(&mut png, ImageFormat::Png)
        .map_err(io_error)?;
    let encoded = png.into_inner();
    if encoded.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError {
            code: "asset_too_large",
        });
    }
    let stem = document
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or(AppError {
            code: "invalid_path",
        })?;
    let directory = document
        .parent()
        .ok_or(AppError {
            code: "invalid_path",
        })?
        .join("Pictures")
        .join(stem);
    fs::create_dir_all(&directory).map_err(io_error)?;
    let sequence = PASTED_IMAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = directory.join(format!(
        ".textmark-paste-{}-{sequence}.tmp",
        std::process::id()
    ));
    let mut file = AtomicWriteFile::open(&temporary).map_err(io_error)?;
    file.write_all(&encoded).map_err(io_error)?;
    file.commit().map_err(io_error)?;
    for index in 1..=10_000_u32 {
        let target = directory.join(format!("{index}.png"));
        match fs::hard_link(&temporary, &target) {
            Ok(()) => {
                fs::remove_file(&temporary).map_err(io_error)?;
                return Ok(SavedPastedImage {
                    relative_path: format!("Pictures/{stem}/{index}.png"),
                });
            }
            Err(_) if target.exists() => continue,
            Err(error) => {
                let _ = fs::remove_file(&temporary);
                return Err(io_error(error));
            }
        }
    }
    let _ = fs::remove_file(&temporary);
    Err(AppError { code: "io" })
}

#[tauri::command]
fn rename_pasted_image(
    document_path: String,
    relative_path: String,
    name: String,
    contents: String,
    expected_revision: Option<String>,
) -> AppResult<RenamedPastedImage> {
    let document = PathBuf::from(document_path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !document.is_file() || !is_markdown(&document) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
    let stem = document
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or(AppError {
            code: "invalid_path",
        })?;
    let directory = document
        .parent()
        .ok_or(AppError {
            code: "invalid_path",
        })?
        .join("Pictures")
        .join(stem);
    let expected_prefix = format!("Pictures/{stem}/");
    if !relative_path.starts_with(&expected_prefix)
        || relative_path[expected_prefix.len()..].contains(['/', '\\'])
        || !relative_path.ends_with(".png")
    {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    let current = directory.join(&relative_path[expected_prefix.len()..]);
    if !current.is_file() {
        return Err(AppError { code: "not_found" });
    }
    let trimmed = name.trim();
    let cleaned = if trimmed.to_ascii_lowercase().ends_with(".png") {
        &trimmed[..trimmed.len() - 4]
    } else {
        trimmed
    };
    if cleaned.is_empty()
        || !cleaned
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    let filename = format!("{cleaned}.png");
    let target = directory.join(&filename);
    if target.exists() {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    fs::rename(&current, &target).map_err(io_error)?;
    let saved = write_text_file(
        document.to_string_lossy().to_string(),
        contents,
        expected_revision,
        false,
    );
    match saved {
        Ok(document) => Ok(RenamedPastedImage {
            relative_path: format!("Pictures/{stem}/{filename}"),
            document,
        }),
        Err(error) => {
            if fs::rename(&target, &current).is_err() {
                return Err(AppError { code: "io" });
            }
            Err(error)
        }
    }
}

fn unique_temp_export_path(extension: &str) -> String {
    let ext: String = extension
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(10)
        .collect();
    let ext = if ext.is_empty() {
        "pdf".to_string()
    } else {
        ext
    };
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = TEMP_EXPORT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir()
        .join(format!(
            "textmark-{}-{timestamp}-{sequence}.{ext}",
            std::process::id()
        ))
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn temp_export_path(extension: String) -> String {
    unique_temp_export_path(&extension)
}

#[tauri::command]
fn list_directory(path: String) -> AppResult<Vec<FileNode>> {
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !canonical.is_dir() {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    // The upstream navigator recurses without a depth cap. A bound still
    // guards against pathological trees (symlink loops are already excluded
    // by canonicalize, but circular hard links and generated trees exist);
    // 12 levels covers real documentation roots, and hidden/node_modules/
    // target/dist/package directories are pruned before recursing.
    scan_directory(&canonical, 12)
}

/// Renders the Finder icon for a file or application as a PNG data URL —
/// the upstream navigator's NSWorkspace.icon(forFile:) at 16pt (32px backing
/// pixels). Empty string when the path does not exist or rendering fails; the
/// UI falls back to the generic lucide glyph in that case.
/// Renders the Finder icon for a path as a PNG data URL at 16pt (32px
/// backing pixels). Accepts any filesystem path; when the path is an app
/// name like "Visual Studio Code.app" it is resolved from /Applications,
/// /System/Applications, or ~/Applications — the upstream menus show each
/// editor's real NSWorkspace icon. Empty string when nothing resolves or
/// rendering fails; the UI falls back to its generic glyph.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn file_icon_data_url(_path: String, _size: Option<f64>) -> AppResult<String> {
    Ok(String::new())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn file_icon_data_url(path: String, size: Option<f64>) -> AppResult<String> {
    use base64::Engine as _;
    use objc2::AnyThread;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
    use objc2_foundation::{NSDictionary, NSSize, NSString};

    let mut resolved = PathBuf::from(&path);
    if !resolved.exists() && path.ends_with(".app") {
        // Bare app name: search the standard install locations like
        // application_available does.
        for root in ["/Applications", "/System/Applications"] {
            let candidate = Path::new(root).join(&path);
            if candidate.exists() {
                resolved = candidate;
                break;
            }
        }
        if !resolved.exists()
            && let Some(home) = dirs::home_dir()
        {
            let candidate = home.join("Applications").join(&path);
            if candidate.exists() {
                resolved = candidate;
            }
        }
    }
    if !resolved.exists() {
        return Ok(String::new());
    }
    let workspace = NSWorkspace::sharedWorkspace();
    let ns_path = NSString::from_str(&resolved.to_string_lossy());
    let icon = workspace.iconForFile(&ns_path);
    // Backing pixels for a 2x display: 32 for the 16pt menu rows, 40 for the
    // titlebar tile's 20pt icon.
    let points = size.unwrap_or(16.0).clamp(8.0, 128.0);
    icon.setSize(NSSize::new(points * 2.0, points * 2.0));
    let Some(tiff) = icon.TIFFRepresentation() else {
        return Ok(String::new());
    };
    let Some(rep) = NSBitmapImageRep::initWithData(NSBitmapImageRep::alloc(), &tiff) else {
        return Ok(String::new());
    };
    let png = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) };
    let Some(png) = png else {
        return Ok(String::new());
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(png.to_vec());
    Ok(format!("data:image/png;base64,{encoded}"))
}

/// One toolbar glyph to rasterise: the SF Symbol's name plus the two knobs
/// AppKit exposes for it — point size and NSFont.Weight (0 regular, 0.23
/// semibold, …).
#[derive(serde::Deserialize)]
// Only the macOS rasteriser reads these; the other targets answer with empty
// images so the frontend can keep one code path.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct SfSymbolRequest {
    name: String,
    points: f64,
    weight: f64,
}

/// A rasterised symbol: the PNG data URL, and the point size AppKit gave the
/// artwork so the stylesheet can size the mask box without rescaling it.
#[derive(serde::Serialize)]
struct SfSymbolImage {
    url: String,
    width: f64,
    height: f64,
}

fn empty_sf_symbol() -> SfSymbolImage {
    SfSymbolImage {
        url: String::new(),
        width: 0.0,
        height: 0.0,
    }
}

/// The titlebar's glyphs are SF Symbols in the reference, so the same symbols
/// are rasterised here rather than approximated with hand-drawn paths: the
/// system draws the exact outlines the reference shows. Each image is drawn
/// into a 2x bitmap and handed to the webview as a CSS mask, which keeps the
/// glyph tintable with `currentColor` in every appearance.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn sf_symbol_data_urls(requests: Vec<SfSymbolRequest>) -> Vec<SfSymbolImage> {
    requests.iter().map(|_| empty_sf_symbol()).collect()
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn sf_symbol_data_urls(requests: Vec<SfSymbolRequest>) -> Vec<SfSymbolImage> {
    use base64::Engine as _;
    use objc2::AnyThread;
    use objc2_app_kit::{
        NSBitmapImageFileType, NSBitmapImageRep, NSGraphicsContext, NSImage,
        NSImageSymbolConfiguration,
    };
    use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString};

    // Two backing pixels per point, like every other raster this app hands to
    // the webview; the mask box stays at the point size, so the glyph is never
    // resampled.
    const SCALE: f64 = 2.0;
    let color_space = NSString::from_str("NSDeviceRGBColorSpace");
    let mut images = Vec::with_capacity(requests.len());
    for request in requests {
        let name = NSString::from_str(&request.name);
        let Some(symbol) =
            NSImage::imageWithSystemSymbolName_accessibilityDescription(&name, None)
        else {
            images.push(empty_sf_symbol());
            continue;
        };
        let config = NSImageSymbolConfiguration::configurationWithPointSize_weight(
            request.points.clamp(4.0, 128.0),
            request.weight.clamp(0.0, 1.0),
        );
        let Some(symbol) = symbol.imageWithSymbolConfiguration(&config) else {
            images.push(empty_sf_symbol());
            continue;
        };
        let natural = symbol.size();
        let pixels_w = (natural.width * SCALE).round() as isize;
        let pixels_h = (natural.height * SCALE).round() as isize;
        if pixels_w <= 0 || pixels_h <= 0 {
            images.push(empty_sf_symbol());
            continue;
        }
        let Some(rep) = (unsafe {
            NSBitmapImageRep::initWithBitmapDataPlanes_pixelsWide_pixelsHigh_bitsPerSample_samplesPerPixel_hasAlpha_isPlanar_colorSpaceName_bytesPerRow_bitsPerPixel(
                NSBitmapImageRep::alloc(),
                std::ptr::null_mut(),
                pixels_w,
                pixels_h,
                8,
                4,
                true,
                false,
                &color_space,
                0,
                0,
            )
        }) else {
            images.push(empty_sf_symbol());
            continue;
        };
        rep.setSize(NSSize::new(natural.width, natural.height));
        let Some(context) = NSGraphicsContext::graphicsContextWithBitmapImageRep(&rep) else {
            images.push(empty_sf_symbol());
            continue;
        };
        NSGraphicsContext::saveGraphicsState_class();
        NSGraphicsContext::setCurrentContext(Some(&context));
        symbol.drawInRect(NSRect::new(NSPoint::new(0.0, 0.0), natural));
        NSGraphicsContext::restoreGraphicsState_class();
        let Some(png) = (unsafe {
            rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
        }) else {
            images.push(empty_sf_symbol());
            continue;
        };
        let encoded = base64::engine::general_purpose::STANDARD.encode(png.to_vec());
        // Report the bitmap's own size, not the symbol's fractional natural
        // size: the webview maps the mask onto a box of this many points, and
        // only whole-pixel dimensions keep the 2x raster from being resampled
        // (a fractional box squeezes or stretches the bitmap by up to half a
        // device pixel, which softens every edge of the glyph).
        images.push(SfSymbolImage {
            url: format!("data:image/png;base64,{encoded}"),
            width: pixels_w as f64 / SCALE,
            height: pixels_h as f64 / SCALE,
        });
    }
    images
}

/// The next free "base", "base 2", "base 3"… name in `directory`, mirroring
/// the upstream navigator's uniqueURL so a new file never overwrites.
fn unique_entry_name(directory: &Path, base: &str, extension: Option<&str>) -> String {
    let mut candidate = match extension {
        Some(ext) => format!("{base}.{ext}"),
        None => base.to_string(),
    };
    let mut index = 2;
    while directory.join(&candidate).exists() {
        candidate = match extension {
            Some(ext) => format!("{base} {index}.{ext}"),
            None => format!("{base} {index}"),
        };
        index += 1;
    }
    candidate
}

fn entry_name_error(name: &str) -> AppResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.contains('/') || trimmed.contains(':') || trimmed == "." || trimmed == ".." {
        return Err(AppError { code: "invalid_name" });
    }
    Ok(())
}

/// Creates an empty Markdown file, or a folder when `is_directory`, under a
/// default name in the given folder — the upstream navigator's createItem.
#[tauri::command]
fn create_directory_entry(directory: String, is_directory: bool, contents: Option<String>) -> AppResult<FileNode> {
    let folder = PathBuf::from(directory);
    if !folder.is_dir() {
        return Err(AppError { code: "invalid_path" });
    }
    let (base, extension) = if is_directory {
        ("New Folder".to_string(), None)
    } else {
        ("Untitled".to_string(), Some("md"))
    };
    let name = unique_entry_name(&folder, &base, extension);
    let target = folder.join(&name);
    if is_directory {
        fs::create_dir(&target).map_err(io_error)?;
    } else {
        // Upstream writes .withoutOverwriting; unique_entry_name already
        // guarantees a free name, so a plain create is equivalent.
        let bytes = contents.unwrap_or_default();
        fs::write(&target, bytes.as_bytes()).map_err(io_error)?;
    }
    let name = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(FileNode {
        name,
        path: target.to_string_lossy().to_string(),
        is_directory,
        children: Vec::new(),
    })
}

/// Copies externally picked files into the navigator's folder under unique,
/// non-overwriting names — the upstream "Add Files to…" import. Sources stay
/// where they are (copy, not move); directories are skipped because the
/// navigator models folders from the workspace scan, not from loose imports.
#[tauri::command]
fn import_files(directory: String, paths: Vec<String>) -> AppResult<Vec<FileNode>> {
    let folder = PathBuf::from(&directory);
    if !folder.is_dir() {
        return Err(AppError { code: "invalid_path" });
    }
    let mut imported = Vec::new();
    for source in paths {
        let source = PathBuf::from(&source);
        if !source.is_file() {
            continue;
        }
        let Some(original) = source.file_name() else { continue };
        let original = original.to_string_lossy().to_string();
        let extension = source.extension().map(|value| value.to_string_lossy().to_string());
        let stem = source
            .file_stem()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or(original.clone());
        let name = unique_entry_name(&folder, &stem, extension.as_deref());
        let destination = folder.join(&name);
        fs::copy(&source, &destination).map_err(io_error)?;
        imported.push(FileNode {
            name,
            path: destination.to_string_lossy().to_string(),
            is_directory: false,
            children: Vec::new(),
        });
    }
    Ok(imported)
}

/// Renames (moves) a navigator entry in place, keeping a file's `.md`
/// extension when the typed name has none — the upstream renamedURL rule.
#[tauri::command]
fn rename_directory_entry(path: String, new_name: String) -> AppResult<FileNode> {
    entry_name_error(&new_name)?;
    let source = PathBuf::from(path);
    if !source.exists() {
        return Err(AppError { code: "not_found" });
    }
    let mut name = new_name.trim().to_string();
    let is_directory = source.is_dir();
    if !is_directory && !name.contains('.') {
        name += ".md";
    }
    let destination = source
        .parent()
        .ok_or(AppError { code: "invalid_path" })?
        .join(&name);
    if destination.exists() {
        return Err(AppError { code: "already_exists" });
    }
    fs::rename(&source, &destination).map_err(io_error)?;
    Ok(FileNode {
        name,
        path: destination.to_string_lossy().to_string(),
        is_directory,
        children: Vec::new(),
    })
}

#[tauri::command]
fn read_local_asset(
    base_dir: String,
    relative_path: String,
    workspace_root: Option<String>,
) -> AppResult<String> {
    let decoded = percent_decode_str(relative_path.split(['?', '#']).next().unwrap_or_default())
        .decode_utf8_lossy();
    let relative = PathBuf::from(decoded.as_ref());
    if relative.is_absolute() {
        return Err(AppError {
            code: "asset_outside_workspace",
        });
    }

    let base = PathBuf::from(base_dir)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    let boundary = workspace_root
        .map(PathBuf::from)
        .and_then(|path| path.canonicalize().ok())
        .filter(|path| base.starts_with(path))
        .unwrap_or_else(|| base.clone());
    let candidate = base
        .join(relative)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !candidate.starts_with(&boundary) || !candidate.is_file() {
        return Err(AppError {
            code: "asset_outside_workspace",
        });
    }
    let extension = candidate
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !ASSET_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError {
            code: "asset_unsupported",
        });
    }
    let metadata = fs::metadata(&candidate).map_err(io_error)?;
    if metadata.len() > MAX_ASSET_BYTES {
        return Err(AppError {
            code: "asset_too_large",
        });
    }
    let data = fs::read(&candidate).map_err(io_error)?;
    let mime = mime_guess::from_path(&candidate).first_or_octet_stream();
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(data)))
}

fn updater_endpoint(channel: &str) -> AppResult<tauri::Url> {
    let endpoint = match channel {
        "stable" => "https://github.com/jincaiw/TextMark-v1/releases/latest/download/latest.json",
        "beta" => {
            "https://github.com/jincaiw/TextMark-v1/releases/download/textmark-beta/latest.json"
        }
        _ => {
            return Err(AppError {
                code: "invalid_update_channel",
            });
        }
    };
    tauri::Url::parse(endpoint).map_err(|_| AppError { code: "io" })
}

fn build_updater(
    app: &tauri::AppHandle,
    channel: &str,
) -> AppResult<tauri_plugin_updater::Updater> {
    app.updater_builder()
        .endpoints(vec![updater_endpoint(channel)?])
        .map_err(|_| AppError { code: "io" })?
        .build()
        .map_err(|_| AppError { code: "io" })
}

fn updater_check_error(error: UpdaterError) -> AppError {
    let code = match error {
        UpdaterError::ReleaseNotFound => "update_release_not_found",
        UpdaterError::UnsupportedArch | UpdaterError::UnsupportedOs => {
            "update_unsupported_platform"
        }
        UpdaterError::TargetNotFound(_) | UpdaterError::TargetsNotFound(_) => {
            "update_target_not_found"
        }
        UpdaterError::Minisign(_) | UpdaterError::Base64(_) | UpdaterError::SignatureUtf8(_) => {
            "update_signature"
        }
        UpdaterError::Reqwest(_) | UpdaterError::Network(_) => "update_network",
        UpdaterError::Serialization(_) => "update_invalid_manifest",
        UpdaterError::UrlParse(_)
        | UpdaterError::EmptyEndpoints
        | UpdaterError::InsecureTransportProtocol => "update_endpoint",
        _ => "update_check",
    };
    AppError { code }
}

fn updater_install_error(error: UpdaterError) -> AppError {
    let mut mapped = updater_check_error(error);
    if mapped.code == "update_check" {
        mapped.code = "update_install";
    }
    mapped
}

#[tauri::command]
async fn check_update_channel(
    app: tauri::AppHandle,
    channel: String,
) -> AppResult<Option<UpdateCheck>> {
    let updater = build_updater(&app, &channel)?;
    let update = updater.check().await.map_err(updater_check_error)?;
    Ok(update.map(|value| UpdateCheck {
        version: value.version.clone(),
        date: value.date.map(|date| date.to_string()),
        notes: value.body.clone(),
    }))
}

#[tauri::command]
async fn install_update_channel(
    app: tauri::AppHandle,
    channel: String,
    download_only: Option<bool>,
) -> AppResult<()> {
    let updater = build_updater(&app, &channel)?;
    if let Some(update) = updater.check().await.map_err(updater_check_error)? {
        // download_only=true keeps the Windows installer from bouncing the app
        // when the package lands, so the frontend controls when to relaunch —
        // the upstream "ready → Relaunch Now / install on quit" two-phase
        // flow. macOS and Linux never exit from install() anyway; the
        // frontend relaunches at the user's choosing.
        let restart = !download_only.unwrap_or(false);
        let event_name = "update-download-progress";
        let progress_channel = channel.clone();
        let progress_bytes = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let progress_app = app.clone();
        let finish_app = app.clone();
        let finish_channel = progress_channel.clone();
        let finish_bytes = progress_bytes.clone();
        let update = update.restart_after_install(restart);
        update
            .download_and_install(
                move |chunk_length, total_bytes| {
                    let downloaded_bytes = progress_bytes
                        .fetch_add(chunk_length as u64, Ordering::Relaxed)
                        + chunk_length as u64;
                    let progress = total_bytes.map(|total| {
                        ((downloaded_bytes.saturating_mul(100) / total.max(1)).min(100)) as u8
                    });
                    let _ = progress_app.emit(
                        event_name,
                        UpdateDownloadProgress {
                            channel: progress_channel.clone(),
                            downloaded_bytes,
                            total_bytes,
                            progress,
                            finished: false,
                        },
                    );
                },
                move || {
                    let _ = finish_app.emit(
                        event_name,
                        UpdateDownloadProgress {
                            channel: finish_channel,
                            downloaded_bytes: finish_bytes.load(Ordering::Relaxed),
                            total_bytes: None,
                            progress: Some(100),
                            finished: true,
                        },
                    );
                },
            )
            .await
            .map_err(updater_install_error)?;
    }
    Ok(())
}

#[tauri::command]
fn open_mermaid_window(
    app: tauri::AppHandle,
    id: String,
    locale: String,
    title: Option<String>,
) -> AppResult<()> {
    if !id.starts_with("diagram-")
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    let url = format!(
        "mermaid.html?id={id}&locale={}",
        if locale == "en" { "en" } else { "zh-CN" }
    );
    // Title the popup from the nearest heading in the document; fall back to
    // the localized default when the caller provides no usable text.
    let window_title = title
        .map(|value| {
            value
                .chars()
                .filter(|character| !character.is_control())
                .take(120)
                .collect::<String>()
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            if locale == "zh-CN" {
                "图表窗口".to_string()
            } else {
                "Diagram Window".to_string()
            }
        });
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let window_handle = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            let _ = WebviewWindowBuilder::new(&window_handle, id, WebviewUrl::App(url.into()))
                .title(window_title)
                .inner_size(980.0, 720.0)
                .min_inner_size(520.0, 360.0)
                .center()
                .resizable(true)
                .build();
        });
    });
    Ok(())
}

/// Opens one table in its own ordinary window, mirroring the upstream
/// TablePreviewWindow: a read-only snapshot where Escape closes and zooming
/// never changes the document's saved text size.
#[tauri::command]
fn open_table_window(
    app: tauri::AppHandle,
    id: String,
    locale: String,
    title: Option<String>,
) -> AppResult<()> {
    if !id.starts_with("table-")
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err(AppError {
            code: "invalid_path",
        });
    }
    let url = format!(
        "table.html?id={id}&locale={}",
        if locale == "en" { "en" } else { "zh-CN" }
    );
    // Title the popup from the nearest heading in the document; fall back to
    // the localized default when the caller provides no usable text.
    let window_title = title
        .map(|value| {
            value
                .chars()
                .filter(|character| !character.is_control())
                .take(120)
                .collect::<String>()
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            if locale == "zh-CN" {
                "表格".to_string()
            } else {
                "Table".to_string()
            }
        });
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let window_handle = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            let _ = WebviewWindowBuilder::new(&window_handle, id, WebviewUrl::App(url.into()))
                .title(window_title)
                .inner_size(1100.0, 800.0)
                .min_inner_size(520.0, 360.0)
                .center()
                .resizable(true)
                .build();
        });
    });
    Ok(())
}

#[tauri::command]
fn install_cli() -> IntegrationResult {
    let Ok(exe) = std::env::current_exe() else {
        return IntegrationResult {
            ok: false,
            detail: None,
        };
    };
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    install_cli_on_platform(&exe, &home)
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(io_error)?;
        window.set_focus().map_err(io_error)?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?settings=1".into()),
    )
    .title("TextMark Settings")
    .inner_size(680.0, 520.0)
    .min_inner_size(600.0, 440.0)
    .resizable(true)
    .center()
    .build()
    .map_err(io_error)?;
    Ok(())
}

#[cfg(unix)]
fn install_cli_on_platform(exe: &Path, home: &str) -> IntegrationResult {
    let bin = Path::new(home).join(".local").join("bin");
    if fs::create_dir_all(&bin).is_err() {
        return IntegrationResult {
            ok: false,
            detail: Some(bin.display().to_string()),
        };
    }
    let mut ok = true;
    for name in ["textmark", "tm", "text-mark"] {
        let link = bin.join(name);
        let _ = fs::remove_file(&link);
        if std::os::unix::fs::symlink(exe, &link).is_err() {
            ok = false;
        }
    }
    IntegrationResult {
        ok,
        detail: Some(bin.display().to_string()),
    }
}

#[cfg(windows)]
fn install_cli_on_platform(exe: &Path, home: &str) -> IntegrationResult {
    let dir = Path::new(home)
        .join("AppData")
        .join("Local")
        .join("TextMark")
        .join("bin");
    if fs::create_dir_all(&dir).is_err() {
        return IntegrationResult {
            ok: false,
            detail: Some(dir.display().to_string()),
        };
    }
    let mut ok = true;
    for name in ["textmark", "tm", "text-mark"] {
        let target = dir.join(format!("{name}.cmd"));
        let script = format!("@echo off\r\n\"{}\" %*\r\n", exe.display());
        if fs::write(&target, script).is_err() {
            ok = false;
        }
    }
    // A command shim is only useful if future terminals can locate it. Keep
    // this user-scoped: it does not require elevation and never changes PATH
    // when installation itself failed. Existing terminals must be reopened.
    if ok {
        let path = std::env::var("PATH").unwrap_or_default();
        let directory = dir.display().to_string();
        if !path
            .split(';')
            .any(|entry| entry.eq_ignore_ascii_case(&directory))
        {
            ok = Command::new("reg.exe")
                .args([
                    "add",
                    "HKCU\\Environment",
                    "/v",
                    "Path",
                    "/t",
                    "REG_EXPAND_SZ",
                    "/d",
                ])
                .arg(if path.is_empty() {
                    directory.clone()
                } else {
                    format!("{path};{directory}")
                })
                .arg("/f")
                .status()
                .map(|status| status.success())
                .unwrap_or(false);
        }
    }
    IntegrationResult {
        ok,
        detail: Some(dir.display().to_string()),
    }
}

#[cfg(not(any(unix, windows)))]
fn install_cli_on_platform(_exe: &Path, _home: &str) -> IntegrationResult {
    IntegrationResult {
        ok: false,
        detail: None,
    }
}

#[tauri::command]
fn set_default_handler() -> IntegrationResult {
    set_default_handler_on_platform()
}

#[cfg(target_os = "linux")]
fn set_default_handler_on_platform() -> IntegrationResult {
    match Command::new("xdg-mime")
        .arg("default")
        .arg("app.textmark.desktop")
        .args(["text/markdown", "text/x-markdown"])
        .status()
    {
        Ok(s) if s.success() => IntegrationResult {
            ok: true,
            detail: None,
        },
        _ => IntegrationResult {
            ok: false,
            detail: None,
        },
    }
}

#[cfg(not(target_os = "linux"))]
fn set_default_handler_on_platform() -> IntegrationResult {
    // Installers register file associations on macOS (DMG/Quick Look) and
    // Windows (MSI/NSIS); the portable archives intentionally leave the
    // system defaults untouched.
    IntegrationResult {
        ok: false,
        detail: None,
    }
}

/// Removes the stale "show tab bar" preference that macOS persisted for the
/// removed `tabbingIdentifier` (`app.textmark.desktop.documents`). AppKit
/// remembers a once-shown native tab bar per tabbing identifier and restored
/// it on every LaunchServices launch, hiding the traffic lights and covering
/// the top of the toolbar. The window no longer opts into native tabbing, so
/// the leftover key is dropped to guarantee a clean chrome on user machines.
///
/// Keeps the native document title visible and centered by AppKit, while
/// forcing the traffic lights visible and
/// disabling automatic window tabbing. Binaries linked against older macOS
/// SDKs otherwise shipped with the lights suppressed on LaunchServices
/// launches, so this is re-applied (idempotently) after setup and once more a
/// beat later, after the window server has settled.
#[cfg(target_os = "macos")]
fn restore_macos_window_chrome() {
    use objc2_app_kit::{NSApplication, NSWindow, NSWindowButton, NSWindowTitleVisibility};
    use objc2_foundation::{MainThreadMarker, NSString, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    let key =
        NSString::from_str("NSWindowTabbingShoudShowTabBarKey-app.textmark.desktop.documents");
    defaults.removeObjectForKey(&key);

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    NSWindow::setAllowsAutomaticWindowTabbing(false, mtm);
    let app = NSApplication::sharedApplication(mtm);
    for window in app.windows() {
        window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        for kind in [
            NSWindowButton::CloseButton,
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            if let Some(button) = window.standardWindowButton(kind) {
                button.setHidden(false);
                button.setEnabled(true);
            }
        }
    }
}

/// Gives a document window the same chrome the launch window has.
///
/// Tauri's config path makes the main window's title bar transparent, but a
/// window built at runtime only gets `NSWindowStyleMaskFullSizeContentView`;
/// with `titlebarAppearsTransparent` left false AppKit paints the title bar
/// over the content, so the webview starts one bar-height down. A document
/// opened from Finder therefore showed the file name beside the traffic lights
/// and pushed the whole toolbar 40pt lower than the reference, whose toolbar
/// begins at the window's top edge. Windows built before setup finishes are
/// also covered by `restore_macos_window_chrome`; this handles the ones built
/// afterwards.
#[cfg(target_os = "macos")]
fn style_macos_document_window(window: &tauri::WebviewWindow) {
    let handle = window.clone();
    let _ = window.run_on_main_thread(move || {
        use objc2_app_kit::{NSWindow, NSWindowButton, NSWindowTitleVisibility};
        let Ok(pointer) = handle.ns_window() else {
            return;
        };
        if pointer.is_null() {
            return;
        }
        // SAFETY: `ns_window` returns the live NSWindow backing this webview
        // window, and the closure runs on AppKit's main thread.
        let window = unsafe { &*(pointer as *const NSWindow) };
        window.setTitlebarAppearsTransparent(true);
        window.setTitleVisibility(NSWindowTitleVisibility::Hidden);
        for kind in [
            NSWindowButton::CloseButton,
            NSWindowButton::MiniaturizeButton,
            NSWindowButton::ZoomButton,
        ] {
            if let Some(button) = window.standardWindowButton(kind) {
                button.setHidden(false);
                button.setEnabled(true);
            }
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn style_macos_document_window(_window: &tauri::WebviewWindow) {}

/// AppKit matches menu key equivalents against characters rather than key
/// codes, so a few reference shortcuts spell characters muda's accelerator
/// parser cannot express (⌘: is Shift+; rendered as a colon). Those are set on
/// the installed NSMenuItems directly.
#[cfg(target_os = "macos")]
fn apply_native_menu_key_equivalents(app: &tauri::AppHandle, editable: bool, dirty: bool) {
    use objc2_app_kit::{NSApplication, NSEventModifierFlags, NSMenu, NSMenuItem};
    use objc2_foundation::NSString;
    fn find_item(menu: &NSMenu, title: &str) -> Option<objc2::rc::Retained<NSMenuItem>> {
        for index in 0..menu.numberOfItems() {
            let Some(item) = menu.itemAtIndex(index) else {
                continue;
            };
            if item.title().to_string() == title {
                return Some(item);
            }
            if let Some(submenu) = item.submenu()
                && let Some(found) = find_item(&submenu, title)
            {
                return Some(found);
            }
        }
        None
    }
    let _ = app.run_on_main_thread(move || {
        let Some(mtm) = objc2::MainThreadMarker::new() else {
            return;
        };
        let application = NSApplication::sharedApplication(mtm);
        let Some(main_menu) = application.mainMenu() else {
            return;
        };
        for (title, key) in [
            ("显示拼写和语法", ":"),
            ("Show Spelling and Grammar", ":"),
        ] {
            if let Some(item) = find_item(&main_menu, title) {
                item.setKeyEquivalent(&NSString::from_str(key));
                item.setKeyEquivalentModifierMask(NSEventModifierFlags::Command);
            }
        }
        // The reference's Go menu carries AppKit's standard arrow and page
        // keys on its four navigation rows. They are drawn in the menu's
        // shortcut column as ▲ ▼ ↑ ↓ (the private-use function-key
        // characters) and take no Command modifier: the reference's AX tree
        // reports them with key equivalents U+F700/U+F701/U+F72C/U+F72D and
        // the no-command mask, so a bare arrow press reaches the responder
        // chain exactly as it does in AppKit's own text views.
        for (title, key) in [
            ("向上", "\u{F700}"),
            ("Up", "\u{F700}"),
            ("向下", "\u{F701}"),
            ("Down", "\u{F701}"),
            ("上一页", "\u{F72C}"),
            ("Page Up", "\u{F72C}"),
            ("下一页", "\u{F72D}"),
            ("Page Down", "\u{F72D}"),
        ] {
            if let Some(item) = find_item(&main_menu, title) {
                item.setKeyEquivalent(&NSString::from_str(key));
                item.setKeyEquivalentModifierMask(NSEventModifierFlags::empty());
            }
        }
        // AppKit reveals "Close All" only while Option is held: it is the
        // alternate of "Close", carrying the same ⌘W with Option added. muda
        // has no alternate-item support, so the pair is marked here — then the
        // File menu matches the reference, which lists Close alone until the
        // Option key is down.
        if let Some(close) = find_item(&main_menu, "关闭").or_else(|| find_item(&main_menu, "Close")) {
            close.setKeyEquivalent(&NSString::from_str("w"));
            close.setKeyEquivalentModifierMask(NSEventModifierFlags::Command);
            close.setAlternate(false);
        }
        for title in ["全部关闭", "Close All"] {
            if let Some(item) = find_item(&main_menu, title) {
                item.setKeyEquivalent(&NSString::from_str("w"));
                item.setKeyEquivalentModifierMask(
                    NSEventModifierFlags::Command.union(NSEventModifierFlags::Option),
                );
                item.setAlternate(true);
            }
        }
        // The reference's Share row carries the system share glyph, drawn as a
        // template symbol so it follows the menu's text colour (it greys with
        // the row). AppKit does not draw a symbol image straight from
        // NSMenuItem — the menu needs a plain image — so the symbol is rendered
        // into a 16pt bitmap first. NSMenuItem keeps that inside the regular
        // text indent instead of widening the menu's icon gutter, which is the
        // single-row indent the reference shows.
        for title in ["共享", "Share"] {
            let Some(item) = find_item(&main_menu, title) else {
                continue;
            };
            let name = NSString::from_str("square.and.arrow.up");
            let Some(symbol) =
                objc2_app_kit::NSImage::imageWithSystemSymbolName_accessibilityDescription(
                    &name, None,
                )
            else {
                continue;
            };
            let side = 16.0_f64;
            // The reference draws a semibold symbol: at a 14.5pt fit the
            // default weight inks 176px of 81-level grey against the
            // reference's 207 of 81, medium reaches 181, and semibold 217.
            let config = objc2_app_kit::NSImageSymbolConfiguration::configurationWithPointSize_weight(
                13.0,
                unsafe { objc2_app_kit::NSFontWeightSemibold },
            );
            let Some(symbol) = symbol.imageWithSymbolConfiguration(&config) else {
                continue;
            };
            let natural = symbol.size();
            // The reference's glyph inks 18x23 device pixels; the symbol's
            // artwork carries about a point of padding inside its own bounds,
            // so fitting it to 14.5pt lands exactly on that ink box.
            let scale = (14.5 / natural.width).min(14.5 / natural.height);
            let drawn = objc2_foundation::NSSize::new(natural.width * scale, natural.height * scale);
            // NSImage's lockFocus drawing path is deprecated; the block-based
            // image draws the symbol into a 16pt bitmap without a focused view.
            let handler = block2::RcBlock::new(move |_rect: objc2_foundation::NSRect| -> objc2::runtime::Bool {
                symbol.drawInRect(objc2_foundation::NSRect::new(
                    objc2_foundation::NSPoint::new((side - drawn.width) / 2.0, (side - drawn.height) / 2.0),
                    drawn,
                ));
                objc2::runtime::Bool::YES
            });
            let image = objc2_app_kit::NSImage::imageWithSize_flipped_drawingHandler(
                objc2_foundation::NSSize::new(side, side),
                false,
                &handler,
            );
            image.setTemplate(true);
            item.setImage(Some(&image));
        }
        // The reference validates its document commands like an NSDocument:
        // in read (preview) mode all three storage rows are grey, and while
        // editing they follow the document's modified state.
        for (title, enabled) in [
            ("存储…", editable && dirty),
            ("Save…", editable && dirty),
            ("存储为…", editable),
            ("Save As…", editable),
            ("复原到已存储的版本", editable && dirty),
            ("Revert to Saved", editable && dirty),
        ] {
            if let Some(item) = find_item(&main_menu, title) {
                item.setEnabled(enabled);
            }
        }
        // AppKit needs to know which submenus play the window and help roles;
        // the window menu is what gains the system's tiling and window-list
        // commands, and the help menu gains its search field.
        for (title, window_role) in [("窗口", true), ("Window", true), ("帮助", false), ("Help", false)] {
            let Some(item) = find_item(&main_menu, title) else {
                continue;
            };
            let Some(submenu) = item.submenu() else {
                continue;
            };
            if window_role {
                application.setWindowsMenu(Some(&submenu));
            } else {
                application.setHelpMenu(Some(&submenu));
            }
        }
    });
}

/// Dispatches one of AppKit's standard text-editing actions down the responder
/// chain. WKWebView implements these selectors for its editable content, so
/// the spelling and substitution commands act on the focused editor exactly as
/// they would in a native text view.
#[cfg(target_os = "macos")]
fn dispatch_responder_action(selector: &'static std::ffi::CStr) {
    use objc2::runtime::Sel;
    use objc2_app_kit::NSApplication;
    let Some(mtm) = objc2::MainThreadMarker::new() else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    let action = Sel::register(selector);
    // SAFETY: the selector is a documented NSResponder action, and AppKit
    // resolves it against the first responder; both target and sender are nil,
    // which the signature allows.
    unsafe {
        app.sendAction_to_from(action, None, None);
    }
}

#[cfg(target_os = "macos")]
fn show_macos_share_picker(window_pointer: usize, source: &str, path: Option<&str>) {
    use objc2::{AnyThread, rc::Retained, runtime::AnyObject};
    use objc2_app_kit::{NSSharingServicePicker, NSWindow};
    use objc2_foundation::{NSArray, NSRectEdge, NSString, NSURL};

    // SAFETY: Tauri supplies the NSWindow pointer for this live WebviewWindow,
    // and this helper is invoked on AppKit's main thread.
    let window = unsafe { &*(window_pointer as *const NSWindow) };
    let Some(view) = window.contentView() else {
        return;
    };
    // A saved document shares its file URL so the picker header shows the
    // document icon, name and size like the reference app. Unsaved documents
    // (or a path that has since disappeared) fall back to the source text.
    let item: Retained<AnyObject> = match path.filter(|path| !path.is_empty() && std::path::Path::new(path).is_file()) {
        Some(path) => NSURL::fileURLWithPath(&NSString::from_str(path)).into(),
        None => NSString::from_str(source).into(),
    };
    let items = NSArray::from_retained_slice(&[item]);
    // SAFETY: both NSString and NSURL conform to NSPasteboardWriting, as
    // required by the picker. AppKit owns the visible picker after it is shown.
    let picker =
        unsafe { NSSharingServicePicker::initWithItems(NSSharingServicePicker::alloc(), &items) };
    picker.showRelativeToRect_ofView_preferredEdge(view.bounds(), &view, NSRectEdge::MaxY);
}

#[tauri::command]
fn share_source(window: tauri::WebviewWindow, source: String, path: Option<String>) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let pointer = window.ns_window().map_err(io_error)? as usize;
        window
            .run_on_main_thread(move || show_macos_share_picker(pointer, &source, path.as_deref()))
            .map_err(io_error)?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, source, path);
        Err(AppError {
            code: "unsupported",
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(WatchState::default())
        .manage(PendingOpenPaths::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let request = parse_launch_request(args.into_iter().skip(1), Path::new(&cwd));
            if request.new_window {
                for entry in request.paths {
                    let _ = open_document_window(app.clone(), entry.path);
                }
            } else if !request.paths.is_empty() {
                if let Some(state) = app.try_state::<PendingOpenPaths>() {
                    enqueue_pending_open_paths(&state, request.paths.clone());
                }
                let _ = app.emit("open-paths", request.paths);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());
    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Startup must stay non-blocking: the menu is built without the
            // recent-files list (no I/O on the main thread), and the list is
            // loaded on a background thread and merged in when ready. This
            // avoids stalling `applicationDidFinishLaunching` on macOS Group
            // Container (re)provisioning, which kept the window from showing.
            #[cfg(target_os = "macos")]
            restore_macos_window_chrome();
            let menu = build_menu(app.handle(), "zh-CN", &MenuUiState::default(), &[])?;
            app.set_menu(menu)?;
            #[cfg(target_os = "macos")]
            apply_native_menu_key_equivalents(app.handle(), false, false);
            let handle = app.handle().clone();
            #[cfg(target_os = "macos")]
            {
                let chrome_handle = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(600));
                    let _ = chrome_handle.run_on_main_thread(restore_macos_window_chrome);
                });
            }
            std::thread::spawn(move || {
                let recent_files = load_recent_files();
                let app_handle = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    if let Ok(menu) =
                        build_menu(&app_handle, "zh-CN", &MenuUiState::default(), &recent_files)
                    {
                        let _ = app_handle.set_menu(menu);
                        #[cfg(target_os = "macos")]
                        apply_native_menu_key_equivalents(&app_handle, false, false);
                    }
                });
            });
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            // AppKit's spelling and substitution commands are handled by the
            // focused WebView's responder chain, not by the frontend.
            #[cfg(target_os = "macos")]
            {
                let native_action: Option<&'static std::ffi::CStr> = match id {
                    "spell-show-panel" => Some(c"showGuessPanel:"),
                    "spell-check-now" => Some(c"checkSpelling:"),
                    "spell-toggle-continuous" => Some(c"toggleContinuousSpellChecking:"),
                    "spell-toggle-grammar" => Some(c"toggleGrammarChecking:"),
                    "spell-toggle-autocorrect" => Some(c"toggleAutomaticSpellingCorrection:"),
                    "substitutions-panel" => Some(c"showSubstitutionsPanel:"),
                    "substitutions-smart-insert" => Some(c"toggleSmartInsertDelete:"),
                    "substitutions-smart-quotes" => Some(c"toggleAutomaticQuoteSubstitution:"),
                    "substitutions-smart-dashes" => Some(c"toggleAutomaticDashSubstitution:"),
                    "substitutions-smart-links" => Some(c"toggleAutomaticLinkDetection:"),
                    "substitutions-data-detection" => Some(c"toggleAutomaticDataDetection:"),
                    "substitutions-text-replacement" => Some(c"toggleAutomaticTextReplacement:"),
                    _ => None,
                };
                if let Some(selector) = native_action {
                    dispatch_responder_action(selector);
                    return;
                }
            }
            let command = if let Some(path) = id
                .strip_prefix("recent-")
                .and_then(|index| index.parse::<usize>().ok())
                .and_then(|index| load_recent_files().get(index).cloned())
            {
                format!("open-recent:{path}")
            } else {
                id.to_string()
            };
            // Menu commands belong to the key window. Broadcasting them to
            // every WebView makes a save, close, or mode switch happen in
            // several documents at once. MenuEvent carries no window, so the
            // focused window is resolved here; only a menu-bar invocation with
            // every window blurred falls back to the app-wide broadcast.
            let focused = app
                .webview_windows()
                .into_values()
                .find(|window| window.is_focused().unwrap_or(false));
            match focused {
                Some(window) => {
                    let _ = window.emit("menu-command", command);
                }
                None => {
                    let _ = app.emit("menu-command", command);
                }
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Ok(mut watchers) = window.app_handle().state::<WatchState>().0.lock() {
                    watchers.remove(window.label());
                }
                if window.label() != "main" {
                    let label = window.label().to_string();
                    std::thread::spawn(move || {
                        for _ in 0..10 {
                            let _ = remove_session_window_from_manifest(&label);
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                    });
                }
            }
            if let WindowEvent::CloseRequested { .. } = event
                && window.label() != "main"
            {
                // CloseRequested is emitted before the frontend's
                // preventDefault/async close handshake. Remove the native
                // label immediately; waiting for the window to disappear
                // would miss this event because the frontend temporarily
                // keeps the window alive while saving.
                let _ = remove_session_window_from_manifest(window.label());
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            resolve_open_path,
            startup_request,
            drain_pending_open_paths,
            #[cfg(feature = "e2e")]
            test_open_path,
            write_text_file,
            save_export_bytes,
            save_pasted_image,
            read_clipboard_text,
            rename_pasted_image,
            temp_export_path,
            list_directory,
            create_directory_entry,
            rename_directory_entry,
            read_local_asset,
            check_update_channel,
            install_update_channel,
            open_mermaid_window,
            open_table_window,
            open_settings_window,
            install_cli,
            set_default_handler,
            refresh_menu,
            record_recent_file,
            clear_recent_files,
            list_recent_files,
            discover_applications,
            file_icon_data_url,
            sf_symbol_data_urls,
            import_files,
            share_source,
            load_settings,
            save_settings,
            load_session_manifest,
            save_session_snapshot,
            remove_session_window,
            remove_current_window_session,
            open_session_window,
            watch_paths,
            open_external_application,
            show_in_file_manager,
            open_document_window
        ]);
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building TextMark");
    app.run(|app, event| {
        #[cfg(not(target_os = "macos"))]
        let _ = (&app, &event);
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = urls
                .into_iter()
                .filter_map(|url| {
                    if url.scheme() == "file" {
                        url.to_file_path().ok()
                    } else {
                        None
                    }
                })
                .filter_map(|path| resolve_open_path(path.to_string_lossy().to_string()).ok())
                .collect::<Vec<_>>();
            if !paths.is_empty() {
                if let Some(state) = app.try_state::<PendingOpenPaths>() {
                    enqueue_pending_open_paths(&state, paths.clone());
                }
                let _ = app.emit("open-paths", paths);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_sort_orders_digit_runs_numerically() {
        assert_eq!(natural_cmp("file2", "file10"), std::cmp::Ordering::Less);
        assert_eq!(natural_cmp("file10", "file2"), std::cmp::Ordering::Greater);
        assert_eq!(natural_cmp("File2", "file2"), std::cmp::Ordering::Equal);
        // Padded zeros do not reorder equal values.
        assert_eq!(natural_cmp("file007", "file7"), std::cmp::Ordering::Equal);
        assert_eq!(natural_cmp("a1b", "a1c"), std::cmp::Ordering::Less);
        assert_eq!(natural_cmp("第2章", "第10章"), std::cmp::Ordering::Less);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn mac_markdown_editor_detection_matches_the_reference_menu() {
        let document = |role: &str, utis: &[&str], extensions: &[&str]| {
            let mut document = plist::Dictionary::new();
            document.insert(
                "CFBundleTypeRole".into(),
                plist::Value::String(role.to_string()),
            );
            document.insert(
                "LSItemContentTypes".into(),
                plist::Value::Array(
                    utis.iter()
                        .map(|uti| plist::Value::String((*uti).to_string()))
                        .collect(),
                ),
            );
            document.insert(
                "CFBundleTypeExtensions".into(),
                plist::Value::Array(
                    extensions
                        .iter()
                        .map(|extension| plist::Value::String((*extension).to_string()))
                        .collect(),
                ),
            );
            let mut info = plist::Dictionary::new();
            info.insert(
                "CFBundleDocumentTypes".into(),
                plist::Value::Array(vec![plist::Value::Dictionary(document)]),
            );
            info
        };
        assert!(mac_application_is_markdown_editor(&document(
            "Editor",
            &["net.daringfireball.markdown"],
            &[]
        )));
        assert!(mac_application_is_markdown_editor(&document(
            "Editor",
            &[],
            &["md", "markdown"]
        )));
        // Viewers and plain-text-only editors stay out; the reference admits
        // the latter by bundle identifier (TextEdit) and excludes the rest
        // (Numbers, Word, Excel).
        assert!(!mac_application_is_markdown_editor(&document(
            "Viewer",
            &["net.daringfireball.markdown"],
            &[]
        )));
        assert!(!mac_application_is_markdown_editor(&document(
            "Editor",
            &["public.plain-text"],
            &["txt"]
        )));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn mac_open_with_keeps_own_and_curated_identity() {
        assert!(is_own_application_bundle("app.textmark.desktop"));
        assert!(is_own_application_bundle(
            "app.textmark.desktop.personaltest"
        ));
        assert!(!is_own_application_bundle("doc.md-preview"));
        assert_eq!(
            curated_application_id("Visual Studio Code.app"),
            Some("vscode")
        );
        assert_eq!(curated_application_id("CotEditor.app"), Some("coteditor"));
        // Localized bundles and uncurated apps stay keyed by bundle id.
        assert_eq!(curated_application_id("妙言.app"), None);
        assert_eq!(curated_application_id("MiaoYan.app"), None);
    }

    #[test]
    fn toolbar_menu_label_tracks_visibility_in_both_locales() {
        assert_eq!(toolbar_menu_labels(false), ("隐藏工具栏", "Hide Toolbar"));
        assert_eq!(toolbar_menu_labels(true), ("显示工具栏", "Show Toolbar"));
    }

    #[test]
    fn updater_accepts_only_stable_and_beta_channels() {
        assert_eq!(
            updater_endpoint("stable").unwrap().as_str(),
            "https://github.com/jincaiw/TextMark-v1/releases/latest/download/latest.json"
        );
        assert_eq!(
            updater_endpoint("beta").unwrap().as_str(),
            "https://github.com/jincaiw/TextMark-v1/releases/download/textmark-beta/latest.json"
        );
        assert_eq!(
            updater_endpoint("nightly").unwrap_err().code,
            "invalid_update_channel"
        );
    }

    #[test]
    fn legacy_data_migration_copies_missing_files_without_overwriting() {
        let root = std::env::temp_dir().join(format!(
            "textmark-data-migration-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let legacy = root.join("legacy");
        let current = root.join("current");
        fs::create_dir_all(&legacy).unwrap();
        fs::create_dir_all(&current).unwrap();
        fs::write(legacy.join("settings-v3.json"), "{\"theme\":\"dark\"}").unwrap();
        fs::write(legacy.join("session-v1.json"), "{\"version\":1}").unwrap();
        fs::write(
            current.join("session-v1.json"),
            "{\"version\":1,\"updatedAt\":7}",
        )
        .unwrap();

        migrate_legacy_data(&legacy, &current);

        assert_eq!(
            fs::read_to_string(current.join("settings-v3.json")).unwrap(),
            "{\"theme\":\"dark\"}"
        );
        // Newer state in the active directory always wins.
        assert_eq!(
            fs::read_to_string(current.join("session-v1.json")).unwrap(),
            "{\"version\":1,\"updatedAt\":7}"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn write_probe_rejects_directories_it_cannot_create() {
        let root = std::env::temp_dir().join(format!(
            "textmark-data-probe-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        assert!(is_writable_directory(&root));
        // The probe file never survives a successful check.
        assert!(!root.join(".textmark-write-probe").exists());

        // A regular file in the way means the directory can never be created.
        let blocked = root.join("file");
        fs::write(&blocked, "x").unwrap();
        assert!(!is_writable_directory(&blocked.join("nested")));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn accepts_supported_document_extensions_case_insensitively() {
        assert!(is_markdown(Path::new("README.md")));
        assert!(is_markdown(Path::new("NOTES.MARKDOWN")));
        assert!(is_markdown(Path::new("draft.txt")));
        assert!(is_markdown(Path::new("component.mdx")));
        assert!(is_markdown(Path::new("COMPONENT.MDX")));
        assert!(!is_markdown(Path::new("payload.html")));
    }

    #[test]
    fn removing_one_session_window_preserves_other_windows_and_is_idempotent() {
        let manifest = SessionManifest {
            version: 1,
            updated_at: 42,
            windows: vec![
                SessionWindowSnapshot {
                    window_id: "main".into(),
                    documents: vec!["/tmp/main.md".into()],
                    active_index: 0,
                    workspace_path: None,
                    geometry: None,
                },
                SessionWindowSnapshot {
                    window_id: "secondary-a".into(),
                    documents: vec!["/tmp/a.md".into()],
                    active_index: 0,
                    workspace_path: None,
                    geometry: None,
                },
                SessionWindowSnapshot {
                    window_id: "secondary-b".into(),
                    documents: vec!["/tmp/b.md".into()],
                    active_index: 0,
                    workspace_path: None,
                    geometry: None,
                },
            ],
        };

        let removed = remove_window_from_manifest(manifest, "secondary-a");
        assert_eq!(
            removed
                .windows
                .iter()
                .map(|window| window.window_id.as_str())
                .collect::<Vec<_>>(),
            vec!["main", "secondary-b"]
        );

        let unchanged = remove_window_from_manifest(removed.clone(), "missing");
        assert_eq!(unchanged.windows.len(), removed.windows.len());
        assert_eq!(unchanged.updated_at, 42);
    }

    #[test]
    fn session_snapshot_deduplicates_documents_and_clamps_active_index() {
        let snapshot = normalize_session_snapshot(SessionWindowSnapshot {
            window_id: "secondary".into(),
            documents: vec!["/tmp/a.md".into(), "/tmp/a.md".into(), "/tmp/b.md".into()],
            active_index: 99,
            workspace_path: None,
            geometry: None,
        })
        .unwrap();
        assert_eq!(snapshot.documents, vec!["/tmp/a.md", "/tmp/b.md"]);
        assert_eq!(snapshot.active_index, 1);
    }

    #[test]
    fn empty_session_snapshot_is_not_persisted() {
        assert!(
            normalize_session_snapshot(SessionWindowSnapshot {
                window_id: "empty".into(),
                documents: Vec::new(),
                active_index: 0,
                workspace_path: None,
                geometry: None,
            })
            .is_none()
        );
    }

    #[test]
    fn session_geometry_is_optional_for_legacy_snapshots() {
        let snapshot: SessionWindowSnapshot = serde_json::from_str(
            r#"{"windowId":"main","documents":["/tmp/readme.md"],"activeIndex":0,"workspacePath":null}"#,
        )
        .unwrap();
        assert!(snapshot.geometry.is_none());
    }

    #[test]
    fn session_geometry_accepts_legacy_geometry_without_monitor_metadata() {
        let snapshot: SessionWindowSnapshot = serde_json::from_str(
            r#"{"windowId":"main","documents":["/tmp/readme.md"],"activeIndex":0,"workspacePath":null,"geometry":{"x":-1200,"y":40,"width":1000,"height":700}}"#,
        )
        .unwrap();
        let geometry = snapshot.geometry.unwrap();
        assert_eq!(geometry.x, -1200);
        assert!(geometry.monitor.is_none());
    }

    #[test]
    fn pending_open_paths_are_deduplicated_and_drained_in_order() {
        let state = PendingOpenPaths::default();
        let first = OpenPathRequest {
            path: "/tmp/one.md".into(),
            is_directory: false,
        };
        let second = OpenPathRequest {
            path: "/tmp/two.md".into(),
            is_directory: false,
        };
        enqueue_pending_open_paths(&state, [first.clone(), second.clone(), first.clone()]);
        let drained = state.0.lock().unwrap().drain(..).collect::<Vec<_>>();
        assert_eq!(drained, vec![first, second]);
    }

    #[test]
    fn cli_accepts_files_folders_multiple_paths_and_new_window() {
        let root = std::env::temp_dir().join(format!("textmark-cli-{}", std::process::id()));
        fs::create_dir_all(root.join("folder")).unwrap();
        fs::write(root.join("one.md"), "# One").unwrap();
        fs::write(root.join("skip.html"), "no").unwrap();
        let request = parse_launch_request(
            [
                "--new-window".into(),
                "one.md".into(),
                "folder".into(),
                "one.md".into(),
                "skip.html".into(),
            ],
            &root,
        );
        assert!(request.new_window);
        assert_eq!(request.paths.len(), 2);
        assert!(!request.paths[0].is_directory);
        assert!(request.paths[1].is_directory);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn open_path_resolution_accepts_markdown_and_directories_but_rejects_other_files() {
        let root = std::env::temp_dir().join(format!(
            "textmark-open-path-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("folder.with.dots")).unwrap();
        fs::write(root.join("guide.md"), "# Guide").unwrap();
        fs::write(root.join("page.html"), "<h1>unsafe</h1>").unwrap();

        let document =
            resolve_open_path(root.join("guide.md").to_string_lossy().to_string()).unwrap();
        assert!(!document.is_directory);
        let directory =
            resolve_open_path(root.join("folder.with.dots").to_string_lossy().to_string()).unwrap();
        assert!(directory.is_directory);
        let error =
            resolve_open_path(root.join("page.html").to_string_lossy().to_string()).unwrap_err();
        assert_eq!(error.code, "invalid_document");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_asset_allow_list_excludes_executable_formats() {
        assert!(ASSET_EXTENSIONS.contains(&"png"));
        assert!(!ASSET_EXTENSIONS.contains(&"svg"));
        assert!(!ASSET_EXTENSIONS.contains(&"html"));
    }

    #[test]
    fn file_navigator_treats_application_and_document_bundles_as_packages() {
        for path in [
            "/Applications/Editor.app",
            "/Library/Frameworks/Example.framework",
            "/Users/example/Documents/Notes.rtfd",
            "/Users/example/Photos.photoslibrary",
        ] {
            assert!(is_package_directory(Path::new(path)), "{path}");
        }
        assert!(!is_package_directory(Path::new("/Users/example/Notes")));
    }

    #[test]
    fn external_application_catalog_lists_launch_services_editors_and_ai_apps() {
        let applications = discover_applications();
        let ids = applications
            .iter()
            .map(|application| application.id.clone())
            .collect::<HashSet<_>>();
        assert_eq!(ids.len(), applications.len(), "application ids must be unique");
        for id in ["system", "codex", "claude", "chatgpt"] {
            assert!(ids.contains(id), "missing application catalog entry: {id}");
        }
        let system_default = applications
            .iter()
            .find(|application| application.id == "system")
            .unwrap();
        assert_eq!(system_default.kind, "system");
        assert!(system_default.available);

        #[cfg(target_os = "macos")]
        {
            let editors = applications
                .iter()
                .filter(|application| application.kind == "editor")
                .collect::<Vec<_>>();
            // macOS discovers Launch Services' ordered candidate list, so the
            // installed set varies by machine; the invariants do not.
            for editor in &editors {
                assert!(editor.available);
                assert!(
                    editor
                        .mac_app
                        .as_deref()
                        .is_some_and(|path| path.ends_with(".app")),
                    "{} must carry its bundle path",
                    editor.id
                );
                assert!(!is_own_application_bundle(&editor.id));
            }
            if Path::new("/Applications/Visual Studio Code.app").is_dir() {
                assert!(ids.contains("vscode"), "curated id must survive discovery");
            }
            for ignored in IGNORED_OPEN_WITH_BUNDLES {
                assert!(!ids.contains(*ignored));
            }
        }
        #[cfg(not(target_os = "macos"))]
        for id in ["vscode", "cursor", "windsurf", "trae", "notepadpp", "obsidian"] {
            assert!(ids.contains(id), "missing application catalog entry: {id}");
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_application_ids_map_to_launch_services_names() {
        for (id, expected) in [
            ("vscode", "Visual Studio Code"),
            ("cursor", "Cursor"),
            ("windsurf", "Windsurf"),
            ("trae", "Trae"),
            ("zed", "Zed"),
            ("sublime", "Sublime Text"),
            ("obsidian", "Obsidian"),
            ("typora", "Typora"),
            ("markedit", "MarkEdit"),
            ("mellow", "Mellow"),
            ("taio", "Taio"),
            ("bbedit", "BBEdit"),
            ("nova", "Nova"),
            ("coteditor", "CotEditor"),
            ("textmate", "TextMate"),
            ("macvim", "MacVim"),
            ("xcode", "Xcode"),
            ("textedit", "TextEdit"),
        ] {
            assert_eq!(known_application_name(id), Some(expected));
        }
        assert_eq!(known_application_name("system"), None);
        assert_eq!(known_application_name("unknown-editor"), None);
    }

    #[test]
    fn external_open_rejects_missing_non_markdown_and_unknown_targets() {
        let root = std::env::temp_dir().join(format!(
            "textmark-external-open-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let markdown = root.join("guide.md");
        let non_markdown = root.join("page.html");
        fs::write(&markdown, "# Guide").unwrap();
        fs::write(&non_markdown, "<h1>Page</h1>").unwrap();

        assert_eq!(
            open_external_application(
                root.join("missing.md").to_string_lossy().to_string(),
                "vscode".into()
            )
            .unwrap_err()
            .code,
            "not_found"
        );
        assert_eq!(
            open_external_application(non_markdown.to_string_lossy().to_string(), "vscode".into())
                .unwrap_err()
                .code,
            "invalid_document"
        );
        assert_eq!(
            open_external_application(
                markdown.to_string_lossy().to_string(),
                "unknown-editor".into()
            )
            .unwrap_err()
            .code,
            "invalid_path"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn atomic_save_rejects_stale_revisions() {
        let path =
            std::env::temp_dir().join(format!("textmark-conflict-{}.md", std::process::id()));
        fs::write(&path, "first").unwrap();
        let original = read_text_file(path.to_string_lossy().to_string()).unwrap();
        fs::write(&path, "external").unwrap();
        let error = write_text_file(
            path.to_string_lossy().to_string(),
            "local".into(),
            Some(original.revision),
            false,
        )
        .unwrap_err();
        assert_eq!(error.code, "save_conflict");
        assert_eq!(fs::read_to_string(&path).unwrap(), "external");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn atomic_save_rejects_read_only_targets_without_replacing_them() {
        let path =
            std::env::temp_dir().join(format!("textmark-read-only-save-{}.md", std::process::id()));
        fs::write(&path, "original").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            permissions.set_mode(permissions.mode() & !0o222);
        }
        #[cfg(not(unix))]
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();

        let result = write_text_file(
            path.to_string_lossy().to_string(),
            "replacement".into(),
            None,
            true,
        );

        assert_eq!(result.unwrap_err().code, "read_only");
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");

        let mut permissions = fs::metadata(&path).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            permissions.set_mode(0o600);
        }
        #[cfg(not(unix))]
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn atomic_export_rejects_read_only_targets_without_replacing_them() {
        let path = std::env::temp_dir().join(format!(
            "textmark-read-only-export-{}.html",
            std::process::id()
        ));
        fs::write(&path, "original export").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            permissions.set_mode(permissions.mode() & !0o222);
        }
        #[cfg(not(unix))]
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();

        let result = save_export_bytes(path.to_string_lossy().to_string(), b"replacement".to_vec());

        assert_eq!(result.unwrap_err().code, "read_only");
        assert_eq!(fs::read_to_string(&path).unwrap(), "original export");

        let mut permissions = fs::metadata(&path).unwrap().permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            permissions.set_mode(0o600);
        }
        #[cfg(not(unix))]
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn atomic_save_returns_the_new_disk_revision() {
        let path = std::env::temp_dir().join(format!("textmark-save-{}.md", std::process::id()));
        let saved = write_text_file(
            path.to_string_lossy().to_string(),
            "saved".into(),
            None,
            true,
        )
        .unwrap();
        assert_eq!(saved.contents, "saved");
        assert!(!saved.revision.is_empty());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn headless_thumbnail_writes_a_png() {
        let base = std::env::temp_dir();
        let input = base.join(format!("textmark-thumbnail-{}.md", std::process::id()));
        let output = base.join(format!("textmark-thumbnail-{}.png", std::process::id()));
        fs::write(&input, "# TextMark\n\nA portable Markdown preview.").unwrap();
        render_thumbnail(&input, &output, 128).unwrap();
        assert!(fs::metadata(&output).unwrap().len() > 100);
        fs::remove_file(input).unwrap();
        fs::remove_file(output).unwrap();
    }

    #[test]
    fn headless_thumbnail_rejects_oversized_sources_before_reading() {
        let base = std::env::temp_dir();
        let input = base.join(format!(
            "textmark-thumbnail-large-{}.md",
            std::process::id()
        ));
        let output = base.join(format!(
            "textmark-thumbnail-large-{}.png",
            std::process::id()
        ));
        let file = fs::File::create(&input).unwrap();
        file.set_len(32 * 1024 * 1024 + 1).unwrap();
        let error = render_thumbnail(&input, &output, 128).unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(!output.exists());
        fs::remove_file(input).unwrap();
    }

    #[test]
    fn temporary_export_paths_are_unique_and_sanitize_extensions() {
        let first = unique_temp_export_path("pdf");
        let second = unique_temp_export_path("pdf");
        assert_ne!(first, second);
        assert!(first.ends_with(".pdf"));
        assert!(unique_temp_export_path("../PNG!").ends_with(".PNG"));
    }

    #[test]
    fn pasted_images_are_normalized_numbered_and_linked_relative_to_the_document() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let first = save_pasted_image(
            document.to_string_lossy().to_string(),
            bytes.get_ref().clone(),
        )
        .unwrap();
        let second =
            save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
        assert_eq!(first.relative_path, "Pictures/guide/1.png");
        assert_eq!(second.relative_path, "Pictures/guide/2.png");
        assert!(root.join("Pictures/guide/1.png").is_file());
        assert!(root.join("Pictures/guide/2.png").is_file());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pasted_images_reject_non_image_data() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-invalid-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let error = save_pasted_image(
            document.to_string_lossy().to_string(),
            b"not an image".to_vec(),
        )
        .unwrap_err();
        assert_eq!(error.code, "asset_unsupported");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pasted_images_can_be_renamed_only_inside_their_document_folder() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-rename-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let saved =
            save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
        let original = read_text_file(document.to_string_lossy().to_string()).unwrap();
        let renamed = rename_pasted_image(
            document.to_string_lossy().to_string(),
            saved.relative_path,
            "diagram.PNG".into(),
            "# Guide\n\n![diagram](Pictures/guide/diagram.png)".into(),
            Some(original.revision),
        )
        .unwrap();
        assert_eq!(renamed.relative_path, "Pictures/guide/diagram.png");
        assert!(
            renamed
                .document
                .contents
                .contains("Pictures/guide/diagram.png")
        );
        assert!(root.join("Pictures/guide/diagram.png").is_file());
        assert!(!root.join("Pictures/guide/1.png").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pasted_image_rename_rolls_back_when_the_document_changed_on_disk() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-rollback-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let original = read_text_file(document.to_string_lossy().to_string()).unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let saved =
            save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
        fs::write(&document, "# External change").unwrap();

        let error = rename_pasted_image(
            document.to_string_lossy().to_string(),
            saved.relative_path,
            "diagram".into(),
            "# Guide\n\n![diagram](Pictures/guide/diagram.png)".into(),
            Some(original.revision),
        )
        .unwrap_err();
        assert_eq!(error.code, "save_conflict");
        assert!(root.join("Pictures/guide/1.png").is_file());
        assert!(!root.join("Pictures/guide/diagram.png").exists());
        assert_eq!(fs::read_to_string(&document).unwrap(), "# External change");
        fs::remove_dir_all(root).unwrap();
    }
}
