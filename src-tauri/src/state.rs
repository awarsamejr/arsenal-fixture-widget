//! Shared app state, guarded by a mutex. Every change goes through here so
//! the UI, tray and on-disk cache always stay in step.

use std::collections::HashSet;
use std::sync::{Mutex, MutexGuard};

use chrono::{DateTime, Utc};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Notify;

use crate::models::{Fixture, Snapshot};
use crate::scheduler::Notice;
use crate::settings::{self, Cache, Settings};
use crate::tray;

pub const STATE_EVENT: &str = "state-updated";

pub struct Inner {
    pub settings: Settings,
    pub cache: Cache,
    /// None means "fetch as soon as possible"
    pub next_fetch: Option<DateTime<Utc>>,
    pub table_fetched_at: Option<DateTime<Utc>>,
}

pub struct AppState {
    inner: Mutex<Inner>,
    /// Wakes the scheduler early, e.g. for Refresh or after settings change
    pub wake: Notify,
}

impl AppState {
    pub fn new(settings: Settings, mut cache: Cache) -> Self {
        cache.snapshot.refreshing = false;
        cache.snapshot.has_api_key = settings.effective_api_key().is_some();
        Self {
            inner: Mutex::new(Inner { settings, cache, next_fetch: None, table_fetched_at: None }),
            wake: Notify::new(),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn snapshot(&self) -> Snapshot {
        self.lock().cache.snapshot.clone()
    }

    pub fn settings(&self) -> Settings {
        self.lock().settings.clone()
    }

    pub fn set_settings(&self, settings: Settings) {
        self.lock().settings = settings;
    }

    pub fn request_refresh(&self) {
        self.lock().next_fetch = None;
        self.wake.notify_one();
    }

    pub fn fetch_due(&self) -> bool {
        self.lock().next_fetch.is_none_or(|at| Utc::now() >= at)
    }

    /// Marks a refresh as started; returns what the fetch needs.
    pub fn begin_refresh<R: Runtime>(&self, app: &AppHandle<R>) -> (Settings, Vec<Fixture>, Option<DateTime<Utc>>) {
        let (out, snapshot) = {
            let mut inner = self.lock();
            inner.cache.snapshot.refreshing = true;
            (
                (inner.settings.clone(), inner.cache.snapshot.fixtures.clone(), inner.table_fetched_at),
                inner.cache.snapshot.clone(),
            )
        };
        let _ = app.emit(STATE_EVENT, &snapshot);
        out
    }

    /// Applies the refresh result, then saves and tells the UI and tray.
    pub fn finish_refresh<R: Runtime>(&self, app: &AppHandle<R>, apply: impl FnOnce(&mut Inner)) {
        let snapshot = {
            let mut inner = self.lock();
            apply(&mut inner);
            inner.cache.snapshot.refreshing = false;
            if let Err(e) = settings::save_cache(app, &inner.cache) {
                eprintln!("couldn't save cache: {e}");
            }
            inner.cache.snapshot.clone()
        };
        let _ = app.emit(STATE_EVENT, &snapshot);
        tray::update_tooltip(app, &snapshot);
    }

    /// Works out which notifications are due and marks them as sent.
    pub fn take_due_notices<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        now: DateTime<Utc>,
        find: impl Fn(&[Fixture], DateTime<Utc>, &Settings, &HashSet<String>) -> Vec<Notice>,
    ) -> Vec<Notice> {
        let mut inner = self.lock();
        let notices = find(&inner.cache.snapshot.fixtures, now, &inner.settings, &inner.cache.sent_notifications);
        if !notices.is_empty() {
            inner.cache.sent_notifications.extend(notices.iter().map(|n| n.key.clone()));
            if let Err(e) = settings::save_cache(app, &inner.cache) {
                eprintln!("couldn't save cache: {e}");
            }
        }
        notices
    }
}
