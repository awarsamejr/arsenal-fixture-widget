//! football-data.org client. The API key stays on the Rust side.

use std::time::Duration;

use reqwest::StatusCode;

use crate::models::{
    Fixture, HeadToHeadResponse, MatchDetails, MatchesResponse, StandingsResponse, TableRow, TeamChoice, TeamsResponse,
};

const BASE_URL: &str = "https://api.football-data.org/v4";

#[derive(Debug)]
pub enum ApiError {
    BadKey,
    RateLimited,
    Network(String),
    Unexpected(String),
}

impl ApiError {
    /// Short message suitable for showing in the widget.
    pub fn user_message(&self) -> String {
        match self {
            Self::BadKey => "The API key was rejected. Check it in Settings.".into(),
            Self::RateLimited => "Too many requests. Trying again shortly.".into(),
            Self::Network(_) => "Can't reach football-data.org. Check your connection.".into(),
            Self::Unexpected(detail) => format!("Couldn't load data ({detail})."),
        }
    }
}

pub struct Client {
    http: reqwest::Client,
}

impl Client {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("failed to build HTTP client");
        Self { http }
    }

    async fn get(&self, path: &str, key: &str) -> Result<String, ApiError> {
        let response = self
            .http
            .get(format!("{BASE_URL}{path}"))
            .header("X-Auth-Token", key)
            .send()
            .await
            .map_err(|e| ApiError::Network(e.to_string()))?;
        match response.status() {
            StatusCode::OK => response.text().await.map_err(|e| ApiError::Network(e.to_string())),
            StatusCode::BAD_REQUEST | StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(ApiError::BadKey),
            StatusCode::TOO_MANY_REQUESTS => Err(ApiError::RateLimited),
            other => Err(ApiError::Unexpected(format!("HTTP {}", other.as_u16()))),
        }
    }

    /// All of the team's matches this season: played, live and upcoming.
    pub async fn fetch_fixtures(&self, key: &str, team_id: u64) -> Result<Vec<Fixture>, ApiError> {
        let body = self.get(&format!("/teams/{team_id}/matches"), key).await?;
        parse_fixtures(&body, team_id)
    }

    pub async fn fetch_table(&self, key: &str, league: &str, team_id: u64) -> Result<Vec<TableRow>, ApiError> {
        let body = self.get(&format!("/competitions/{league}/standings"), key).await?;
        parse_table(&body, team_id)
    }

    /// The last 10 meetings between the two teams in this match.
    pub async fn fetch_match_details(&self, key: &str, match_id: u64, team_id: u64) -> Result<MatchDetails, ApiError> {
        let body = self.get(&format!("/matches/{match_id}/head2head?limit=10"), key).await?;
        parse_match_details(&body, match_id, team_id)
    }

    /// Every team in a league, for the team picker.
    pub async fn fetch_teams(&self, key: &str, league: &str) -> Result<Vec<TeamChoice>, ApiError> {
        let body = self.get(&format!("/competitions/{league}/teams"), key).await?;
        parse_teams(&body, league)
    }
}

pub fn parse_match_details(body: &str, match_id: u64, team_id: u64) -> Result<MatchDetails, ApiError> {
    let response: HeadToHeadResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad head-to-head data: {e}")))?;
    let meetings = response.matches.iter().filter_map(|m| Fixture::from_api(m, team_id)).collect();
    Ok(MatchDetails::new(match_id, meetings))
}

pub fn parse_fixtures(body: &str, team_id: u64) -> Result<Vec<Fixture>, ApiError> {
    let response: MatchesResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad match data: {e}")))?;
    let mut fixtures: Vec<Fixture> = response.matches.iter().filter_map(|m| Fixture::from_api(m, team_id)).collect();
    fixtures.sort_by_key(|f| f.kickoff);
    Ok(fixtures)
}

pub fn parse_table(body: &str, team_id: u64) -> Result<Vec<TableRow>, ApiError> {
    let response: StandingsResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad table data: {e}")))?;
    let total = response
        .standings
        .iter()
        .find(|g| g.kind == "TOTAL")
        .ok_or_else(|| ApiError::Unexpected("no league table".into()))?;
    Ok(total.table.iter().map(|r| TableRow::from_api(r, team_id)).collect())
}

pub fn parse_teams(body: &str, league: &str) -> Result<Vec<TeamChoice>, ApiError> {
    let response: TeamsResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad team list: {e}")))?;
    let mut teams: Vec<TeamChoice> = response
        .teams
        .into_iter()
        .map(|t| TeamChoice {
            id: t.id,
            short_name: t.short_name.unwrap_or_else(|| t.name.clone()),
            name: t.name,
            crest: t.crest,
            league: league.to_string(),
            venue: t.venue,
            colors: t.club_colors,
        })
        .collect();
    teams.sort_by(|a, b| a.short_name.cmp(&b.short_name));
    Ok(teams)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MatchStatus, Outcome};

    const MATCHES: &str = include_str!("../testdata/matches.json");
    const STANDINGS: &str = include_str!("../testdata/standings.json");
    /// The saved data is Arsenal's (football-data id 57)
    const ARSENAL: u64 = 57;
    const EVERTON: u64 = 62;

    #[test]
    fn reads_the_same_matches_from_another_teams_side() {
        // Arsenal's match list includes their games against Everton
        let everton = parse_fixtures(MATCHES, EVERTON).unwrap();
        assert!(!everton.is_empty());
        assert!(everton.iter().all(|f| f.team.short_name == "Everton" && f.opponent.short_name == "Arsenal"));

        let as_arsenal = parse_fixtures(MATCHES, ARSENAL).unwrap();
        let same = as_arsenal.iter().find(|f| f.id == everton[0].id).unwrap();
        assert_eq!(same.home, !everton[0].home);
        assert_eq!(same.team_goals, everton[0].opponent_goals);

        let table = parse_table(STANDINGS, EVERTON).unwrap();
        assert_eq!(table.iter().find(|r| r.is_team).unwrap().team.short_name, "Everton");
    }

    #[test]
    fn lists_teams_for_the_picker() {
        let teams = parse_teams(include_str!("../testdata/teams_pl.json"), "PL").unwrap();
        assert_eq!(teams.len(), 20);
        assert!(teams.windows(2).all(|w| w[0].short_name <= w[1].short_name), "sorted by name");
        let chelsea = teams.iter().find(|t| t.id == 61).unwrap();
        assert_eq!((chelsea.short_name.as_str(), chelsea.league.as_str()), ("Chelsea", "PL"));
        assert_eq!(chelsea.colors.as_deref(), Some("Royal Blue / White"));
        assert_eq!(chelsea.venue.as_deref(), Some("Stamford Bridge"));
    }

    #[test]
    fn parses_all_team_fixtures_sorted() {
        let fixtures = parse_fixtures(MATCHES, ARSENAL).unwrap();
        assert_eq!(fixtures.len(), 46);
        assert!(fixtures.windows(2).all(|w| w[0].kickoff <= w[1].kickoff));
        assert!(fixtures.iter().all(|f| f.team.short_name == "Arsenal"));
    }

    #[test]
    fn works_out_home_away_and_result() {
        let fixtures = parse_fixtures(MATCHES, ARSENAL).unwrap();
        // Opening day: Arsenal 3-0 Coventry at home
        let first = &fixtures[0];
        assert!(first.home);
        assert_eq!(first.opponent.short_name, "Coventry City");
        assert_eq!((first.team_goals, first.opponent_goals), (Some(3), Some(0)));
        assert_eq!(first.outcome, Some(Outcome::Win));
        assert_eq!(first.score_line().unwrap(), "Arsenal 3–0 Coventry City");

        // Away goals are flipped so team_goals is always ours
        let brighton = fixtures.iter().find(|f| f.opponent.short_name == "Brighton Hove").unwrap();
        assert!(!brighton.home);
        assert_eq!((brighton.team_goals, brighton.opponent_goals), (Some(0), Some(3)));
        assert_eq!(brighton.outcome, Some(Outcome::Loss));
        assert_eq!(brighton.score_line().unwrap(), "Brighton Hove 3–0 Arsenal");
    }

    #[test]
    fn upcoming_matches_have_no_score_or_outcome() {
        let fixtures = parse_fixtures(MATCHES, ARSENAL).unwrap();
        let upcoming: Vec<_> = fixtures.iter().filter(|f| f.status == MatchStatus::Scheduled).collect();
        assert_eq!(upcoming.len(), 36);
        assert!(upcoming.iter().all(|f| f.outcome.is_none() && f.team_goals.is_none()));
    }

    #[test]
    fn maps_api_statuses() {
        assert_eq!(MatchStatus::from_api("TIMED"), MatchStatus::Scheduled);
        assert_eq!(MatchStatus::from_api("IN_PLAY"), MatchStatus::Live);
        assert_eq!(MatchStatus::from_api("PAUSED"), MatchStatus::HalfTime);
        assert_eq!(MatchStatus::from_api("FINISHED"), MatchStatus::Finished);
        assert_eq!(MatchStatus::from_api("POSTPONED"), MatchStatus::Postponed);
    }

    #[test]
    fn parses_league_table_and_marks_the_team() {
        let table = parse_table(STANDINGS, ARSENAL).unwrap();
        assert_eq!(table.len(), 20);
        assert_eq!(table[0].position, 1);
        assert_eq!(table.iter().filter(|r| r.is_team).count(), 1);
    }

    #[test]
    fn reads_half_time_referee_and_matchday() {
        let fixtures = parse_fixtures(MATCHES, ARSENAL).unwrap();
        let first = &fixtures[0];
        assert_eq!((first.half_time_team, first.half_time_opponent), (Some(2), Some(0)));
        assert_eq!(first.referee.as_deref(), Some("Thomas Bramall"));
        assert_eq!(first.matchday, Some(1));
        assert!(fixtures.iter().filter(|f| f.status == MatchStatus::Scheduled).all(|f| f.half_time_team.is_none()));
    }

    #[test]
    fn builds_head_to_head_from_the_teams_side() {
        // Upcoming Arsenal v Everton; previous meetings include home and away games
        let details = parse_match_details(include_str!("../testdata/head2head.json"), 560616, ARSENAL).unwrap();
        let h = &details.head_to_head;
        assert_eq!(h.played as usize, details.meetings.len());
        assert_eq!(h.wins + h.draws + h.losses, h.played);
        assert!(details.meetings.iter().all(|m| m.id != 560616 && m.opponent.short_name == "Everton"));
        assert!(details.meetings.windows(2).all(|w| w[0].kickoff >= w[1].kickoff), "newest first");

        // Everton 0-1 Arsenal (Dec 2025) must count as a win with goals the right way round
        let away_win = details.meetings.iter().find(|m| m.kickoff.format("%Y-%m-%d").to_string() == "2025-12-20").unwrap();
        assert_eq!((away_win.team_goals, away_win.opponent_goals, away_win.outcome), (Some(1), Some(0), Some(Outcome::Win)));
    }

    #[test]
    fn rejects_garbage() {
        assert!(matches!(parse_fixtures("not json", ARSENAL), Err(ApiError::Unexpected(_))));
    }
}
