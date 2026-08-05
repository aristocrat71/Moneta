//! All disk access lives here. Every write is atomic: write `<name>.tmp`, fsync,
//! rename over the target. The webview never touches the filesystem directly.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write as _;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use serde_json::Value;

pub fn root_dir() -> PathBuf {
    dirs::home_dir().expect("no home directory").join("Moneta")
}

fn notebooks_dir() -> PathBuf {
    root_dir().join("notebooks")
}

fn thumbs_dir() -> PathBuf {
    root_dir().join(".thumbnails")
}

fn exports_dir() -> PathBuf {
    root_dir().join("exports")
}

pub fn ensure_layout() -> std::io::Result<()> {
    fs::create_dir_all(notebooks_dir())?;
    fs::create_dir_all(thumbs_dir())?;
    Ok(())
}

fn tmp_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    path.with_file_name(name)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = tmp_path(path);
    {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    // Best-effort fsync of the parent directory so the rename itself is durable.
    if let Some(dir) = path.parent() {
        if let Ok(d) = File::open(dir) {
            let _ = d.sync_all();
        }
    }
    Ok(())
}

/// Notebook ids are UUIDs minted by the frontend; reject anything that could
/// escape the notebooks directory.
fn checked_id(id: &str) -> Result<&str, String> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if ok {
        Ok(id)
    } else {
        Err("invalid notebook id".into())
    }
}

fn notebook_path(id: &str) -> Result<PathBuf, String> {
    Ok(notebooks_dir().join(format!("{}.moneta", checked_id(id)?)))
}

fn thumb_path(id: &str, dark: bool) -> Result<PathBuf, String> {
    let suffix = if dark { ".dark.png" } else { ".png" };
    Ok(thumbs_dir().join(format!("{}{}", checked_id(id)?, suffix)))
}

fn io_err(e: std::io::Error) -> String {
    e.to_string()
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookMeta {
    pub id: String,
    pub title: String,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    pub page_count: usize,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub projects: Value,
    pub notebooks: Vec<NotebookMeta>,
    pub root: String,
}

fn meta_from_value(id: String, v: &Value) -> NotebookMeta {
    NotebookMeta {
        id,
        title: v["title"].as_str().unwrap_or("Untitled").to_string(),
        project_id: v["projectId"].as_str().map(str::to_string),
        created_at: v["createdAt"].as_i64().unwrap_or(0),
        modified_at: v["modifiedAt"].as_i64().unwrap_or(0),
        page_count: v["pages"].as_array().map(Vec::len).unwrap_or(0),
    }
}

#[tauri::command]
pub fn library_scan() -> Result<LibrarySnapshot, String> {
    ensure_layout().map_err(io_err)?;
    let projects = match fs::read_to_string(root_dir().join("library.json")) {
        Ok(text) => serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|v| v.get("projects").cloned())
            .unwrap_or_else(|| Value::Array(vec![])),
        Err(_) => Value::Array(vec![]),
    };
    let mut notebooks = Vec::new();
    for entry in fs::read_dir(notebooks_dir()).map_err(io_err)?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("moneta") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(v) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        notebooks.push(meta_from_value(stem.to_string(), &v));
    }
    Ok(LibrarySnapshot {
        projects,
        notebooks,
        root: root_dir().display().to_string(),
    })
}

#[tauri::command]
pub fn read_notebook(id: String) -> Result<String, String> {
    fs::read_to_string(notebook_path(&id)?).map_err(io_err)
}

#[tauri::command]
pub fn write_notebook(id: String, contents: String) -> Result<(), String> {
    ensure_layout().map_err(io_err)?;
    atomic_write(&notebook_path(&id)?, contents.as_bytes()).map_err(io_err)
}

#[tauri::command]
pub fn delete_notebook(id: String) -> Result<(), String> {
    fs::remove_file(notebook_path(&id)?).map_err(io_err)?;
    for dark in [false, true] {
        let _ = fs::remove_file(thumb_path(&id, dark)?);
    }
    Ok(())
}

#[tauri::command]
pub fn duplicate_notebook(id: String, new_id: String) -> Result<NotebookMeta, String> {
    let text = fs::read_to_string(notebook_path(&id)?).map_err(io_err)?;
    let mut v: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let title = format!("{} copy", v["title"].as_str().unwrap_or("Untitled"));
    v["id"] = Value::String(new_id.clone());
    v["title"] = Value::String(title);
    v["createdAt"] = Value::from(now_ms());
    v["modifiedAt"] = Value::from(now_ms());
    let out = serde_json::to_string(&v).map_err(|e| e.to_string())?;
    atomic_write(&notebook_path(&new_id)?, out.as_bytes()).map_err(io_err)?;
    for dark in [false, true] {
        let _ = fs::copy(thumb_path(&id, dark)?, thumb_path(&new_id, dark)?);
    }
    Ok(meta_from_value(new_id, &v))
}

#[tauri::command]
pub fn read_library() -> Result<Option<String>, String> {
    match fs::read_to_string(root_dir().join("library.json")) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(io_err(e)),
    }
}

#[tauri::command]
pub fn write_library(contents: String) -> Result<(), String> {
    ensure_layout().map_err(io_err)?;
    atomic_write(&root_dir().join("library.json"), contents.as_bytes()).map_err(io_err)
}

#[tauri::command]
pub fn read_settings() -> Result<Option<String>, String> {
    match fs::read_to_string(root_dir().join("settings.json")) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(io_err(e)),
    }
}

#[tauri::command]
pub fn write_settings(contents: String) -> Result<(), String> {
    ensure_layout().map_err(io_err)?;
    atomic_write(&root_dir().join("settings.json"), contents.as_bytes()).map_err(io_err)
}

#[tauri::command]
pub fn write_thumbnail(id: String, dark: bool, data: String) -> Result<(), String> {
    ensure_layout().map_err(io_err)?;
    let bytes = B64.decode(data).map_err(|e| e.to_string())?;
    atomic_write(&thumb_path(&id, dark)?, &bytes).map_err(io_err)
}

#[derive(serde::Serialize, Default)]
pub struct ThumbPair {
    pub light: Option<String>,
    pub dark: Option<String>,
}

#[tauri::command]
pub fn read_thumbnails() -> Result<HashMap<String, ThumbPair>, String> {
    ensure_layout().map_err(io_err)?;
    let mut map: HashMap<String, ThumbPair> = HashMap::new();
    for entry in fs::read_dir(thumbs_dir()).map_err(io_err)?.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let (id, dark) = if let Some(id) = name.strip_suffix(".dark.png") {
            (id.to_string(), true)
        } else if let Some(id) = name.strip_suffix(".png") {
            (id.to_string(), false)
        } else {
            continue;
        };
        let Ok(bytes) = fs::read(&path) else { continue };
        let slot = map.entry(id).or_default();
        let encoded = B64.encode(bytes);
        if dark {
            slot.dark = Some(encoded);
        } else {
            slot.light = Some(encoded);
        }
    }
    Ok(map)
}

/// Write an export file under ~/Moneta/exports. `name` may contain one
/// directory level (e.g. "Notes svg/p1.svg"); components are sanitized.
#[tauri::command]
pub fn export_file(name: String, data: String) -> Result<String, String> {
    let mut safe = PathBuf::new();
    for part in name.split('/') {
        let cleaned: String = part
            .chars()
            .map(|c| {
                if c.is_control() || matches!(c, '\\' | ':' | '\0') {
                    '_'
                } else {
                    c
                }
            })
            .collect::<String>()
            .trim()
            .to_string();
        if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
            return Err("invalid export name".into());
        }
        safe.push(cleaned);
    }
    if safe.components().count() > 2 {
        return Err("invalid export name".into());
    }
    let path = exports_dir().join(&safe);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(io_err)?;
    }
    let bytes = B64.decode(data).map_err(|e| e.to_string())?;
    atomic_write(&path, &bytes).map_err(io_err)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn storage_path() -> String {
    root_dir().display().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("moneta-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn atomic_write_roundtrip() {
        let dir = scratch("roundtrip");
        let path = dir.join("a.moneta");
        atomic_write(&path, b"first").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"first");
        atomic_write(&path, b"second").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        assert!(!tmp_path(&path).exists(), "tmp file must not linger");
    }

    #[test]
    fn crash_between_tmp_and_rename_leaves_original_intact() {
        let dir = scratch("crash");
        let path = dir.join("a.moneta");
        atomic_write(&path, b"good data").unwrap();
        // Simulate a crash mid-save: the tmp file was written but never renamed.
        fs::write(tmp_path(&path), b"half-writ").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"good data");
        // The next successful save replaces both cleanly.
        atomic_write(&path, b"newer").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"newer");
        assert!(!tmp_path(&path).exists());
    }

    #[test]
    fn ids_cannot_escape_the_notebooks_dir() {
        assert!(checked_id("0b5c9c6e-4c7f-4a44-9c39-8e3ec95ab41c").is_ok());
        assert!(checked_id("../evil").is_err());
        assert!(checked_id("a/b").is_err());
        assert!(checked_id("").is_err());
    }
}
