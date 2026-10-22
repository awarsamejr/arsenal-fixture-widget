mod api;
mod commands;
mod models;
mod scheduler;
mod settings;
mod state;
mod tray;

use tauri::{Manager, WindowEvent};

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Launching a second copy just brings the existing widget forward
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_window(app)))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();
            let settings = settings::load_settings(handle);
            let cache = settings::load_cache(handle);
            let always_on_top = settings.always_on_top;
            app.manage(AppState::new(settings, cache));

            if let Some(window) = app.get_webview_window("main") {
                window.set_always_on_top(always_on_top)?;
            }
            tray::create(handle, always_on_top)?;
            tray::update_tooltip(handle, &app.state::<AppState>().snapshot());

            tauri::async_runtime::spawn(scheduler::run(handle.clone()));
            Ok(())
        })
        // Closing the widget hides it to the tray; Quit is in the tray menu
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::get_settings,
            commands::save_settings,
            commands::refresh_now,
            commands::test_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
