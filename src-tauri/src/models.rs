//! Data types: the raw shapes football-data.org sends, and the tidier
//! shapes the UI receives.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// The team the app follows (picked in Settings).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TeamChoice {
    /// football-data.org team id
    pub id: u64,
    pub name: String,
    pub short_name: String,
    pub crest: Option<String>,
    /// League code for the table, e.g. "PL", "BL1"
    pub league: String,
    pub venue: Option<String>,
    /// e.g. "Red / White"; the UI turns this into a theme colour
    pub colors: Option<String>,
}

impl Default for TeamChoice {
    /// Arsenal, so existing installs carry on as before.
    fn default() -> Self {
        Self {
            id: 57,
            name: "Arsenal FC".into(),
            short_name: "Arsenal".into(),
            crest: Some("https://crests.football-data.org/57.png".into()),
            league: "PL".into(),
            venue: Some("Emirates Stadium".into()),
            colors: Some("Red / White".into()),
        }
    }
}

/// Leagues the free football-data.org plan covers: (code, name).
pub const LEAGUES: &[(&str, &str)] = &[
    ("PL", "Premier League"),
    ("ELC", "Championship"),
    ("PD", "La Liga"),
    ("BL1", "Bundesliga"),
    ("SA", "Serie A"),
    ("FL1", "Ligue 1"),
    ("DED", "Eredivisie"),
    ("PPL", "Primeira Liga"),
    ("BSA", "Brasileirão"),
];

// ---------- Raw API responses (only the fields we use) ----------

#[derive(Deserialize)]
pub struct TeamsResponse {
    pub teams: Vec<ApiTeamDetails>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiTeamDetails {
    pub id: u64,
    pub name: String,
    pub short_name: Option<String>,
    pub crest: Option<String>,
    pub venue: Option<String>,
    pub club_colors: Option<String>,
}

#[derive(Deserialize)]
pub struct MatchesResponse {
    pub matches: Vec<ApiMatch>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMatch {
    pub id: u64,
    pub utc_date: DateTime<Utc>,
    pub status: String,
    pub matchday: Option<u32>,
    pub stage: Option<String>,
    pub competition: ApiCompetition,
    pub home_team: ApiTeam,
    pub away_team: ApiTeam,
    pub score: ApiScore,
    #[serde(default)]
    pub referees: Vec<ApiReferee>,
}

#[derive(Deserialize)]
pub struct ApiReferee {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: Option<String>,
}

#[derive(Deserialize)]
pub struct HeadToHeadResponse {
    pub matches: Vec<ApiMatch>,
}

#[derive(Deserialize)]
pub struct ApiCompetition {
    pub name: String,
    pub code: Option<String>,
    pub emblem: Option<String>,
}

/// Team fields can all be null, e.g. a cup tie whose opponent isn't decided yet.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ApiTeam {
    pub id: Option<u64>,
    pub name: Option<String>,
    pub short_name: Option<String>,
    pub crest: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiScore {
    pub full_time: Goals,
    #[serde(default)]
    pub half_time: Goals,
}

#[derive(Deserialize, Default)]
pub struct Goals {
    pub home: Option<u32>,
    pub away: Option<u32>,
}

#[derive(Deserialize)]
pub struct StandingsResponse {
    pub standings: Vec<ApiStandingGroup>,
}

#[derive(Deserialize)]
pub struct ApiStandingGroup {
    #[serde(rename = "type")]
    pub kind: String,
    pub table: Vec<ApiTableRow>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiTableRow {
    pub position: u32,
    pub team: ApiTeam,
    pub played_games: u32,
    pub won: u32,
    pub draw: u32,
    pub lost: u32,
    pub points: u32,
    pub goal_difference: i32,
}

// ---------- What the UI receives ----------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MatchStatus {
    Scheduled,
    Live,
    HalfTime,
    Finished,
    Postponed,
    Cancelled,
}

impl MatchStatus {
    pub fn from_api(status: &str) -> Self {
        match status {
            "IN_PLAY" | "LIVE" => Self::Live,
            "PAUSED" => Self::HalfTime,
            "FINISHED" | "AWARDED" => Self::Finished,
            "POSTPONED" | "SUSPENDED" => Self::Postponed,
            "CANCELLED" => Self::Cancelled,
            _ => Self::Scheduled, // SCHEDULED, TIMED
        }
    }

    pub fn is_live(self) -> bool {
        matches!(self, Self::Live | Self::HalfTime)
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Outcome {
    Win,
    Draw,
    Loss,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TeamInfo {
    pub name: String,
    pub short_name: String,
    pub crest: Option<String>,
}

impl From<&ApiTeam> for TeamInfo {
    fn from(t: &ApiTeam) -> Self {
        let name = t.name.clone().unwrap_or_else(|| "TBD".into());
        Self {
            short_name: t.short_name.clone().unwrap_or_else(|| name.clone()),
            name,
            crest: t.crest.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Fixture {
    pub id: u64,
    pub kickoff: DateTime<Utc>,
    /// True while the kick-off time hasn't been confirmed (only the date is known)
    pub time_tbd: bool,
    pub status: MatchStatus,
    pub competition: String,
    pub competition_code: Option<String>,
    pub competition_emblem: Option<String>,
    pub home: bool,
    pub team: TeamInfo,
    pub opponent: TeamInfo,
    pub team_goals: Option<u32>,
    pub opponent_goals: Option<u32>,
    pub outcome: Option<Outcome>,
    #[serde(default)]
    pub half_time_team: Option<u32>,
    #[serde(default)]
    pub half_time_opponent: Option<u32>,
    #[serde(default)]
    pub matchday: Option<u32>,
    /// e.g. "REGULAR_SEASON", "LEAGUE_STAGE", "QUARTER_FINALS"
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub referee: Option<String>,
}

impl Fixture {
    /// Builds a fixture from your team's point of view; None if the team isn't playing.
    pub fn from_api(m: &ApiMatch, team_id: u64) -> Option<Self> {
        let home = if m.home_team.id == Some(team_id) {
            true
        } else if m.away_team.id == Some(team_id) {
            false
        } else {
            return None;
        };
        let (us, them) = if home { (&m.home_team, &m.away_team) } else { (&m.away_team, &m.home_team) };
        let ours_first = |g: &Goals| if home { (g.home, g.away) } else { (g.away, g.home) };
        let (team_goals, opponent_goals) = ours_first(&m.score.full_time);
        let (half_time_team, half_time_opponent) = ours_first(&m.score.half_time);
        let referee = m
            .referees
            .iter()
            .find(|r| r.kind.as_deref().is_none_or(|k| k == "REFEREE"))
            .map(|r| r.name.clone());
        let status = MatchStatus::from_api(&m.status);
        let outcome = match (status, team_goals, opponent_goals) {
            (MatchStatus::Finished, Some(a), Some(o)) => Some(if a > o {
                Outcome::Win
            } else if a < o {
                Outcome::Loss
            } else {
                Outcome::Draw
            }),
            _ => None,
        };
        Some(Self {
            id: m.id,
            kickoff: m.utc_date,
            // TIMED means the kick-off time is confirmed; SCHEDULED means only the date is
            time_tbd: m.status == "SCHEDULED",
            status,
            competition: m.competition.name.clone(),
            competition_code: m.competition.code.clone(),
            competition_emblem: m.competition.emblem.clone(),
            home,
            team: us.into(),
            opponent: them.into(),
            team_goals,
            opponent_goals,
            outcome,
            half_time_team,
            half_time_opponent,
            matchday: m.matchday,
            stage: m.stage.clone(),
            referee,
        })
    }

    /// "Arsenal v Everton" with the home side first.
    pub fn title(&self) -> String {
        if self.home {
            format!("{} v {}", self.team.short_name, self.opponent.short_name)
        } else {
            format!("{} v {}", self.opponent.short_name, self.team.short_name)
        }
    }

    /// "Arsenal 2–1 Everton" with the home side first, or None before a score exists.
    pub fn score_line(&self) -> Option<String> {
        let (a, o) = (self.team_goals?, self.opponent_goals?);
        Some(if self.home {
            format!("{} {}–{} {}", self.team.short_name, a, o, self.opponent.short_name)
        } else {
            format!("{} {}–{} {}", self.opponent.short_name, o, a, self.team.short_name)
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TableRow {
    pub position: u32,
    pub team: TeamInfo,
    pub played: u32,
    pub won: u32,
    pub draw: u32,
    pub lost: u32,
    pub goal_difference: i32,
    pub points: u32,
    pub is_team: bool,
}

impl TableRow {
    pub fn from_api(r: &ApiTableRow, team_id: u64) -> Self {
        Self {
            position: r.position,
            team: (&r.team).into(),
            played: r.played_games,
            won: r.won,
            draw: r.draw,
            lost: r.lost,
            goal_difference: r.goal_difference,
            points: r.points,
            is_team: r.team.id == Some(team_id),
        }
    }
}

/// Your team's record against one opponent.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HeadToHead {
    pub played: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
    pub goals_for: u32,
    pub goals_against: u32,
}

/// Extra information loaded when a match is opened.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MatchDetails {
    pub fixture_id: u64,
    pub head_to_head: HeadToHead,
    /// Previous meetings, newest first (not including this match)
    pub meetings: Vec<Fixture>,
}

impl MatchDetails {
    pub fn new(fixture_id: u64, mut meetings: Vec<Fixture>) -> Self {
        meetings.retain(|f| f.id != fixture_id && f.status == MatchStatus::Finished);
        meetings.sort_by_key(|f| std::cmp::Reverse(f.kickoff));
        let mut h2h = HeadToHead::default();
        for f in &meetings {
            h2h.played += 1;
            h2h.goals_for += f.team_goals.unwrap_or(0);
            h2h.goals_against += f.opponent_goals.unwrap_or(0);
            match f.outcome {
                Some(Outcome::Win) => h2h.wins += 1,
                Some(Outcome::Draw) => h2h.draws += 1,
                Some(Outcome::Loss) => h2h.losses += 1,
                None => {}
            }
        }
        Self { fixture_id, head_to_head: h2h, meetings }
    }
}

/// Everything the UI shows, sent whenever something changes.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    /// Sorted by kick-off, oldest first
    pub fixtures: Vec<Fixture>,
    pub table: Vec<TableRow>,
    pub last_updated: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub has_api_key: bool,
    pub refreshing: bool,
}

impl Snapshot {
    /// The live match if there is one, otherwise the next one to be played.
    pub fn headline_fixture(&self) -> Option<&Fixture> {
        self.fixtures
            .iter()
            .find(|f| f.status.is_live())
            .or_else(|| self.fixtures.iter().find(|f| f.status == MatchStatus::Scheduled))
    }
}
