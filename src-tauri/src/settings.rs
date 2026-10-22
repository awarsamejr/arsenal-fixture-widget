//! User settings and the on-disk cache, kept in the app's data folder
//! (%APPDATA%\com.awarsamejr.arsenalwidget), never in the repo.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_store::StoreExt;

use crate::highlightly::MatchStats;
use crate::models::{Snapshot, TeamChoice};

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
    /// The team the app follows
    pub team: TeamChoice,
    /// Empty means "use api_key.txt"
    pub api_key: String,
    /// Highlightly key for match stats; empty means "use highlightly_key.txt"
    pub stats_api_key: String,
    /// Minutes before kick-off to remind; 0 means at kick-off
    pub reminder_minutes: Vec<u32>,
    pub result_notifications: bool,
    /// Notify the moment a goal is scored in a live match
    pub goal_alerts: bool,
    pub refresh_minutes: u32,
    pub always_on_top: bool,
    /// Shrunk to the one-line strip (desktop only)
    pub mini_mode: bool,
    pub stream_links: Vec<StreamLink>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            team: TeamChoice::default(),
            api_key: String::new(),
            stats_api_key: String::new(),
            reminder_minutes: vec![24 * 60, 60, 0],
            result_notifications: true,
            goal_alerts: true,
            refresh_minutes: 15,
            always_on_top: true,
            mini_mode: false,
            stream_links: Vec::new(),
        }
    }
}

impl Settings {
    /// The key from Settings, or else from an api_key.txt file (next to the
    /// program, or in the project folder when developing).
    pub fn effective_api_key(&self) -> Option<String> {
        typed_or_file(&self.api_key, "api_key.txt")
    }

    /// Same idea for the Highlightly key, with highlightly_key.txt.
    pub fn effective_stats_key(&self) -> Option<String> {
        typed_or_file(&self.stats_api_key, "highlightly_key.txt")
    }
}

fn typed_or_file(typed: &str, file_name: &str) -> Option<String> {
    let typed = typed.trim();
    if !typed.is_empty() {
        return Some(typed.to_string());
    }
    key_file_candidates(file_name)
        .into_iter()
        .filter_map(|path| std::fs::read_to_string(path).ok())
        .map(|text| text.trim().to_string())
        .find(|key| !key.is_empty())
}

fn key_file_candidates(file_name: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(PathBuf::from)) {
        paths.push(dir.join(file_name));
    }
    if cfg!(debug_assertions) {
        paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(file_name));
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

/// Match stats from Highlightly, kept on disk because the free plan only
/// allows 100 requests a day. Keyed by football-data's match id.
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct StatsCache {
    pub entries: HashMap<u64, StatsEntry>,
    /// Requests left today, from the last response
    pub requests_left: Option<u32>,
    /// The football-data team these entries belong to; a different team clears them
    pub team_id: Option<u64>,
    /// Highlightly ids that might be this team (several clubs can share a name),
    /// best guess first. Narrowed to one once a match lookup succeeds.
    pub highlightly_team: Option<Vec<u64>>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatsEntry {
    /// Highlightly's id for the match; None if it couldn't be found
    pub highlightly_id: Option<u64>,
    pub stats: Option<MatchStats>,
    pub fetched_at: DateTime<Utc>,
    /// Fetched after full time, so it won't change any more
    pub is_final: bool,
}

const STATS_FILE: &str = "stats.json";

pub fn load_stats_cache<R: Runtime>(app: &AppHandle<R>) -> StatsCache {
    load(app, STATS_FILE, "stats")
}

pub fn save_stats_cache<R: Runtime>(app: &AppHandle<R>, cache: &StatsCache) -> Result<(), String> {
    save(app, STATS_FILE, "stats", cache)
}

/// The app used to be "Arsenal Widget" with a different identifier, so its
/// data lived in another folder. Copies it over once so nothing is lost.
pub fn migrate_from_old_name<R: Runtime>(app: &AppHandle<R>) {
    let Ok(new_dir) = app.path().app_data_dir() else { return };
    let Some(old_dir) = new_dir.parent().map(|p| p.join("com.awarsamejr.arsenalwidget")) else { return };
    if let Err(e) = copy_data_files(&old_dir, &new_dir) {
        eprintln!("couldn't migrate old settings: {e}");
    }
}

fn copy_data_files(old_dir: &Path, new_dir: &Path) -> std::io::Result<()> {
    if !old_dir.is_dir() || new_dir.join(SETTINGS_FILE).exists() {
        return Ok(());
    }
    std::fs::create_dir_all(new_dir)?;
    for file in [SETTINGS_FILE, CACHE_FILE, STATS_FILE] {
        let from = old_dir.join(file);
        if from.exists() {
            std::fs::copy(&from, new_dir.join(file))?;
        }
    }
    Ok(())
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
    fn copies_old_data_once() {
        let root = std::env::temp_dir().join(format!("matchnight-migrate-{}", std::process::id()));
        let (old, new) = (root.join("old"), root.join("new"));
        std::fs::create_dir_all(&old).unwrap();
        std::fs::write(old.join(SETTINGS_FILE), "old settings").unwrap();
        std::fs::write(old.join(CACHE_FILE), "old cache").unwrap();

        copy_data_files(&old, &new).unwrap();
        assert_eq!(std::fs::read_to_string(new.join(SETTINGS_FILE)).unwrap(), "old settings");
        assert_eq!(std::fs::read_to_string(new.join(CACHE_FILE)).unwrap(), "old cache");
        assert!(!new.join(STATS_FILE).exists());

        // Never overwrites once the new folder has settings
        std::fs::write(new.join(SETTINGS_FILE), "new settings").unwrap();
        copy_data_files(&old, &new).unwrap();
        assert_eq!(std::fs::read_to_string(new.join(SETTINGS_FILE)).unwrap(), "new settings");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn typed_key_wins_over_file() {
        let s = Settings { api_key: "  abc  ".into(), ..Default::default() };
        assert_eq!(s.effective_api_key().as_deref(), Some("abc"));
    }
}
