use base64::{Engine as _, engine::general_purpose::STANDARD};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "rmd", "txt"];
const ASSET_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"];
const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextDocument {
    path: String,
    name: String,
    contents: String,
    modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileNode {
    name: String,
    path: String,
    is_directory: bool,
    children: Vec<FileNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppError {
    code: &'static str,
    // Details are intentionally omitted: the frontend localizes stable error
    // codes and never leaks an operating-system path or error message.
}

type AppResult<T> = Result<T, AppError>;

fn io_error(_error: impl std::fmt::Display) -> AppError {
    AppError { code: "io" }
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| MARKDOWN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
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
    let canonical = PathBuf::from(&path).canonicalize().map_err(|_| AppError { code: "not_found" })?;
    if !canonical.is_file() || !is_markdown(&canonical) {
        return Err(AppError { code: "invalid_document" });
    }
    let metadata = fs::metadata(&canonical).map_err(io_error)?;
    let contents = fs::read_to_string(&canonical).map_err(io_error)?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis());
    Ok(TextDocument {
        name: canonical
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: canonical.to_string_lossy().to_string(),
        contents,
        modified_ms,
    })
}

#[tauri::command]
fn startup_document() -> AppResult<Option<TextDocument>> {
    let candidate = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|path| is_markdown(path));
    match candidate {
        Some(path) => read_text_file(path.to_string_lossy().to_string()).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> AppResult<()> {
    let target = PathBuf::from(path);
    if !is_markdown(&target) {
        return Err(AppError { code: "invalid_document" });
    }
    fs::write(target, contents).map_err(io_error)
}

#[tauri::command]
fn list_directory(path: String) -> AppResult<Vec<FileNode>> {
    let canonical = PathBuf::from(path).canonicalize().map_err(|_| AppError { code: "not_found" })?;
    if !canonical.is_dir() {
        return Err(AppError { code: "invalid_path" });
    }
    scan_directory(&canonical, 5)
}

#[tauri::command]
fn read_local_asset(base_dir: String, relative_path: String) -> AppResult<String> {
    let decoded = percent_decode_str(relative_path.split(['?', '#']).next().unwrap_or_default())
        .decode_utf8_lossy();
    let relative = PathBuf::from(decoded.as_ref());
    if relative.is_absolute() {
        return Err(AppError { code: "asset_outside_workspace" });
    }

    let base = PathBuf::from(base_dir)
        .canonicalize()
        .map_err(|_| AppError { code: "not_found" })?;
    let candidate = base.join(relative).canonicalize().map_err(|_| AppError { code: "not_found" })?;
    if !candidate.starts_with(&base) || !candidate.is_file() {
        return Err(AppError { code: "asset_outside_workspace" });
    }
    let extension = candidate
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !ASSET_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError { code: "asset_unsupported" });
    }
    let metadata = fs::metadata(&candidate).map_err(io_error)?;
    if metadata.len() > MAX_ASSET_BYTES {
        return Err(AppError { code: "asset_too_large" });
    }
    let data = fs::read(&candidate).map_err(io_error)?;
    let mime = mime_guess::from_path(&candidate).first_or_octet_stream();
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(data)))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            startup_document,
            write_text_file,
            list_directory,
            read_local_asset
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
    fn local_asset_allow_list_excludes_executable_formats() {
        assert!(ASSET_EXTENSIONS.contains(&"png"));
        assert!(!ASSET_EXTENSIONS.contains(&"svg"));
        assert!(!ASSET_EXTENSIONS.contains(&"html"));
    }
}
