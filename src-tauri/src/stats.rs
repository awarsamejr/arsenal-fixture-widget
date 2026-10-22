//! Loads Highlightly match stats on demand, caching them so the free plan's
//! 100 requests a day go a long way.

use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::api::ApiError;
use crate::highlightly::{MatchStats, StatsClient};
use crate::models::{Fixture, MatchStatus};
use crate::settings::{self, StatsCache, StatsEntry};
use crate::state::AppState;

/// What the match screen gets back.
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum StatsResult {
    /// No Highlightly key set up
    NoKey,
    /// Highlightly doesn't have this match
    NotFound,
    #[serde(rename_all = "camelCase")]
    Ready { stats: MatchStats, requests_left: Option<u32> },
}

pub struct StatsStore(pub Mutex<StatsCache>);

/// Whether a cached entry can be shown without asking the API again.
pub fn is_fresh(entry: &StatsEntry, fixture: &Fixture, now: DateTime<Utc>) -> bool {
    if entry.is_final {
        return true;
    }
    let age = now - entry.fetched_at;
    let max_age = match fixture.status {
        // Final stats arrive once the match is finished, so fetch once more
        MatchStatus::Finished => return false,
        MatchStatus::Live | MatchStatus::HalfTime => Duration::seconds(60),
        // Line-ups appear about an hour before kick-off
        _ if fixture.kickoff - now < Duration::hours(3) => Duration::minutes(15),
        _ => Duration::hours(6),
    };
    age < max_age
}

/// Line-ups cost an extra request, so only ask when they could exist.
fn wants_lineups(fixture: &Fixture, now: DateTime<Utc>) -> bool {
    fixture.status != MatchStatus::Scheduled || fixture.kickoff - now < Duration::hours(2)
}

pub async fn get_stats<R: Runtime>(app: &AppHandle<R>, fixture_id: u64) -> Result<StatsResult, String> {
    let state = app.state::<AppState>();
    let fixture = state
        .snapshot()
        .fixtures
        .into_iter()
        .find(|f| f.id == fixture_id)
        .ok_or("Match not found.")?;
    let settings = state.settings();
    let Some(key) = settings.effective_stats_key() else {
        return Ok(StatsResult::NoKey);
    };
    let team = settings.team;

    let now = Utc::now();
    let store = app.state::<StatsStore>();
    let (cached, team_candidates) = {
        let mut cache = store.0.lock().unwrap_or_else(|p| p.into_inner());
        // Switched team: nothing cached applies any more
        if cache.team_id != Some(team.id) {
            cache.entries.clear();
            cache.highlightly_team = None;
            cache.team_id = Some(team.id);
        }
        (
            cache.entries.get(&fixture_id).cloned().map(|e| (e, cache.requests_left)),
            cache.highlightly_team.clone(),
        )
    };
    if let Some((entry, requests_left)) = &cached {
        if is_fresh(entry, &fixture, now) {
            return Ok(match &entry.stats {
                Some(stats) => StatsResult::Ready { stats: stats.clone(), requests_left: *requests_left },
                None => StatsResult::NotFound,
            });
        }
    }

    let client = app.state::<StatsClient>();
    let mut requests_left = None;

    // Highlightly's id(s) for the team: searched once per team, then remembered
    let candidates = match team_candidates {
        Some(ids) => ids,
        None => {
            let found = client.find_team_candidates(&key, &team.name, &team.short_name).await.map_err(message)?;
            requests_left = found.remaining;
            found.value
        }
    };

    // Find Highlightly's id for this match (once; it never changes). If several
    // clubs share the team's name, the one that has this match is the right one.
    let known_id = cached.as_ref().and_then(|(e, _)| e.highlightly_id);
    let mut confirmed_team = None;
    let highlightly_id = match known_id {
        Some(id) => Some(id),
        None => {
            let mut found_id = None;
            for &candidate in &candidates {
                let found = client.find_match_id(&key, candidate, fixture.kickoff, fixture.home).await.map_err(message)?;
                requests_left = found.remaining.or(requests_left);
                if found.value.is_some() {
                    found_id = found.value;
                    confirmed_team = Some(candidate);
                    break;
                }
            }
            found_id
        }
    };
    let team_hl_id = confirmed_team.or(candidates.first().copied());

    let stats = match (highlightly_id, team_hl_id) {
        (Some(id), Some(team_hl_id)) => {
            let res = client.fetch_stats(&key, team_hl_id, id, wants_lineups(&fixture, now)).await.map_err(message)?;
            requests_left = res.remaining.or(requests_left);
            Some(res.value)
        }
        _ => None,
    };

    {
        let mut cache = store.0.lock().unwrap_or_else(|p| p.into_inner());
        cache.highlightly_team = Some(match confirmed_team {
            Some(id) => vec![id],
            None => candidates,
        });
        cache.entries.insert(
            fixture_id,
            StatsEntry {
                highlightly_id,
                stats: stats.clone(),
                fetched_at: now,
                is_final: fixture.status == MatchStatus::Finished && stats.is_some(),
            },
        );
        if requests_left.is_some() {
            cache.requests_left = requests_left;
        }
        if let Err(e) = settings::save_stats_cache(app, &cache) {
            eprintln!("couldn't save stats cache: {e}");
        }
        requests_left = cache.requests_left;
    }

    Ok(match stats {
        Some(stats) => StatsResult::Ready { stats, requests_left },
        None => StatsResult::NotFound,
    })
}

fn message(e: ApiError) -> String {
    match e {
        ApiError::BadKey => "The Highlightly key was rejected. Check it in Settings.".into(),
        ApiError::RateLimited => "Today's 100 stats requests are used up. They reset tomorrow.".into(),
        other => other.user_message(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TeamInfo;
    use chrono::TimeZone;

    fn fixture(status: MatchStatus, kickoff: DateTime<Utc>) -> Fixture {
        let team = |n: &str| TeamInfo { name: n.into(), short_name: n.into(), crest: None };
        Fixture {
            id: 1,
            kickoff,
            time_tbd: false,
            status,
            competition: "Premier League".into(),
            competition_code: None,
            competition_emblem: None,
            home: true,
            team: team("Arsenal"),
            opponent: team("Everton"),
            team_goals: None,
            opponent_goals: None,
            outcome: None,
            half_time_team: None,
            half_time_opponent: None,
            matchday: None,
            stage: None,
            referee: None,
        }
    }

    fn entry(fetched_at: DateTime<Utc>, is_final: bool) -> StatsEntry {
        StatsEntry { highlightly_id: Some(9), stats: None, fetched_at, is_final }
    }

    #[test]
    fn caches_by_how_much_the_match_can_still_change() {
        let now = Utc.with_ymd_and_hms(2026, 10, 24, 12, 0, 0).unwrap();
        let ago = |m: i64| now - Duration::minutes(m);

        // Finished and fetched after full time: never again
        assert!(is_fresh(&entry(ago(60 * 24 * 30), true), &fixture(MatchStatus::Finished, ago(60 * 24 * 31)), now));
        // Fetched before it finished: fetch once more for the final numbers
        assert!(!is_fresh(&entry(ago(1), false), &fixture(MatchStatus::Finished, ago(120)), now));
        // Live: every minute
        assert!(is_fresh(&entry(ago(0), false), &fixture(MatchStatus::Live, ago(30)), now));
        assert!(!is_fresh(&entry(ago(2), false), &fixture(MatchStatus::Live, ago(30)), now));
        // Kick-off in 2 hours: every 15 minutes (line-ups may appear)
        let soon = now + Duration::hours(2);
        assert!(is_fresh(&entry(ago(10), false), &fixture(MatchStatus::Scheduled, soon), now));
        assert!(!is_fresh(&entry(ago(20), false), &fixture(MatchStatus::Scheduled, soon), now));
        // Days away: every 6 hours
        let later = now + Duration::days(5);
        assert!(is_fresh(&entry(ago(300), false), &fixture(MatchStatus::Scheduled, later), now));
        assert!(!is_fresh(&entry(ago(400), false), &fixture(MatchStatus::Scheduled, later), now));
    }

    #[test]
    fn serialises_the_shape_the_ui_expects() {
        let stats = crate::highlightly::parse_match(include_str!("../testdata/hl_match.json"), 36526).unwrap();
        let json = serde_json::to_value(StatsResult::Ready { stats, requests_left: Some(95) }).unwrap();
        assert_eq!(json["status"], "ready");
        assert_eq!(json["requestsLeft"], 95);
        assert_eq!(json["stats"]["events"][0]["kind"], "substitution");
        assert!(json["stats"]["stats"][0]["format"].is_string());
        assert_eq!(serde_json::to_value(StatsResult::NoKey).unwrap(), serde_json::json!({ "status": "noKey" }));
    }

    #[test]
    fn only_asks_for_lineups_when_they_could_exist() {
        let now = Utc.with_ymd_and_hms(2026, 10, 24, 12, 0, 0).unwrap();
        assert!(!wants_lineups(&fixture(MatchStatus::Scheduled, now + Duration::days(2)), now));
        assert!(wants_lineups(&fixture(MatchStatus::Scheduled, now + Duration::minutes(90)), now));
        assert!(wants_lineups(&fixture(MatchStatus::Finished, now - Duration::days(2)), now));
    }
}
