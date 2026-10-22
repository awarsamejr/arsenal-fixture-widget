//! Functions the React UI calls with `invoke(...)`.

use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_notification::NotificationExt;

use crate::api::Client;
use crate::models::{MatchDetails, Snapshot};
use crate::settings::{self, Settings};
use crate::state::AppState;
use crate::stats::{self, StatsResult};
use crate::tray;

pub const SETTINGS_EVENT: &str = "settings-updated";

#[tauri::command]
pub fn get_snapshot(state: State<'_, AppState>) -> Snapshot {
    state.snapshot()
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings()
}

#[tauri::command]
pub fn refresh_now(state: State<'_, AppState>) {
    state.request_refresh();
}

#[tauri::command]
pub async fn get_match_details(
    state: State<'_, AppState>,
    client: State<'_, Client>,
    fixture_id: u64,
) -> Result<MatchDetails, String> {
    if let Some(details) = state.cached_details(fixture_id) {
        return Ok(details);
    }
    let key = state.settings().effective_api_key().ok_or("Add an API key in Settings first.")?;
    let details = client.fetch_match_details(&key, fixture_id).await.map_err(|e| e.user_message())?;
    state.store_details(details.clone());
    Ok(details)
}

/// Goals, cards, subs, team stats, line-ups and predictions (Highlightly).
#[tauri::command]
pub async fn get_match_stats<R: Runtime>(app: AppHandle<R>, fixture_id: u64) -> Result<StatsResult, String> {
    stats::get_stats(&app, fixture_id).await
}

#[tauri::command]
pub fn save_settings<R: Runtime>(app: AppHandle<R>, state: State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    let new = tidy(settings);
    let old = state.settings();
    settings::save_settings(&app, &new)?;
    state.set_settings(new.clone());

    if new.always_on_top != old.always_on_top {
        apply_always_on_top(&app, new.always_on_top);
    }
    if new.api_key != old.api_key || new.refresh_minutes != old.refresh_minutes {
        state.request_refresh();
    } else {
        state.wake.notify_one(); // reminder settings may have changed
    }
    let _ = app.emit(SETTINGS_EVENT, &new);
    Ok(new)
}

#[tauri::command]
pub fn test_notification<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Arsenal Widget")
        .body("Notifications are working. Come on you Gunners!")
        .show()
        .map_err(|e| e.to_string())
}

/// Used by the tray menu, so the setting, window and widget stay in step.
pub fn set_always_on_top<R: Runtime>(app: &AppHandle<R>, on: bool) {
    let state = app.state::<AppState>();
    let new = Settings { always_on_top: on, ..state.settings() };
    if let Err(e) = settings::save_settings(app, &new) {
        eprintln!("couldn't save settings: {e}");
    }
    state.set_settings(new.clone());
    apply_always_on_top(app, on);
    let _ = app.emit(SETTINGS_EVENT, &new);
}

fn apply_always_on_top<R: Runtime>(app: &AppHandle<R>, on: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(on);
    }
    tray::set_pin_checked(app, on);
}

/// Cleans up values typed in the Settings screen.
fn tidy(mut s: Settings) -> Settings {
    s.api_key = s.api_key.trim().to_string();
    s.stats_api_key = s.stats_api_key.trim().to_string();
    s.refresh_minutes = s.refresh_minutes.clamp(1, 120);
    s.reminder_minutes.sort_unstable_by(|a, b| b.cmp(a));
    s.reminder_minutes.dedup();
    s.stream_links.retain(|l| !l.url.trim().is_empty());
    for link in &mut s.stream_links {
        link.url = link.url.trim().to_string();
        if !link.url.starts_with("http://") && !link.url.starts_with("https://") {
            link.url = format!("https://{}", link.url);
        }
        link.name = link.name.trim().to_string();
        if link.name.is_empty() {
            link.name = link.url.trim_start_matches("https://").trim_start_matches("http://").to_string();
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::StreamLink;

    #[test]
    fn tidies_settings() {
        let s = tidy(Settings {
            api_key: " key ".into(),
            refresh_minutes: 0,
            reminder_minutes: vec![0, 60, 60, 1440],
            stream_links: vec![
                StreamLink { name: "".into(), url: " example.com/live ".into() },
                StreamLink { name: "Blank".into(), url: "  ".into() },
            ],
            ..Default::default()
        });
        assert_eq!(s.api_key, "key");
        assert_eq!(s.refresh_minutes, 1);
        assert_eq!(s.reminder_minutes, vec![1440, 60, 0]);
        assert_eq!(s.stream_links, vec![StreamLink { name: "example.com/live".into(), url: "https://example.com/live".into() }]);
    }
}
