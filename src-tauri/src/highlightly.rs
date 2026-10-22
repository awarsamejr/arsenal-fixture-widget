//! Highlightly client: goals, cards, subs, team stats, line-ups and
//! predictions. The free plan allows 100 requests a day, so callers cache hard.

use std::time::Duration;

use chrono::{DateTime, Utc};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

use crate::api::ApiError;

const BASE_URL: &str = "https://soccer.highlightly.net";

// ---------- Raw responses (only the fields we use) ----------

#[derive(Deserialize)]
struct MatchList {
    data: Vec<RawMatchSummary>,
}

#[derive(Deserialize)]
struct RawMatchSummary {
    id: u64,
    date: DateTime<Utc>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMatch {
    home_team: RawTeam,
    #[serde(default)]
    events: Vec<RawEvent>,
    #[serde(default)]
    statistics: Vec<RawTeamStats>,
    venue: Option<RawVenue>,
    forecast: Option<RawForecast>,
    predictions: Option<RawPredictions>,
}

#[derive(Deserialize)]
struct RawTeam {
    id: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent {
    team: RawTeam,
    time: Option<String>,
    #[serde(rename = "type")]
    kind: String,
    player: Option<String>,
    assist: Option<String>,
    substituted: Option<String>,
}

#[derive(Deserialize)]
struct RawTeamStats {
    team: RawTeam,
    statistics: Vec<RawStat>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawStat {
    display_name: String,
    value: Option<f64>,
}

#[derive(Deserialize)]
struct RawVenue {
    name: Option<String>,
    city: Option<String>,
}

#[derive(Deserialize)]
struct RawForecast {
    status: Option<String>,
    temperature: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct RawPredictions {
    live: Vec<RawPrediction>,
    prematch: Vec<RawPrediction>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPrediction {
    generated_at: DateTime<Utc>,
    probabilities: RawProbabilities,
}

#[derive(Deserialize)]
struct RawProbabilities {
    home: String,
    draw: String,
    away: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawLineups {
    home_team: RawLineup,
    away_team: RawLineup,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawLineup {
    id: u64,
    formation: Option<String>,
    #[serde(default)]
    initial_lineup: Vec<Vec<RawPlayer>>,
    #[serde(default)]
    substitutes: Vec<RawPlayer>,
}

#[derive(Deserialize)]
struct RawPlayer {
    name: String,
    number: Option<u32>,
}

// ---------- What the UI receives (from your team's point of view) ----------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EventKind {
    Goal,
    PenaltyGoal,
    OwnGoal,
    MissedPenalty,
    YellowCard,
    RedCard,
    Substitution,
    Var,
}

impl EventKind {
    fn from_api(kind: &str) -> Option<Self> {
        let k = kind.to_lowercase();
        Some(if k.contains("var") {
            // "VAR Goal Confirmed" just repeats the goal above it
            if k.contains("confirmed") {
                return None;
            }
            Self::Var
        } else if k.contains("own goal") {
            Self::OwnGoal
        } else if k.contains("penalty") && k.contains("miss") {
            Self::MissedPenalty
        } else if k == "penalty" || k.contains("penalty goal") {
            Self::PenaltyGoal
        } else if k.contains("goal") {
            Self::Goal
        } else if k.contains("red") {
            Self::RedCard // also "Yellow-Red Card" (second yellow)
        } else if k.contains("yellow") {
            Self::YellowCard
        } else if k.contains("substitution") {
            Self::Substitution
        } else {
            return None;
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchEvent {
    /// As shown, e.g. "45+2"
    pub minute: String,
    pub kind: EventKind,
    /// True if the event belongs to your team (the team listed by the API)
    pub team: bool,
    pub player: String,
    /// Assist for goals, player coming on for subs
    pub detail: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatLine {
    pub label: String,
    pub team: f64,
    pub opponent: f64,
    /// "percent" (0–1 shown as %), "decimal" (xG) or "count"
    pub format: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LineupPlayer {
    pub name: String,
    pub number: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamLineup {
    pub formation: Option<String>,
    /// Goalkeeper first, then each line further forward, players left to right
    pub rows: Vec<Vec<LineupPlayer>>,
    pub substitutes: Vec<LineupPlayer>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Lineups {
    pub team: TeamLineup,
    pub opponent: TeamLineup,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Prediction {
    /// Percentages, from your team's point of view
    pub team_win: f64,
    pub draw: f64,
    pub opponent_win: f64,
    /// True if made during the match rather than before it
    pub live: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchStats {
    pub events: Vec<MatchEvent>,
    pub stats: Vec<StatLine>,
    pub lineups: Option<Lineups>,
    /// "Allianz Arena, Munich"
    pub venue: Option<String>,
    /// "Rain, 9°C"
    pub weather: Option<String>,
    pub prediction: Option<Prediction>,
}

/// The stats shown on the match screen, in order: (API name, label, format)
const STAT_LINES: &[(&str, &str, &str)] = &[
    ("Possession", "Possession", "percent"),
    ("Expected Goals", "Expected goals (xG)", "decimal"),
    ("Total shots", "Shots", "count"),
    ("Shots on target", "Shots on target", "count"),
    ("Big Chances Created", "Big chances", "count"),
    ("Pass accuracy", "Pass accuracy", "percent"),
    ("Corners", "Corners", "count"),
    ("Goalkeeper saves", "Saves", "count"),
    ("Fouls", "Fouls", "count"),
    ("Offsides", "Offsides", "count"),
    ("Yellow cards", "Yellow cards", "count"),
    ("Red cards", "Red cards", "count"),
];

// ---------- Client ----------

#[derive(Clone)]
pub struct StatsClient {
    http: reqwest::Client,
}

/// A response plus how many requests are left today (from the API's headers).
pub struct Counted<T> {
    pub value: T,
    pub remaining: Option<u32>,
}

impl StatsClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("failed to build HTTP client");
        Self { http }
    }

    async fn get(&self, path: &str, key: &str) -> Result<Counted<String>, ApiError> {
        let response = self
            .http
            .get(format!("{BASE_URL}{path}"))
            .header("x-rapidapi-key", key)
            .send()
            .await
            .map_err(|e| ApiError::Network(e.to_string()))?;
        let remaining = response
            .headers()
            .get("x-ratelimit-requests-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok());
        match response.status() {
            StatusCode::OK => {
                let body = response.text().await.map_err(|e| ApiError::Network(e.to_string()))?;
                Ok(Counted { value: body, remaining })
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(ApiError::BadKey),
            StatusCode::TOO_MANY_REQUESTS => Err(ApiError::RateLimited),
            other => Err(ApiError::Unexpected(format!("stats HTTP {}", other.as_u16()))),
        }
    }

    /// Possible Highlightly ids for a football-data team, best guess first.
    /// Tries the full name without "FC" etc., then the short name.
    pub async fn find_team_candidates(&self, key: &str, name: &str, short_name: &str) -> Result<Counted<Vec<u64>>, ApiError> {
        let names = [clean_team_name(name), short_name.to_string()];
        let mut remaining = None;
        for query in names.iter().filter(|q| !q.is_empty()) {
            let path = format!("/teams?name={}", urlencode(query));
            let res = self.get(&path, key).await?;
            remaining = res.remaining.or(remaining);
            let ids = rank_team_candidates(&res.value, &names)?;
            if !ids.is_empty() {
                return Ok(Counted { value: ids, remaining });
            }
        }
        Ok(Counted { value: Vec::new(), remaining })
    }

    /// Finds Highlightly's id for one of the team's matches by date and home/away.
    pub async fn find_match_id(&self, key: &str, team_id: u64, kickoff: DateTime<Utc>, team_home: bool) -> Result<Counted<Option<u64>>, ApiError> {
        let side = if team_home { "homeTeamId" } else { "awayTeamId" };
        let path = format!("/matches?{side}={team_id}&date={}&timezone=UTC", kickoff.format("%Y-%m-%d"));
        let res = self.get(&path, key).await?;
        let id = parse_match_id(&res.value, kickoff)?;
        Ok(Counted { value: id, remaining: res.remaining })
    }

    /// Events, stats, venue and predictions; line-ups too if asked (one extra request).
    pub async fn fetch_stats(&self, key: &str, team_id: u64, match_id: u64, with_lineups: bool) -> Result<Counted<MatchStats>, ApiError> {
        let res = self.get(&format!("/matches/{match_id}"), key).await?;
        let mut stats = parse_match(&res.value, team_id)?;
        let mut remaining = res.remaining;
        if with_lineups {
            // Line-ups are optional; a failure here shouldn't hide the rest
            if let Ok(lineup_res) = self.get(&format!("/lineups/{match_id}"), key).await {
                stats.lineups = parse_lineups(&lineup_res.value, team_id).ok().flatten();
                remaining = lineup_res.remaining.or(remaining);
            }
        }
        Ok(Counted { value: stats, remaining })
    }
}

// ---------- Parsing ----------

fn bad(what: &str, e: impl std::fmt::Display) -> ApiError {
    ApiError::Unexpected(format!("bad {what}: {e}"))
}

#[derive(Deserialize)]
struct TeamList {
    data: Vec<RawTeamSummary>,
}

#[derive(Deserialize)]
struct RawTeamSummary {
    id: u64,
    name: String,
    #[serde(rename = "type")]
    kind: Option<String>,
}

/// "FC Bayern München" → "Bayern München", "Arsenal FC" → "Arsenal"
pub fn clean_team_name(name: &str) -> String {
    const NOISE: &[&str] = &["FC", "AFC", "CF", "SC", "SV", "AC", "SSC", "1.", "&"];
    name.split_whitespace().filter(|w| !NOISE.contains(w)).collect::<Vec<_>>().join(" ")
}

/// Clubs (not national teams) whose name matches, exact matches first.
pub fn rank_team_candidates(body: &str, names: &[String]) -> Result<Vec<u64>, ApiError> {
    let list: TeamList = serde_json::from_str(body).map_err(|e| bad("team list", e))?;
    let wanted: Vec<String> = names.iter().map(|n| n.to_lowercase()).filter(|n| !n.is_empty()).collect();
    let clubs = || list.data.iter().filter(|t| t.kind.as_deref() != Some("national"));
    let exact = clubs().filter(|t| wanted.contains(&t.name.to_lowercase()));
    let partial = clubs().filter(|t| {
        let n = t.name.to_lowercase();
        !wanted.contains(&n) && wanted.iter().any(|w| n.contains(w.as_str()) || w.contains(n.as_str()))
    });
    let mut ids: Vec<u64> = exact.chain(partial).map(|t| t.id).collect();
    ids.dedup();
    ids.truncate(3); // only ever try a few
    Ok(ids)
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

pub fn parse_match_id(body: &str, kickoff: DateTime<Utc>) -> Result<Option<u64>, ApiError> {
    let list: MatchList = serde_json::from_str(body).map_err(|e| bad("match list", e))?;
    // If there are somehow two on the same day, take the closest kick-off
    Ok(list.data.iter().min_by_key(|m| (m.date - kickoff).num_seconds().abs()).map(|m| m.id))
}

pub fn parse_match(body: &str, team_id: u64) -> Result<MatchStats, ApiError> {
    // /matches/{id} returns a one-item list
    let mut list: Vec<RawMatch> = serde_json::from_str(body).map_err(|e| bad("match", e))?;
    let m = list.pop().ok_or_else(|| ApiError::Unexpected("match not found".into()))?;
    let team_home = m.home_team.id == team_id;

    let events = m
        .events
        .iter()
        .filter_map(|e| {
            let kind = EventKind::from_api(&e.kind)?;
            let detail = match kind {
                EventKind::Substitution => e.substituted.clone(),
                EventKind::Goal | EventKind::PenaltyGoal => e.assist.clone(),
                _ => None,
            };
            Some(MatchEvent {
                minute: e.time.clone().unwrap_or_default().trim_end_matches('\'').to_string(),
                kind,
                team: e.team.id == team_id,
                player: fix_text(e.player.as_deref().unwrap_or("Unknown")).trim().to_string(),
                detail: detail.map(|d| fix_text(&d).trim().to_string()),
            })
        })
        .collect();

    let stats = stat_lines(&m.statistics, team_id);

    let venue = m.venue.and_then(|v| match (v.name, v.city) {
        (Some(n), Some(c)) => Some(format!("{}, {}", fix_text(&n), fix_text(&c))),
        (Some(n), None) => Some(fix_text(&n)),
        _ => None,
    });

    let weather = m.forecast.and_then(|f| {
        let status = f.status.map(|s| {
            let s = fix_text(&s);
            let mut chars = s.chars();
            chars.next().map(|c| c.to_uppercase().collect::<String>() + chars.as_str()).unwrap_or_default()
        });
        let temp = f
            .temperature
            .and_then(|t| fix_text(&t).trim_end_matches("°C").trim().parse::<f64>().ok())
            .map(|t| format!("{}°C", t.round()));
        match (status, temp) {
            (Some(s), Some(t)) => Some(format!("{s}, {t}")),
            (Some(s), None) => Some(s),
            (None, Some(t)) => Some(t),
            (None, None) => None,
        }
    });

    // Prefer the latest in-match prediction, else the latest pre-match one
    let predictions = m.predictions.unwrap_or_default();
    let (latest, live) = match predictions.live.iter().max_by_key(|x| x.generated_at) {
        Some(x) => (Some(x), true),
        None => (predictions.prematch.iter().max_by_key(|x| x.generated_at), false),
    };
    let prediction = latest.and_then(|x| {
        let pct = |s: &str| s.trim_end_matches('%').parse::<f64>().ok();
        let (home, draw, away) = (pct(&x.probabilities.home)?, pct(&x.probabilities.draw)?, pct(&x.probabilities.away)?);
        let (team_win, opponent_win) = if team_home { (home, away) } else { (away, home) };
        Some(Prediction { team_win, draw, opponent_win, live })
    });

    Ok(MatchStats { events, stats, lineups: None, venue, weather, prediction })
}

fn stat_lines(teams: &[RawTeamStats], team_id: u64) -> Vec<StatLine> {
    let find = |ours: bool, name: &str| -> Option<f64> {
        let team = teams.iter().find(|t| (t.team.id == team_id) == ours)?;
        let get = |n: &str| team.statistics.iter().find(|s| s.display_name.eq_ignore_ascii_case(n)).and_then(|s| s.value);
        match name {
            // Not given directly, so worked out from the parts
            "Total shots" => Some(get("Shots on target")? + get("Shots off target")? + get("Blocked shots").unwrap_or(0.0)),
            "Pass accuracy" => {
                let total = get("Total passes")?;
                (total > 0.0).then(|| get("Successful passes").unwrap_or(0.0) / total)
            }
            other => get(other),
        }
    };
    STAT_LINES
        .iter()
        .filter_map(|&(name, label, format)| {
            Some(StatLine {
                label: label.into(),
                team: find(true, name)?,
                opponent: find(false, name)?,
                format: format.into(),
            })
        })
        .collect()
}

pub fn parse_lineups(body: &str, team_id: u64) -> Result<Option<Lineups>, ApiError> {
    let raw: RawLineups = serde_json::from_str(body).map_err(|e| bad("line-ups", e))?;
    let convert = |l: &RawLineup| TeamLineup {
        formation: l.formation.clone(),
        rows: l
            .initial_lineup
            .iter()
            .map(|row| row.iter().map(player).collect())
            .collect(),
        substitutes: l.substitutes.iter().map(player).collect(),
    };
    let (ours, theirs) = if raw.home_team.id == team_id {
        (&raw.home_team, &raw.away_team)
    } else {
        (&raw.away_team, &raw.home_team)
    };
    if ours.initial_lineup.is_empty() {
        return Ok(None); // not announced yet
    }
    Ok(Some(Lineups { team: convert(ours), opponent: convert(theirs) }))
}

fn player(p: &RawPlayer) -> LineupPlayer {
    LineupPlayer { name: fix_text(&p.name).trim().to_string(), number: p.number }
}

/// Repairs text that was UTF-8 but got decoded as Latin-1 somewhere upstream,
/// e.g. "DÃ­az" → "Díaz", "9Â°C" → "9°C". Leaves normal text alone.
pub fn fix_text(s: &str) -> String {
    if !s.contains(['Ã', 'Â', 'Å', 'Ä']) {
        return s.to_string();
    }
    let bytes: Option<Vec<u8>> = s.chars().map(|c| u8::try_from(u32::from(c)).ok()).collect();
    bytes.and_then(|b| String::from_utf8(b).ok()).unwrap_or_else(|| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    const MATCH: &str = include_str!("../testdata/hl_match.json");
    const LINEUPS: &str = include_str!("../testdata/hl_lineups.json");
    const MATCHES: &str = include_str!("../testdata/hl_matches.json");
    /// The saved data is Bayern v Arsenal; Arsenal's Highlightly id
    const ARSENAL: u64 = 36526;
    const BAYERN: u64 = 134391;

    #[test]
    fn reads_the_same_match_from_the_other_side() {
        let ours = parse_match(MATCH, ARSENAL).unwrap();
        let theirs = parse_match(MATCH, BAYERN).unwrap();
        assert_eq!(ours.events.len(), theirs.events.len());
        assert!(ours.events.iter().zip(&theirs.events).all(|(a, b)| a.team != b.team));
        let (a, b) = (&ours.stats[0], &theirs.stats[0]);
        assert_eq!((a.team, a.opponent), (b.opponent, b.team));
        assert_eq!(parse_lineups(LINEUPS, BAYERN).unwrap().unwrap().team.rows[0][0].name, "M. Neuer");
    }

    #[test]
    fn ranks_club_name_matches() {
        let body = include_str!("../testdata/hl_teams.json");
        let names = vec![clean_team_name("Arsenal FC"), "Arsenal".to_string()];
        // Two clubs are called exactly "Arsenal"; the national team is skipped
        assert_eq!(rank_team_candidates(body, &names).unwrap(), vec![36526, 8016353]);
        assert_eq!(clean_team_name("FC Bayern München"), "Bayern München");
        assert_eq!(clean_team_name("Brighton & Hove Albion FC"), "Brighton Hove Albion");
        assert_eq!(urlencode("Bayern München"), "Bayern%20M%C3%BCnchen");
    }

    #[test]
    fn finds_the_match_on_the_day() {
        let kickoff = Utc.with_ymd_and_hms(2026, 10, 21, 19, 0, 0).unwrap();
        // The saved list is every CL game that day; the closest-kickoff rule picks one of them
        assert!(parse_match_id(MATCHES, kickoff).unwrap().is_some());
        assert_eq!(parse_match_id(r#"{"data":[]}"#, kickoff).unwrap(), None);
    }

    #[test]
    fn reads_events_from_the_teams_side() {
        let s = parse_match(MATCH, ARSENAL).unwrap();
        let goals: Vec<_> = s.events.iter().filter(|e| matches!(e.kind, EventKind::Goal | EventKind::PenaltyGoal)).collect();
        assert_eq!(goals.len(), 4, "Eze, Davies, Kane (pen), Rice");
        assert_eq!(goals.iter().filter(|g| g.team).count(), 2);

        let eze = &goals[0];
        assert_eq!((eze.minute.as_str(), eze.player.as_str(), eze.detail.as_deref()), ("25", "Eberechi Eze", Some("Martin Odegaard")));
        assert!(goals.iter().any(|g| g.kind == EventKind::PenaltyGoal && g.player == "Harry Kane" && !g.team));

        // The VAR confirmation duplicates Eze's goal, so it's dropped
        assert!(s.events.iter().all(|e| e.kind != EventKind::Var));

        // Subs: `player` goes off, `detail` comes on
        let first_sub = s.events.iter().find(|e| e.kind == EventKind::Substitution).unwrap();
        assert_eq!((first_sub.player.as_str(), first_sub.detail.as_deref()), ("Bukayo Saka", Some("Eberechi Eze")));

        // Trailing spaces in names are trimmed ("Ezri Konsa ")
        assert!(s.events.iter().any(|e| e.player == "Ezri Konsa"));
    }

    #[test]
    fn builds_stat_lines_for_both_teams() {
        let s = parse_match(MATCH, ARSENAL).unwrap();
        let get = |label: &str| s.stats.iter().find(|l| l.label == label).unwrap();
        let possession = get("Possession");
        assert_eq!((possession.team, possession.opponent), (0.54, 0.46));
        assert_eq!(get("Shots").team, 14.0); // 5 on + 4 off + 5 blocked
        let pass = get("Pass accuracy").team;
        assert!((pass - 436.0 / 502.0).abs() < 1e-9);
        assert_eq!(get("Expected goals (xG)").format, "decimal");
    }

    #[test]
    fn reads_venue_weather_and_prediction() {
        let s = parse_match(MATCH, ARSENAL).unwrap();
        assert_eq!(s.venue.as_deref(), Some("Allianz Arena, Munich"));
        assert_eq!(s.weather.as_deref(), Some("Rain, 9°C"));
        let p = s.prediction.unwrap();
        assert!(p.live);
        assert!((p.team_win + p.draw + p.opponent_win - 100.0).abs() < 0.5);
    }

    #[test]
    fn reads_lineups_with_the_team_first() {
        let l = parse_lineups(LINEUPS, ARSENAL).unwrap().unwrap();
        assert_eq!(l.team.formation.as_deref(), Some("4-3-3"));
        assert_eq!(l.team.rows[0][0].name, "David Raya");
        assert_eq!(l.team.rows.iter().map(Vec::len).sum::<usize>(), 11);
        assert_eq!(l.opponent.rows[0][0].name, "M. Neuer");
        assert!(l.opponent.substitutes.iter().any(|p| p.name == "L. Díaz"), "mojibake repaired");
    }

    #[test]
    fn repairs_double_encoded_text_only() {
        assert_eq!(fix_text("L. DÃ\u{ad}az"), "L. Díaz");
        assert_eq!(fix_text("9.24Â°C"), "9.24°C");
        assert_eq!(fix_text("Gabriel Magalhães"), "Gabriel Magalhães");
        assert_eq!(fix_text("Ødegaard"), "Ødegaard");
    }
}
