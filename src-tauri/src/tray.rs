//! System tray icon: left-click shows/hides the widget, right-click opens the menu.

use chrono::Local;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

use crate::commands;
use crate::models::Snapshot;
use crate::state::AppState;

const TRAY_ID: &str = "main";

/// Kept so the "Always on top" tick can follow changes made in the widget.
pub struct TrayMenu<R: Runtime> {
    pub pin: CheckMenuItem<R>,
}

pub fn create<R: Runtime>(app: &AppHandle<R>, always_on_top: bool) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show / hide", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh now", true, None::<&str>)?;
    let pin = CheckMenuItem::with_id(app, "pin", "Always on top", true, always_on_top, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &refresh, &pin, &PredefinedMenuItem::separator(app)?, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().expect("app icon missing"))
        .tooltip("Matchnight")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_window(app),
            "refresh" => app.state::<AppState>().request_refresh(),
            "pin" => {
                let on = !app.state::<AppState>().settings().always_on_top;
                commands::set_always_on_top(app, on);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(TrayMenu { pin });
    Ok(())
}

pub fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_window(app);
        }
    }
}

pub fn set_pin_checked<R: Runtime>(app: &AppHandle<R>, on: bool) {
    if let Some(menu) = app.try_state::<TrayMenu<R>>() {
        let _ = menu.pin.set_checked(on);
    }
}

/// Hovering the tray icon shows the live score or the next match.
pub fn update_tooltip<R: Runtime>(app: &AppHandle<R>, snapshot: &Snapshot) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let text = match snapshot.headline_fixture() {
        Some(f) if f.status.is_live() => {
            format!("LIVE: {}", f.score_line().unwrap_or_else(|| f.title()))
        }
        Some(f) => {
            let when = f.kickoff.with_timezone(&Local);
            let when = if f.time_tbd { when.format("%a %-d %b").to_string() } else { when.format("%a %-d %b, %H:%M").to_string() };
            format!("Next: {}\n{} · {}", f.title(), when, f.competition)
        }
        None => "Matchnight".into(),
    };
    let _ = tray.set_tooltip(Some(text));
}
