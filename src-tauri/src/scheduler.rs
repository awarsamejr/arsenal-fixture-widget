//! Background loop: decides when to fetch new data and which notifications
//! are due. Runs in Rust so it keeps working while the window is hidden.

use std::collections::HashSet;
use std::time::Duration as StdDuration;

use chrono::{DateTime, Duration, Local, Utc};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

use crate::api::{ApiError, Client};
use crate::models::{Fixture, MatchStatus, Outcome};
use crate::settings::Settings;
use crate::state::AppState;

/// How often to poll while a match is on (or about to start)
const LIVE_POLL: Duration = Duration::seconds(60);
/// Start polling fast this long before kick-off...
const PRE_MATCH_WINDOW: Duration = Duration::minutes(15);
/// ...and stop if the API still hasn't marked the match finished after this long
const MATCH_WINDOW: Duration = Duration::hours(3);
/// The league table changes slowly
const TABLE_MAX_AGE: Duration = Duration::minutes(30);
/// A reminder is still worth sending this long after its time (e.g. the PC was asleep)
const REMINDER_GRACE: Duration = Duration::minutes(30);
/// Don't announce results older than this (e.g. first run after a long break)
const RESULT_MAX_AGE: Duration = Duration::hours(6);
/// Check for due reminders at least this often
const TICK: StdDuration = StdDuration::from_secs(30);

/// How long to wait before the next fetch.
pub fn next_fetch_delay(fixtures: &[Fixture], now: DateTime<Utc>, refresh_minutes: u32) -> Duration {
    let normal = Duration::minutes(refresh_minutes.max(1) as i64);
    // Fixtures are sorted by kick-off, so the first relevant match decides
    for f in fixtures {
        if f.status.is_live() {
            return LIVE_POLL;
        }
        if f.status != MatchStatus::Scheduled || f.time_tbd {
            continue;
        }
        let fast_from = f.kickoff - PRE_MATCH_WINDOW;
        if now < fast_from {
            return normal.min(fast_from - now).max(LIVE_POLL);
        }
        if now < f.kickoff + MATCH_WINDOW {
            return LIVE_POLL; // about to start, or started but not marked live yet
        }
    }
    normal
}

#[derive(Debug, PartialEq)]
pub struct Notice {
    pub key: String,
    pub title: String,
    pub body: String,
}

/// Reminders and full-time results that should be shown now and haven't been yet.
pub fn due_notices(fixtures: &[Fixture], now: DateTime<Utc>, settings: &Settings, sent: &HashSet<String>) -> Vec<Notice> {
    let mut notices = Vec::new();
    for f in fixtures {
        match f.status {
            MatchStatus::Scheduled if !f.time_tbd => {
                for &lead in &settings.reminder_minutes {
                    let at = f.kickoff - Duration::minutes(lead as i64);
                    let key = format!("{}:r{}", f.id, lead);
                    if now >= at && now < at + REMINDER_GRACE && !sent.contains(&key) {
                        let title = if lead == 0 {
                            format!("Kick-off: {}", f.title())
                        } else {
                            format!("{} {}", f.title(), lead_label(lead))
                        };
                        let local = f.kickoff.with_timezone(&Local).format("%a %-d %b, %H:%M");
                        notices.push(Notice { key, title, body: format!("{} · {}", f.competition, local) });
                    }
                }
            }
            MatchStatus::Finished if settings.result_notifications => {
                let key = format!("{}:ft", f.id);
                if now - f.kickoff < RESULT_MAX_AGE && !sent.contains(&key) {
                    if let Some(score) = f.score_line() {
                        let verdict = match f.outcome {
                            Some(Outcome::Win) => "Arsenal win!",
                            Some(Outcome::Draw) => "It's a draw",
                            _ => "Arsenal lose",
                        };
                        notices.push(Notice {
                            key,
                            title: format!("Full time: {verdict}"),
                            body: format!("{score} · {}", f.competition),
                        });
                    }
                }
            }
            _ => {}
        }
    }
    notices
}

/// "in 1 hour", "in 2 days", "in 30 minutes"
pub fn lead_label(minutes: u32) -> String {
    let (n, unit) = if minutes % 1440 == 0 {
        (minutes / 1440, "day")
    } else if minutes % 60 == 0 {
        (minutes / 60, "hour")
    } else {
        (minutes, "minute")
    };
    if unit == "day" && n == 1 {
        return "tomorrow".into();
    }
    format!("in {n} {unit}{}", if n == 1 { "" } else { "s" })
}

/// True if any match went from not-finished to finished between two fetches.
fn a_match_just_finished(before: &[Fixture], after: &[Fixture]) -> bool {
    after.iter().any(|new| {
        new.status == MatchStatus::Finished
            && before.iter().any(|old| old.id == new.id && old.status != MatchStatus::Finished)
    })
}

pub async fn run<R: Runtime>(app: AppHandle<R>) {
    let client = Client::new();
    loop {
        let state = app.state::<AppState>();
        if state.fetch_due() {
            refresh(&app, &client).await;
        }
        send_due_notices(&app);
        tokio::select! {
            _ = tokio::time::sleep(TICK) => {}
            _ = state.wake.notified() => {}
        }
    }
}

async fn refresh<R: Runtime>(app: &AppHandle<R>, client: &Client) {
    let state = app.state::<AppState>();
    let (settings, previous, table_fetched_at) = state.begin_refresh(app);

    let Some(key) = settings.effective_api_key() else {
        state.finish_refresh(app, |inner| {
            inner.cache.snapshot.has_api_key = false;
            inner.cache.snapshot.error = None;
            inner.next_fetch = Some(Utc::now() + Duration::minutes(settings.refresh_minutes.max(1) as i64));
        });
        return;
    };

    let fixtures = client.fetch_fixtures(&key).await;
    let now = Utc::now();
    let table_stale = match (&fixtures, table_fetched_at) {
        (Ok(new), Some(at)) => now - at > TABLE_MAX_AGE || a_match_just_finished(&previous, new),
        _ => true,
    };
    let table = if fixtures.is_ok() && table_stale { Some(client.fetch_table(&key).await) } else { None };

    state.finish_refresh(app, |inner| {
        let snap = &mut inner.cache.snapshot;
        snap.has_api_key = true;
        match fixtures {
            Ok(new) => {
                snap.fixtures = new;
                snap.error = None;
                snap.last_updated = Some(now);
                inner.next_fetch = Some(now + next_fetch_delay(&snap.fixtures, now, settings.refresh_minutes));
            }
            Err(e) => {
                if let ApiError::Network(detail) = &e {
                    eprintln!("network error: {detail}");
                }
                snap.error = Some(e.user_message());
                let retry = match e {
                    ApiError::RateLimited => Duration::minutes(1),
                    ApiError::Network(_) | ApiError::Unexpected(_) => Duration::minutes(2),
                    ApiError::BadKey => Duration::minutes(settings.refresh_minutes.max(1) as i64),
                };
                inner.next_fetch = Some(now + retry);
            }
        }
        if let Some(Ok(rows)) = table {
            snap.table = rows;
            inner.table_fetched_at = Some(now);
        }
        // Forget sent-notification keys for matches no longer in the list
        let ids: HashSet<String> = snap.fixtures.iter().map(|f| f.id.to_string()).collect();
        inner
            .cache
            .sent_notifications
            .retain(|k| k.split(':').next().is_some_and(|id| ids.contains(id)));
    });
}

fn send_due_notices<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let notices = state.take_due_notices(app, Utc::now(), due_notices);
    for n in notices {
        if let Err(e) = app.notification().builder().title(&n.title).body(&n.body).show() {
            eprintln!("notification failed: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TeamInfo;
    use chrono::TimeZone;

    fn team(name: &str) -> TeamInfo {
        TeamInfo { name: name.into(), short_name: name.into(), crest: None }
    }

    fn fixture(id: u64, kickoff: DateTime<Utc>, status: MatchStatus) -> Fixture {
        Fixture {
            id,
            kickoff,
            time_tbd: false,
            status,
            competition: "Premier League".into(),
            competition_code: Some("PL".into()),
            competition_emblem: None,
            home: true,
            arsenal: team("Arsenal"),
            opponent: team("Everton"),
            arsenal_goals: None,
            opponent_goals: None,
            outcome: None,
            half_time_arsenal: None,
            half_time_opponent: None,
            matchday: None,
            stage: None,
            referee: None,
        }
    }

    fn t(h: u32, m: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 24, h, m, 0).unwrap()
    }

    #[test]
    fn polls_slowly_when_nothing_is_close() {
        let f = vec![fixture(1, t(20, 0), MatchStatus::Scheduled)];
        assert_eq!(next_fetch_delay(&f, t(9, 0), 15), Duration::minutes(15));
    }

    #[test]
    fn wakes_up_for_the_pre_match_window() {
        let f = vec![fixture(1, t(14, 0), MatchStatus::Scheduled)];
        // 13:40 → the fast window starts at 13:45, sooner than the 15 min interval
        assert_eq!(next_fetch_delay(&f, t(13, 40), 15), Duration::minutes(5));
        assert_eq!(next_fetch_delay(&f, t(13, 50), 15), LIVE_POLL);
        // Kicked off but the API hasn't flipped to live yet
        assert_eq!(next_fetch_delay(&f, t(14, 5), 15), LIVE_POLL);
    }

    #[test]
    fn polls_fast_during_a_live_match() {
        let f = vec![fixture(1, t(14, 0), MatchStatus::Live), fixture(2, t(20, 0), MatchStatus::Scheduled)];
        assert_eq!(next_fetch_delay(&f, t(14, 30), 15), LIVE_POLL);
    }

    #[test]
    fn ignores_stale_matches_the_api_never_finished() {
        let f = vec![fixture(1, t(9, 0), MatchStatus::Scheduled)];
        assert_eq!(next_fetch_delay(&f, t(13, 0), 15), Duration::minutes(15));
    }

    #[test]
    fn sends_each_reminder_once_inside_its_window() {
        let settings = Settings::default(); // 24 h, 1 h and kick-off
        let f = vec![fixture(7, t(14, 0), MatchStatus::Scheduled)];
        let mut sent = HashSet::new();

        assert!(due_notices(&f, t(12, 0), &settings, &sent).is_empty());

        let due = due_notices(&f, t(13, 5), &settings, &sent);
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].key, "7:r60");
        assert_eq!(due[0].title, "Arsenal v Everton in 1 hour");

        sent.insert(due[0].key.clone());
        assert!(due_notices(&f, t(13, 10), &settings, &sent).is_empty());

        // Too late: the 1-hour reminder's grace period has passed (app was closed)
        assert!(due_notices(&f, t(13, 45), &settings, &HashSet::new()).is_empty());

        let kickoff = due_notices(&f, t(14, 0), &settings, &sent);
        assert_eq!(kickoff[0].title, "Kick-off: Arsenal v Everton");
    }

    #[test]
    fn skips_reminders_when_kickoff_time_is_unconfirmed() {
        let mut f = fixture(1, t(14, 0), MatchStatus::Scheduled);
        f.time_tbd = true;
        assert!(due_notices(&[f], t(13, 5), &Settings::default(), &HashSet::new()).is_empty());
    }

    #[test]
    fn announces_recent_results_only() {
        let mut f = fixture(3, t(14, 0), MatchStatus::Finished);
        f.arsenal_goals = Some(2);
        f.opponent_goals = Some(1);
        f.outcome = Some(Outcome::Win);
        let settings = Settings::default();

        let due = due_notices(std::slice::from_ref(&f), t(16, 0), &settings, &HashSet::new());
        assert_eq!(due, vec![Notice {
            key: "3:ft".into(),
            title: "Full time: Arsenal win!".into(),
            body: "Arsenal 2–1 Everton · Premier League".into(),
        }]);

        assert!(due_notices(std::slice::from_ref(&f), t(23, 0), &settings, &HashSet::new()).is_empty());

        let off = Settings { result_notifications: false, ..Default::default() };
        assert!(due_notices(&[f], t(16, 0), &off, &HashSet::new()).is_empty());
    }

    #[test]
    fn labels_lead_times() {
        assert_eq!(lead_label(1440), "tomorrow");
        assert_eq!(lead_label(2880), "in 2 days");
        assert_eq!(lead_label(60), "in 1 hour");
        assert_eq!(lead_label(180), "in 3 hours");
        assert_eq!(lead_label(30), "in 30 minutes");
    }
}
