use atomic_write_file::AtomicWriteFile;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use font8x8::UnicodeFonts;
use image::{ImageBuffer, Rgb};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher, event::ModifyKind};
use percent_encoding::{NON_ALPHANUMERIC, percent_decode_str, utf8_percent_encode};
use serde::Serialize;
use std::collections::HashSet;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::{
    Emitter, State, WebviewUrl, WebviewWindowBuilder,
    menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
};
use tauri_plugin_updater::UpdaterExt;

const MARKDOWN_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "rmd", "txt",
];
const ASSET_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"];
const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;

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
    let canonical = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    let is_directory = canonical.is_dir();
    if !is_directory && (!canonical.is_file() || !is_markdown(&canonical)) {
        return Err(AppError {
            code: "invalid_document",
        });
    }
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

fn build_menu(app: &tauri::AppHandle, locale: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let zh = locale == "zh-CN";
    let item = |id: &str, zh_text: &str, en_text: &str, accelerator: Option<&str>| {
        let mut builder = MenuItemBuilder::with_id(id, if zh { zh_text } else { en_text });
        if let Some(value) = accelerator {
            builder = builder.accelerator(value);
        }
        builder.build(app)
    };
    let open = item("open", "打开…", "Open…", Some("CmdOrCtrl+O"))?;
    let open_folder = item(
        "open-folder",
        "打开文件夹…",
        "Open Folder…",
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let save = item("save", "保存", "Save", Some("CmdOrCtrl+S"))?;
    let save_as = item("save-as", "另存为…", "Save As…", Some("CmdOrCtrl+Shift+S"))?;
    let print = item("print", "打印…", "Print…", Some("CmdOrCtrl+P"))?;
    let export = item("export", "导出 HTML…", "Export HTML…", None)?;
    let file_builder = SubmenuBuilder::new(app, if zh { "文件" } else { "File" })
        .items(&[&open, &open_folder])
        .separator()
        .items(&[&save, &save_as])
        .separator()
        .items(&[&print, &export]);
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let file_builder = file_builder.separator().close_window_with_text(if zh {
        "关闭窗口"
    } else {
        "Close Window"
    });
    #[cfg(target_os = "windows")]
    let file_builder = file_builder.separator().quit_with_text(if zh {
        "退出 TextMark"
    } else {
        "Exit TextMark"
    });
    let file = file_builder.build()?;
    let undo = item("undo", "撤销", "Undo", Some("CmdOrCtrl+Z"))?;
    let redo = item("redo", "重做", "Redo", Some("CmdOrCtrl+Shift+Z"))?;
    let find = item("find", "查找…", "Find…", Some("CmdOrCtrl+F"))?;
    let preferences = item("preferences", "设置…", "Settings…", Some("CmdOrCtrl+Comma"))?;
    let edit_mode = item(
        "edit-mode",
        "切换编辑模式",
        "Toggle Edit Mode",
        Some("CmdOrCtrl+E"),
    )?;
    let edit_builder = SubmenuBuilder::new(app, if zh { "编辑" } else { "Edit" })
        .items(&[&undo, &redo])
        .separator()
        .cut_with_text(if zh { "剪切" } else { "Cut" })
        .copy_with_text(if zh { "复制" } else { "Copy" })
        .paste_with_text(if zh { "粘贴" } else { "Paste" })
        .select_all_with_text(if zh { "全选" } else { "Select All" })
        .separator()
        .items(&[&find, &edit_mode]);
    #[cfg(not(target_os = "macos"))]
    let edit_builder = edit_builder.separator().item(&preferences);
    let edit = edit_builder.build()?;
    let sidebar = item(
        "sidebar",
        "显示或隐藏侧栏",
        "Toggle Sidebar",
        Some("CmdOrCtrl+L"),
    )?;
    // Keep Cmd/Ctrl+I available for italic while editing. The inspector remains
    // available from the View menu and the preview toolbar.
    let inspector = item("inspector", "显示简介", "Get Info", None)?;
    let zoom_in = item("zoom-in", "放大", "Zoom In", Some("CmdOrCtrl+Plus"))?;
    let zoom_out = item("zoom-out", "缩小", "Zoom Out", Some("CmdOrCtrl+-"))?;
    let zoom_reset = item("zoom-reset", "实际大小", "Actual Size", Some("CmdOrCtrl+0"))?;
    let customize = item(
        "customize-toolbar",
        "自定工具栏…",
        "Customize Toolbar…",
        None,
    )?;
    let view_builder = SubmenuBuilder::new(app, if zh { "显示" } else { "View" })
        .items(&[&sidebar, &inspector])
        .separator()
        .items(&[&zoom_in, &zoom_out, &zoom_reset])
        .separator()
        .item(&customize);
    #[cfg(target_os = "macos")]
    let view_builder = view_builder.separator().fullscreen_with_text(if zh {
        "进入全屏幕"
    } else {
        "Enter Full Screen"
    });
    let view = view_builder.build()?;

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let window = SubmenuBuilder::new(app, if zh { "窗口" } else { "Window" })
        .minimize_with_text(if zh { "最小化" } else { "Minimize" })
        .maximize_with_text(if zh { "缩放" } else { "Zoom" })
        .separator()
        .close_window_with_text(if zh { "关闭窗口" } else { "Close Window" })
        .build()?;

    let help_item = item("help", "TextMark 帮助", "TextMark Help", None)?;
    let help_builder = SubmenuBuilder::new(app, if zh { "帮助" } else { "Help" }).item(&help_item);
    #[cfg(not(target_os = "macos"))]
    let help_builder = help_builder.separator().about_with_text(
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
        .items(&[&application, &file, &edit, &view, &window, &help])
        .build();
    #[cfg(target_os = "windows")]
    return MenuBuilder::new(app)
        .items(&[&file, &edit, &view, &window, &help])
        .build();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    MenuBuilder::new(app)
        .items(&[&file, &edit, &view, &help])
        .build()
}

#[tauri::command]
fn set_menu_locale(app: tauri::AppHandle, locale: String) -> AppResult<()> {
    let menu = build_menu(&app, &locale).map_err(io_error)?;
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
            available: always || application_available(commands, mac_app),
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
fn open_mermaid_window(app: tauri::AppHandle, id: String, locale: String) -> AppResult<()> {
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
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let window_handle = handle.clone();
        let _ = handle.run_on_main_thread(move || {
            let _ = WebviewWindowBuilder::new(&window_handle, id, WebviewUrl::App(url.into()))
                .title(if locale == "zh-CN" {
                    "图表窗口"
                } else {
                    "Diagram Window"
                })
                .inner_size(980.0, 720.0)
                .min_inner_size(520.0, 360.0)
                .center()
                .resizable(true)
                .build();
        });
    });
    Ok(())
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
            let menu = build_menu(app.handle(), "zh-CN")?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu-command", event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            startup_request,
            write_text_file,
            list_directory,
            read_local_asset,
            check_update_channel,
            install_update_channel,
            open_mermaid_window,
            set_menu_locale,
            discover_applications,
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
}
