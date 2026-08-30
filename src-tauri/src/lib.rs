use atomic_write_file::AtomicWriteFile;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use font8x8::UnicodeFonts;
use image::{ImageBuffer, ImageFormat, Rgb};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher, event::ModifyKind};
use percent_encoding::{NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};
use serde::Serialize;
use std::collections::HashSet;
use std::{
    fs,
    io::{Cursor, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        LazyLock, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder,
    menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};
use tauri_plugin_updater::UpdaterExt;

const MARKDOWN_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "rmd", "txt",
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
    id: &'static str,
    name: &'static str,
    kind: &'static str,
    available: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IntegrationResult {
    ok: bool,
    detail: Option<String>,
}

#[derive(Clone, Copy, Default)]
struct MenuUiState {
    appearance: &'static str,   // "system" | "light" | "dark"
    content_width: &'static str, // "normal" | "full"
    sidebar_mode: &'static str,  // "outline" | "files"
    sidebar_visible: bool,
    always_on_top: bool,
}

#[derive(Serialize)]
struct UpdateCheck {
    version: String,
}

#[derive(Clone, Debug, Serialize)]
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
struct WatchState(Mutex<Option<RecommendedWatcher>>);

fn settings_path() -> AppResult<PathBuf> {
    #[cfg(feature = "e2e")]
    if let Some(directory) = std::env::var_os("TEXTMARK_E2E_CONFIG_DIR").map(PathBuf::from) {
        fs::create_dir_all(&directory).map_err(io_error)?;
        return Ok(directory.join("settings-v3.json"));
    }
    #[cfg(target_os = "macos")]
    let directory = dirs::home_dir()
        .map(|home| home.join("Library/Group Containers/group.app.textmark.desktop"));
    #[cfg(not(target_os = "macos"))]
    let directory = dirs::config_dir().map(|root| root.join("TextMark"));
    let directory = directory.ok_or(AppError {
        code: "invalid_path",
    })?;
    fs::create_dir_all(&directory).map_err(io_error)?;
    Ok(directory.join("settings-v3.json"))
}

fn recent_files_path() -> AppResult<PathBuf> {
    let directory = settings_path()?
        .parent()
        .map(Path::to_path_buf)
        .ok_or(AppError { code: "invalid_path" })?;
    Ok(directory.join("recent.json"))
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
    let Ok(path) = recent_files_path() else { return Vec::new() };
    let Ok(contents) = fs::read_to_string(path) else { return Vec::new() };
    serde_json::from_str::<Vec<String>>(&contents).unwrap_or_default()
}

fn recent_cache() -> std::sync::MutexGuard<'static, Option<Vec<String>>> {
    RECENT_FILES_CACHE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
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
    app: tauri::AppHandle,
    state: State<'_, WatchState>,
    paths: Vec<String>,
) -> AppResult<()> {
    let handle = app.clone();
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
                let _ = handle.emit("disk-change", DiskChangeEvent { kind, paths });
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
            watcher
                .watch(parent, RecursiveMode::NonRecursive)
                .map_err(io_error)?;
        }
    }
    *state.0.lock().map_err(io_error)? = Some(watcher);
    Ok(())
}

fn spawn_known_application(path: &str, application_id: &str) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let name = match application_id {
            "vscode" => "Visual Studio Code",
            "cursor" => "Cursor",
            "zed" => "Zed",
            "sublime" => "Sublime Text",
            "bbedit" => "BBEdit",
            "nova" => "Nova",
            "coteditor" => "CotEditor",
            "textmate" => "TextMate",
            "macvim" => "MacVim",
            "xcode" => "Xcode",
            "textedit" => "TextEdit",
            _ => {
                return Err(AppError {
                    code: "invalid_path",
                });
            }
        };
        let mut command = Command::new("open");
        command.args(["-a", name]).arg(path);
        command
    };
    #[cfg(not(target_os = "macos"))]
    let mut command = {
        let executable = match application_id {
            "vscode" => "code",
            "cursor" => "cursor",
            "zed" => "zed",
            "sublime" => {
                if cfg!(windows) {
                    "subl.exe"
                } else {
                    "subl"
                }
            }
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

#[tauri::command]
fn open_document_window(app: tauri::AppHandle, path: String) -> AppResult<()> {
    let request = resolve_open_path(path)?;
    let canonical = PathBuf::from(&request.path);
    let is_directory = request.is_directory;
    let label = format!(
        "document-{}",
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let encoded = utf8_percent_encode(&canonical.to_string_lossy(), NON_ALPHANUMERIC).to_string();
    let query = if is_directory { "folder" } else { "open" };
    WebviewWindowBuilder::new(
        &app,
        label,
        WebviewUrl::App(format!("index.html?{query}={encoded}").into()),
    )
    .title(canonical.file_name().unwrap_or_default().to_string_lossy())
    .inner_size(1100.0, 720.0)
    .min_inner_size(720.0, 480.0)
    .center()
    .resizable(true)
    .build()
    .map(|_| ())
    .map_err(io_error)
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
    let state_item = |id: &str, checked: bool, zh_text: &str, en_text: &str, accelerator: Option<&str>| {
        let prefix = if checked { "✓ " } else { "" };
        let mut builder = MenuItemBuilder::with_id(
            id,
            if zh { format!("{prefix}{zh_text}") } else { format!("{prefix}{en_text}") },
        );
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
    let new_tab = item("new-tab", "新建标签页…", "New Tab…", Some("CmdOrCtrl+T"))?;
    let new_document = item(
        "new-document",
        "新建文稿",
        "New Document",
        Some("CmdOrCtrl+N"),
    )?;
    let close_tab = item("close-tab", "关闭", "Close", Some("CmdOrCtrl+W"))?;
    let open = item("open", "打开…", "Open…", Some("CmdOrCtrl+O"))?;
    let open_folder = item(
        "open-folder",
        "打开文件夹…",
        "Open Folder…",
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let save = item("save", "存储", "Save", Some("CmdOrCtrl+S"))?;
    let save_as = item("save-as", "存储为…", "Save As…", Some("CmdOrCtrl+Shift+S"))?;
    let revert = item("revert", "复原到已存储的版本", "Revert to Saved", None)?;
    let export = item("export", "导出…", "Export…", None)?;
    let export_pdf = item("export-pdf", "导出为 PDF…", "Export as PDF…", None)?;
    let print = item("print", "打印…", "Print…", Some("CmdOrCtrl+P"))?;

    // Open Recent submenu (dynamic; rebuilt by refresh_menu)
    let mut recent_builder = SubmenuBuilder::new(app, if zh { "打开最近使用" } else { "Open Recent" });
    for (index, path) in recent_files.iter().enumerate() {
        let recent_item = MenuItemBuilder::with_id(format!("recent-{index}"), path.clone()).build(app)?;
        recent_builder = recent_builder.item(&recent_item);
    }
    if !recent_files.is_empty() {
        recent_builder = recent_builder.separator();
    }
    let clear_recent = MenuItemBuilder::with_id("clear-recent", if zh { "清除菜单" } else { "Clear Menu" }).build(app)?;
    let open_recent = recent_builder.item(&clear_recent).build()?;

    let file_builder = SubmenuBuilder::new(app, if zh { "文件" } else { "File" })
        .items(&[&new_tab, &new_document, &close_tab])
        .separator()
        .items(&[&open, &open_folder])
        .item(&open_recent)
        .separator()
        .items(&[&save, &save_as, &revert])
        .separator()
        .items(&[&export, &export_pdf])
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
    let find_next = item("find-next", "查找下一个", "Find Next", Some("CmdOrCtrl+G"))?;
    let find_prev = item(
        "find-prev",
        "查找上一个",
        "Find Previous",
        Some("CmdOrCtrl+Shift+G"),
    )?;
    let edit_mode = item(
        "edit-mode",
        "切换编辑模式",
        "Toggle Edit Mode",
        Some("CmdOrCtrl+E"),
    )?;
    let preferences = item("preferences", "设置…", "Settings…", Some("CmdOrCtrl+Comma"))?;
    let edit_builder = SubmenuBuilder::new(app, if zh { "编辑" } else { "Edit" })
        .items(&[&undo, &redo])
        .separator()
        .cut_with_text(if zh { "剪切" } else { "Cut" })
        .copy_with_text(if zh { "拷贝" } else { "Copy" })
        .paste_with_text(if zh { "粘贴" } else { "Paste" })
        .select_all_with_text(if zh { "全选" } else { "Select All" })
        .separator()
        .items(&[&find, &find_next, &find_prev])
        .separator()
        .item(&edit_mode);
    #[cfg(not(target_os = "macos"))]
    let edit_builder = edit_builder.separator().item(&preferences);
    let edit = edit_builder.build()?;

    // View menu
    let sidebar = item(
        "sidebar",
        "切换边栏",
        "Toggle Sidebar",
        Some("CmdOrCtrl+L"),
    )?;
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
        "大纲",
        "Outline",
        sidebar_pane_accel("2"),
    )?;
    let sidebar_files = state_item(
        "sidebar-files",
        state.sidebar_visible && state.sidebar_mode == "files",
        "文件夹",
        "Folders",
        sidebar_pane_accel("3"),
    )?;
    // Keep Cmd/Ctrl+I available for italic while editing. The inspector remains
    // available from the View menu and the preview toolbar.
    let inspector = item("inspector", "显示简介", "Get Info", None)?;
    let show_toolbar = item("show-toolbar", "显示工具栏", "Show Toolbar", None)?;
    let zoom_in = item("zoom-in", "放大", "Zoom In", Some("CmdOrCtrl++"))?;
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
        "窗口置顶",
        "Always on Top",
        if cfg!(target_os = "macos") {
            Some("CmdOrCtrl+Control+T")
        } else {
            None
        },
    )?;

    let appearance_auto = state_item("appearance-auto", state.appearance == "system", "自动", "Automatic", None)?;
    let appearance_light = state_item("appearance-light", state.appearance == "light", "浅色", "Light", None)?;
    let appearance_dark = state_item("appearance-dark", state.appearance == "dark", "深色", "Dark", None)?;
    let appearance = SubmenuBuilder::new(app, if zh { "外观" } else { "Appearance" })
        .items(&[&appearance_auto, &appearance_light, &appearance_dark])
        .build()?;

    let width_normal = state_item("width-normal", state.content_width == "normal", "标准", "Normal", None)?;
    let width_full = state_item("width-full", state.content_width == "full", "全宽", "Full Width", None)?;
    let content_width = SubmenuBuilder::new(app, if zh { "内容宽度" } else { "Content Width" })
        .items(&[&width_normal, &width_full])
        .build()?;

    let view_builder = SubmenuBuilder::new(app, if zh { "显示" } else { "View" })
        .item(&appearance)
        .item(&content_width)
        .separator()
        .items(&[&show_toolbar, &customize])
        .separator()
        .items(&[&sidebar, &sidebar_hide, &sidebar_outline, &sidebar_files])
        .separator()
        .item(&inspector)
        .separator()
        .items(&[&zoom_in, &zoom_out, &zoom_reset])
        .separator()
        .item(&always_on_top)
        .separator()
        .item(&edit_mode);
    #[cfg(target_os = "macos")]
    let view_builder = view_builder.separator().fullscreen_with_text(if zh {
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
            &item("format-code", "行内代码", "Inline Code", Some("CmdOrCtrl+Shift+M"))?,
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
            &item("format-quote", "引用", "Block Quote", Some("CmdOrCtrl+Quote"))?,
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
            &item("go-top", "文稿开头", "Top of Document", Some("CmdOrCtrl+Up"))?,
            &item("go-bottom", "文稿结尾", "Bottom of Document", Some("CmdOrCtrl+Down"))?,
        ])
        .build()?;

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let window = SubmenuBuilder::new(app, if zh { "窗口" } else { "Window" })
        .minimize_with_text(if zh { "最小化" } else { "Minimize" })
        .maximize_with_text(if zh { "缩放" } else { "Zoom" })
        .build()?;

    let help_item = item("help", "TextMark 帮助", "TextMark Help", None)?;
    let check_updates = item(
        "check-updates",
        "检查更新…",
        "Check for Updates…",
        None,
    )?;
    let install_cli = item("install-cli", "安装命令行工具…", "Install CLI…", None)?;
    let crash_reports = item(
        "crash-reports",
        "发送匿名崩溃报告",
        "Send Anonymous Crash Reports",
        None,
    )?;
    #[cfg(target_os = "macos")]
    let help_builder = SubmenuBuilder::new(app, if zh { "帮助" } else { "Help" }).item(&help_item);
    #[cfg(not(target_os = "macos"))]
    let help_builder = SubmenuBuilder::new(app, if zh { "帮助" } else { "Help" })
        .item(&help_item)
        .separator()
        .items(&[&check_updates, &install_cli, &crash_reports])
        .separator()
        .about_with_text(
            if zh {
                "关于 TextMark"
            } else {
                "About TextMark"
            },
            None,
        );
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
        .separator()
        .items(&[&check_updates, &install_cli, &crash_reports])
        .separator()
        .item(&preferences)
        .separator()
        .services_with_text(if zh { "服务" } else { "Services" })
        .separator()
        .hide_with_text(if zh {
            "隐藏 TextMark"
        } else {
            "Hide TextMark"
        })
        .hide_others_with_text(if zh { "隐藏其他" } else { "Hide Others" })
        .separator()
        .quit_with_text(if zh {
            "退出 TextMark"
        } else {
            "Quit TextMark"
        })
        .build()?;

    #[cfg(target_os = "macos")]
    return MenuBuilder::new(app)
        .items(&[&application, &file, &edit, &view, &format, &go, &window, &help])
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

#[tauri::command]
fn refresh_menu(
    app: tauri::AppHandle,
    locale: String,
    appearance: String,
    content_width: String,
    sidebar_mode: String,
    sidebar_visible: bool,
    always_on_top: bool,
) -> AppResult<()> {
    let state = MenuUiState {
        appearance: match appearance.as_str() {
            "light" => "light",
            "dark" => "dark",
            _ => "system",
        },
        content_width: match content_width.as_str() {
            "full" => "full",
            _ => "normal",
        },
        sidebar_mode: match sidebar_mode.as_str() {
            "files" => "files",
            _ => "outline",
        },
        sidebar_visible,
        always_on_top,
    };
    let menu = build_menu(&app, &locale, &state, &load_recent_files()).map_err(io_error)?;
    app.set_menu(menu).map_err(io_error)?;
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
            || Path::new("/System/Applications").join(app).exists())
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

#[cfg(target_os = "macos")]
fn mac_application_path(app: &str) -> Option<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications"), PathBuf::from("/System/Applications")];
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Applications"));
    }
    roots.into_iter().map(|root| root.join(app)).find(|path| path.is_dir())
}

#[cfg(target_os = "macos")]
fn mac_editor_role_handlers() -> HashSet<String> {
    use core_foundation::{
        array::{CFArray, CFArrayRef},
        base::TCFType,
        string::{CFString, CFStringRef},
    };

    #[link(name = "CoreServices", kind = "framework")]
    unsafe extern "C" {
        fn LSCopyAllRoleHandlersForContentType(content_type: CFStringRef, roles: u32) -> CFArrayRef;
    }

    const LS_ROLES_EDITOR: u32 = 0x0000_0004;
    let mut handlers = HashSet::new();
    for content_type in ["net.daringfireball.markdown", "public.plain-text"] {
        let content_type = CFString::new(content_type);
        // SAFETY: LaunchServices returns a retained CFArray of CFString bundle
        // identifiers for the supplied, valid content type and roles mask.
        let raw = unsafe { LSCopyAllRoleHandlersForContentType(content_type.as_concrete_TypeRef(), LS_ROLES_EDITOR) };
        if raw.is_null() {
            continue;
        }
        // SAFETY: `LSCopy...` follows the Create Rule and the values are CFString.
        let values = unsafe { CFArray::<CFString>::wrap_under_create_rule(raw) };
        handlers.extend(values.iter().map(|value| value.to_string()));
    }
    handlers
}

#[cfg(target_os = "macos")]
fn mac_editor_available(commands: &[&str], mac_app: Option<&str>) -> bool {
    static EDITOR_HANDLERS: LazyLock<HashSet<String>> = LazyLock::new(mac_editor_role_handlers);
    let Some(app_path) = mac_app.and_then(mac_application_path) else {
        return application_available(commands, None);
    };
    // If LaunchServices is unavailable, retain the established existence
    // fallback rather than hiding every editor from the UI.
    if EDITOR_HANDLERS.is_empty() {
        return true;
    }
    let bundle_id = plist::Value::from_file(app_path.join("Contents/Info.plist"))
        .ok()
        .and_then(|value| value.as_dictionary()?.get("CFBundleIdentifier")?.as_string().map(str::to_owned));
    bundle_id.is_some_and(|bundle_id| EDITOR_HANDLERS.contains(&bundle_id))
}

#[cfg(not(target_os = "macos"))]
fn mac_editor_available(commands: &[&str], mac_app: Option<&str>) -> bool {
    application_available(commands, mac_app)
}

#[tauri::command]
fn discover_applications() -> Vec<ExternalApplication> {
    [
        ("system", "System Default", "system", true, &[][..], None),
        (
            "vscode",
            "Visual Studio Code",
            "editor",
            false,
            &["code"][..],
            Some("Visual Studio Code.app"),
        ),
        (
            "cursor",
            "Cursor",
            "editor",
            false,
            &["cursor"][..],
            Some("Cursor.app"),
        ),
        ("zed", "Zed", "editor", false, &["zed"][..], Some("Zed.app")),
        (
            "sublime",
            "Sublime Text",
            "editor",
            false,
            &["subl", "sublime_text"][..],
            Some("Sublime Text.app"),
        ),
        (
            "bbedit",
            "BBEdit",
            "editor",
            false,
            &[][..],
            Some("BBEdit.app"),
        ),
        ("nova", "Nova", "editor", false, &[][..], Some("Nova.app")),
        (
            "coteditor",
            "CotEditor",
            "editor",
            false,
            &[][..],
            Some("CotEditor.app"),
        ),
        (
            "textmate",
            "TextMate",
            "editor",
            false,
            &["mate"][..],
            Some("TextMate.app"),
        ),
        (
            "macvim",
            "MacVim",
            "editor",
            false,
            &["mvim"][..],
            Some("MacVim.app"),
        ),
        (
            "xcode",
            "Xcode",
            "editor",
            false,
            &["xed"][..],
            Some("Xcode.app"),
        ),
        (
            "textedit",
            "TextEdit",
            "editor",
            false,
            &[][..],
            Some("TextEdit.app"),
        ),
        (
            "codex",
            "Codex",
            "llm",
            false,
            &["codex"][..],
            Some("Codex.app"),
        ),
        (
            "claude",
            "Claude",
            "llm",
            false,
            &["claude"][..],
            Some("Claude.app"),
        ),
        (
            "chatgpt",
            "ChatGPT",
            "llm",
            false,
            &["chatgpt"][..],
            Some("ChatGPT.app"),
        ),
    ]
    .into_iter()
    .map(
        |(id, name, kind, always, commands, mac_app)| ExternalApplication {
            id,
            name,
            kind,
            available: always
                || if kind == "editor" {
                    mac_editor_available(commands, mac_app)
                } else {
                    application_available(commands, mac_app)
                },
        },
    )
    .collect()
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
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
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
    if target.exists() && !force {
        let current = fs::metadata(&target).map_err(io_error)?;
        if let Some(expected) = expected_revision
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
    let mut file = AtomicWriteFile::open(&target).map_err(io_error)?;
    file.write_all(&bytes).map_err(io_error)?;
    file.commit().map_err(io_error)
}

/// Normalizes clipboard pixels to PNG and stores them next to the Markdown
/// document. The relative link is deliberately stable across platforms.
#[tauri::command]
fn save_pasted_image(document_path: String, bytes: Vec<u8>) -> AppResult<SavedPastedImage> {
    if bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError { code: "asset_too_large" });
    }
    let document = PathBuf::from(document_path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    if !document.is_file() || !is_markdown(&document) {
        return Err(AppError { code: "invalid_document" });
    }
    let image = image::load_from_memory(&bytes).map_err(|_| AppError { code: "asset_unsupported" })?;
    let mut png = Cursor::new(Vec::new());
    image
        .write_to(&mut png, ImageFormat::Png)
        .map_err(io_error)?;
    let encoded = png.into_inner();
    if encoded.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError { code: "asset_too_large" });
    }
    let stem = document
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or(AppError { code: "invalid_path" })?;
    let directory = document
        .parent()
        .ok_or(AppError { code: "invalid_path" })?
        .join("Pictures")
        .join(stem);
    fs::create_dir_all(&directory).map_err(io_error)?;
    let sequence = PASTED_IMAGE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = directory.join(format!(".textmark-paste-{}-{sequence}.tmp", std::process::id()));
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
        return Err(AppError { code: "invalid_document" });
    }
    let stem = document
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or(AppError { code: "invalid_path" })?;
    let directory = document
        .parent()
        .ok_or(AppError { code: "invalid_path" })?
        .join("Pictures")
        .join(stem);
    let expected_prefix = format!("Pictures/{stem}/");
    if !relative_path.starts_with(&expected_prefix)
        || relative_path[expected_prefix.len()..].contains(['/', '\\'])
        || !relative_path.ends_with(".png")
    {
        return Err(AppError { code: "invalid_path" });
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
        return Err(AppError { code: "invalid_path" });
    }
    let filename = format!("{cleaned}.png");
    let target = directory.join(&filename);
    if target.exists() {
        return Err(AppError { code: "invalid_path" });
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
    scan_directory(&canonical, 5)
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
    let endpoint = if channel == "beta" {
        "https://github.com/jincaiw/TextMark-v1/releases/download/textmark-beta/latest.json"
    } else {
        "https://github.com/jincaiw/TextMark-v1/releases/latest/download/latest.json"
    };
    tauri::Url::parse(endpoint).map_err(|_| AppError { code: "io" })
}

#[tauri::command]
async fn check_update_channel(
    app: tauri::AppHandle,
    channel: String,
) -> AppResult<Option<UpdateCheck>> {
    let updater = app
        .updater_builder()
        .endpoints(vec![updater_endpoint(&channel)?])
        .map_err(|_| AppError { code: "io" })?
        .build()
        .map_err(|_| AppError { code: "io" })?;
    let update = updater.check().await.map_err(|_| AppError { code: "io" })?;
    Ok(update.map(|value| UpdateCheck {
        version: value.version.clone(),
    }))
}

#[tauri::command]
async fn install_update_channel(app: tauri::AppHandle, channel: String) -> AppResult<()> {
    let updater = app
        .updater_builder()
        .endpoints(vec![updater_endpoint(&channel)?])
        .map_err(|_| AppError { code: "io" })?
        .build()
        .map_err(|_| AppError { code: "io" })?;
    if let Some(update) = updater.check().await.map_err(|_| AppError { code: "io" })? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|_| AppError { code: "io" })?;
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

#[tauri::command]
fn install_cli() -> IntegrationResult {
    let Ok(exe) = std::env::current_exe() else {
        return IntegrationResult { ok: false, detail: None };
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
    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html?settings=1".into()))
        .title("TextMark Settings")
        .inner_size(680.0, 520.0)
        .min_inner_size(600.0, 440.0)
        .resizable(true)
        .center()
        .build()
        .map_err(io_error)?;
    Ok(())
}

#[tauri::command]
fn print_current_window(window: tauri::WebviewWindow) -> AppResult<()> {
    // Wry exposes the system print dialog on macOS. Unlike an image-backed
    // export, this keeps text and vector diagrams selectable in “Save as PDF”.
    window.print().map_err(io_error)
}

#[cfg(unix)]
fn install_cli_on_platform(exe: &Path, home: &str) -> IntegrationResult {
    let bin = Path::new(home).join(".local").join("bin");
    if fs::create_dir_all(&bin).is_err() {
        return IntegrationResult { ok: false, detail: Some(bin.display().to_string()) };
    }
    let mut ok = true;
    for name in ["textmark", "tm", "text-mark"] {
        let link = bin.join(name);
        let _ = fs::remove_file(&link);
        if std::os::unix::fs::symlink(exe, &link).is_err() {
            ok = false;
        }
    }
    IntegrationResult { ok, detail: Some(bin.display().to_string()) }
}

#[cfg(windows)]
fn install_cli_on_platform(exe: &Path, home: &str) -> IntegrationResult {
    let dir = Path::new(home).join("AppData").join("Local").join("TextMark").join("bin");
    if fs::create_dir_all(&dir).is_err() {
        return IntegrationResult { ok: false, detail: Some(dir.display().to_string()) };
    }
    let mut ok = true;
    for name in ["textmark", "tm", "text-mark"] {
        let target = dir.join(format!("{name}.cmd"));
        let script = format!("@echo off\r\n\"{}\" %*\r\n", exe.display());
        if fs::write(&target, script).is_err() {
            ok = false;
        }
    }
    IntegrationResult { ok, detail: Some(dir.display().to_string()) }
}

#[cfg(not(any(unix, windows)))]
fn install_cli_on_platform(_exe: &Path, _home: &str) -> IntegrationResult {
    IntegrationResult { ok: false, detail: None }
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
        .args(["text/markdown", "text/x-markdown", "text/plain"])
        .status()
    {
        Ok(s) if s.success() => IntegrationResult { ok: true, detail: None },
        _ => IntegrationResult { ok: false, detail: None },
    }
}

#[cfg(not(target_os = "linux"))]
fn set_default_handler_on_platform() -> IntegrationResult {
    // Installers register file associations on macOS (DMG/Quick Look) and
    // Windows (MSI/NSIS); the portable archives intentionally leave the
    // system defaults untouched.
    IntegrationResult { ok: false, detail: None }
}

/// Removes the stale "show tab bar" preference that macOS persisted for the
/// removed `tabbingIdentifier` (`app.textmark.desktop.documents`). AppKit
/// remembers a once-shown native tab bar per tabbing identifier and restored
/// it on every LaunchServices launch, hiding the traffic lights and covering
/// the top of the toolbar. The window no longer opts into native tabbing, so
/// the leftover key is dropped to guarantee a clean chrome on user machines.
///
/// Also forces the title and traffic lights visible and disables automatic
/// window tabbing at runtime. Binaries linked against older macOS SDKs
/// otherwise shipped with the lights suppressed on LaunchServices launches,
/// so this is re-applied (idempotently) right after setup and once more a
/// beat later, after the window server has settled.
#[cfg(target_os = "macos")]
fn restore_macos_window_chrome() {
    use objc2_app_kit::{
        NSApplication, NSWindow, NSWindowButton, NSWindowTitleVisibility,
    };
    use objc2_foundation::{MainThreadMarker, NSString, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    let key = NSString::from_str("NSWindowTabbingShoudShowTabBarKey-app.textmark.desktop.documents");
    defaults.removeObjectForKey(&key);

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    NSWindow::setAllowsAutomaticWindowTabbing(false, mtm);
    let app = NSApplication::sharedApplication(mtm);
    for window in app.windows() {
        window.setTitleVisibility(NSWindowTitleVisibility::Visible);
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

#[cfg(target_os = "macos")]
fn show_macos_share_picker(window_pointer: usize, source: &str) {
    use objc2::{AnyThread, rc::Retained, runtime::AnyObject};
    use objc2_app_kit::{NSSharingServicePicker, NSWindow};
    use objc2_foundation::{NSArray, NSRectEdge, NSString};

    // SAFETY: Tauri supplies the NSWindow pointer for this live WebviewWindow,
    // and this helper is invoked on AppKit's main thread.
    let window = unsafe { &*(window_pointer as *const NSWindow) };
    let Some(view) = window.contentView() else {
        return;
    };
    let source: Retained<AnyObject> = NSString::from_str(source).into();
    let items = NSArray::from_retained_slice(&[source]);
    // SAFETY: NSString conforms to NSPasteboardWriting, as required by the
    // picker. AppKit owns the visible picker after it is shown.
    let picker = unsafe { NSSharingServicePicker::initWithItems(NSSharingServicePicker::alloc(), &items) };
    picker.showRelativeToRect_ofView_preferredEdge(view.bounds(), &view, NSRectEdge::MaxY);
}

#[tauri::command]
fn share_source(window: tauri::WebviewWindow, source: String) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let pointer = window.ns_window().map_err(io_error)? as usize;
        window
            .run_on_main_thread(move || show_macos_share_picker(pointer, &source))
            .map_err(io_error)?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, source);
        Err(AppError { code: "unsupported" })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(WatchState::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let request = parse_launch_request(args.into_iter().skip(1), Path::new(&cwd));
            if request.new_window {
                for entry in request.paths {
                    let _ = open_document_window(app.clone(), entry.path);
                }
            } else if !request.paths.is_empty() {
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
    builder
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
                    if let Ok(menu) = build_menu(
                        &app_handle,
                        "zh-CN",
                        &MenuUiState::default(),
                        &recent_files,
                    ) {
                        let _ = app_handle.set_menu(menu);
                    }
                });
            });
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if let Some(path) = id
                .strip_prefix("recent-")
                .and_then(|index| index.parse::<usize>().ok())
                .and_then(|index| load_recent_files().get(index).cloned())
            {
                let _ = app.emit("menu-command", format!("open-recent:{path}"));
                return;
            }
            let _ = app.emit("menu-command", id);
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            resolve_open_path,
            startup_request,
            write_text_file,
            save_export_bytes,
            save_pasted_image,
            rename_pasted_image,
            temp_export_path,
            list_directory,
            read_local_asset,
            check_update_channel,
            install_update_channel,
            open_mermaid_window,
            open_settings_window,
            print_current_window,
            install_cli,
            set_default_handler,
            refresh_menu,
            record_recent_file,
            clear_recent_files,
            discover_applications,
            share_source,
            load_settings,
            save_settings,
            watch_paths,
            open_external_application,
            show_in_file_manager,
            open_document_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running TextMark");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_document_extensions_case_insensitively() {
        assert!(is_markdown(Path::new("README.md")));
        assert!(is_markdown(Path::new("NOTES.MARKDOWN")));
        assert!(is_markdown(Path::new("draft.txt")));
        assert!(!is_markdown(Path::new("payload.html")));
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
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(root.join("folder.with.dots")).unwrap();
        fs::write(root.join("guide.md"), "# Guide").unwrap();
        fs::write(root.join("page.html"), "<h1>unsafe</h1>").unwrap();

        let document = resolve_open_path(root.join("guide.md").to_string_lossy().to_string()).unwrap();
        assert!(!document.is_directory);
        let directory = resolve_open_path(root.join("folder.with.dots").to_string_lossy().to_string()).unwrap();
        assert!(directory.is_directory);
        let error = resolve_open_path(root.join("page.html").to_string_lossy().to_string()).unwrap_err();
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
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let first = save_pasted_image(document.to_string_lossy().to_string(), bytes.get_ref().clone()).unwrap();
        let second = save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
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
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let error = save_pasted_image(document.to_string_lossy().to_string(), b"not an image".to_vec()).unwrap_err();
        assert_eq!(error.code, "asset_unsupported");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pasted_images_can_be_renamed_only_inside_their_document_folder() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-rename-test-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let saved = save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
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
        assert!(renamed.document.contents.contains("Pictures/guide/diagram.png"));
        assert!(root.join("Pictures/guide/diagram.png").is_file());
        assert!(!root.join("Pictures/guide/1.png").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pasted_image_rename_rolls_back_when_the_document_changed_on_disk() {
        let root = std::env::temp_dir().join(format!(
            "textmark-paste-rollback-test-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let document = root.join("guide.md");
        fs::write(&document, "# Guide").unwrap();
        let original = read_text_file(document.to_string_lossy().to_string()).unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(ImageBuffer::from_pixel(1, 1, Rgb([8, 9, 10])))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let saved = save_pasted_image(document.to_string_lossy().to_string(), bytes.into_inner()).unwrap();
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
