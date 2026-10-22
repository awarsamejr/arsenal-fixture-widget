//! football-data.org client. The API key stays on the Rust side.

use std::time::Duration;

use reqwest::StatusCode;

use crate::models::{Fixture, MatchesResponse, StandingsResponse, TableRow, ARSENAL_ID};

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

    /// All of Arsenal's matches this season: played, live and upcoming.
    pub async fn fetch_fixtures(&self, key: &str) -> Result<Vec<Fixture>, ApiError> {
        let body = self.get(&format!("/teams/{ARSENAL_ID}/matches"), key).await?;
        parse_fixtures(&body)
    }

    pub async fn fetch_table(&self, key: &str) -> Result<Vec<TableRow>, ApiError> {
        let body = self.get("/competitions/PL/standings", key).await?;
        parse_table(&body)
    }
}

pub fn parse_fixtures(body: &str) -> Result<Vec<Fixture>, ApiError> {
    let response: MatchesResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad match data: {e}")))?;
    let mut fixtures: Vec<Fixture> = response.matches.iter().filter_map(Fixture::from_api).collect();
    fixtures.sort_by_key(|f| f.kickoff);
    Ok(fixtures)
}

pub fn parse_table(body: &str) -> Result<Vec<TableRow>, ApiError> {
    let response: StandingsResponse =
        serde_json::from_str(body).map_err(|e| ApiError::Unexpected(format!("bad table data: {e}")))?;
    let total = response
        .standings
        .iter()
        .find(|g| g.kind == "TOTAL")
        .ok_or_else(|| ApiError::Unexpected("no league table".into()))?;
    Ok(total.table.iter().map(TableRow::from).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MatchStatus, Outcome};

    const MATCHES: &str = include_str!("../testdata/matches.json");
    const STANDINGS: &str = include_str!("../testdata/standings.json");

    #[test]
    fn parses_all_arsenal_fixtures_sorted() {
        let fixtures = parse_fixtures(MATCHES).unwrap();
        assert_eq!(fixtures.len(), 46);
        assert!(fixtures.windows(2).all(|w| w[0].kickoff <= w[1].kickoff));
        assert!(fixtures.iter().all(|f| f.arsenal.short_name == "Arsenal"));
    }

    #[test]
    fn works_out_home_away_and_result() {
        let fixtures = parse_fixtures(MATCHES).unwrap();
        // Opening day: Arsenal 3-0 Coventry at home
        let first = &fixtures[0];
        assert!(first.home);
        assert_eq!(first.opponent.short_name, "Coventry City");
        assert_eq!((first.arsenal_goals, first.opponent_goals), (Some(3), Some(0)));
        assert_eq!(first.outcome, Some(Outcome::Win));
        assert_eq!(first.score_line().unwrap(), "Arsenal 3–0 Coventry City");

        // Away goals are flipped so arsenal_goals is always ours
        let brighton = fixtures.iter().find(|f| f.opponent.short_name == "Brighton Hove").unwrap();
        assert!(!brighton.home);
        assert_eq!((brighton.arsenal_goals, brighton.opponent_goals), (Some(0), Some(3)));
        assert_eq!(brighton.outcome, Some(Outcome::Loss));
        assert_eq!(brighton.score_line().unwrap(), "Brighton Hove 3–0 Arsenal");
    }

    #[test]
    fn upcoming_matches_have_no_score_or_outcome() {
        let fixtures = parse_fixtures(MATCHES).unwrap();
        let upcoming: Vec<_> = fixtures.iter().filter(|f| f.status == MatchStatus::Scheduled).collect();
        assert_eq!(upcoming.len(), 36);
        assert!(upcoming.iter().all(|f| f.outcome.is_none() && f.arsenal_goals.is_none()));
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
    fn parses_league_table_and_marks_arsenal() {
        let table = parse_table(STANDINGS).unwrap();
        assert_eq!(table.len(), 20);
        assert_eq!(table[0].position, 1);
        assert_eq!(table.iter().filter(|r| r.is_arsenal).count(), 1);
    }

    #[test]
    fn rejects_garbage() {
        assert!(matches!(parse_fixtures("not json"), Err(ApiError::Unexpected(_))));
    }
}
