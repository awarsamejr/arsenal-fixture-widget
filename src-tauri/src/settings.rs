//! User settings and the on-disk cache, kept in the app's data folder
//! (%APPDATA%\com.awarsamejr.arsenalwidget), never in the repo.

use std::collections::HashSet;
use std::path::PathBuf;

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

use crate::models::Snapshot;

const SETTINGS_FILE: &str = "settings.json";
const CACHE_FILE: &str = "cache.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamLink {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Empty means "use api_key.txt"
    pub api_key: String,
    /// Minutes before kick-off to remind; 0 means at kick-off
    pub reminder_minutes: Vec<u32>,
    pub result_notifications: bool,
    pub refresh_minutes: u32,
    pub always_on_top: bool,
    pub stream_links: Vec<StreamLink>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            reminder_minutes: vec![24 * 60, 60, 0],
            result_notifications: true,
            refresh_minutes: 15,
            always_on_top: true,
            stream_links: Vec::new(),
        }
    }
}

impl Settings {
    /// The key from Settings, or else from an api_key.txt file (next to the
    /// program, or in the project folder when developing).
    pub fn effective_api_key(&self) -> Option<String> {
        let typed = self.api_key.trim();
        if !typed.is_empty() {
            return Some(typed.to_string());
        }
        key_file_candidates()
            .into_iter()
            .filter_map(|path| std::fs::read_to_string(path).ok())
            .map(|text| text.trim().to_string())
            .find(|key| !key.is_empty())
    }
}

fn key_file_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(PathBuf::from)) {
        paths.push(dir.join("api_key.txt"));
    }
    if cfg!(debug_assertions) {
        paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("api_key.txt"));
    }
    paths
}

/// What's remembered between runs besides settings: last data and which
/// notifications were already sent, so a restart doesn't repeat them.
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Cache {
    pub snapshot: Snapshot,
    pub sent_notifications: HashSet<String>,
}

fn load<R: Runtime, T: DeserializeOwned + Default>(app: &AppHandle<R>, file: &str, key: &str) -> T {
    app.store(file)
        .ok()
        .and_then(|store| store.get(key))
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

fn save<R: Runtime, T: Serialize>(app: &AppHandle<R>, file: &str, key: &str, value: &T) -> Result<(), String> {
    let store = app.store(file).map_err(|e| e.to_string())?;
    store.set(key, serde_json::to_value(value).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())
}

pub fn load_settings<R: Runtime>(app: &AppHandle<R>) -> Settings {
    load(app, SETTINGS_FILE, "settings")
}

pub fn save_settings<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), String> {
    save(app, SETTINGS_FILE, "settings", settings)
}

pub fn load_cache<R: Runtime>(app: &AppHandle<R>) -> Cache {
    load(app, CACHE_FILE, "cache")
}

pub fn save_cache<R: Runtime>(app: &AppHandle<R>, cache: &Cache) -> Result<(), String> {
    save(app, CACHE_FILE, "cache", cache)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let s: Settings = serde_json::from_str(r#"{"refreshMinutes": 5}"#).unwrap();
        assert_eq!(s.refresh_minutes, 5);
        assert_eq!(s.reminder_minutes, vec![1440, 60, 0]);
        assert!(s.always_on_top);
    }

    #[test]
    fn typed_key_wins_over_file() {
        let s = Settings { api_key: "  abc  ".into(), ..Default::default() };
        assert_eq!(s.effective_api_key().as_deref(), Some("abc"));
    }
}
