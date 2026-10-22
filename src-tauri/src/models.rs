//! Data types: the raw shapes football-data.org sends, and the tidier
//! shapes the UI receives.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const ARSENAL_ID: u64 = 57;

// ---------- Raw API responses (only the fields we use) ----------

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
    pub competition: ApiCompetition,
    pub home_team: ApiTeam,
    pub away_team: ApiTeam,
    pub score: ApiScore,
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
    pub arsenal: TeamInfo,
    pub opponent: TeamInfo,
    pub arsenal_goals: Option<u32>,
    pub opponent_goals: Option<u32>,
    pub outcome: Option<Outcome>,
}

impl Fixture {
    /// Returns None for matches that don't involve Arsenal.
    pub fn from_api(m: &ApiMatch) -> Option<Self> {
        let home = if m.home_team.id == Some(ARSENAL_ID) {
            true
        } else if m.away_team.id == Some(ARSENAL_ID) {
            false
        } else {
            return None;
        };
        let (us, them) = if home { (&m.home_team, &m.away_team) } else { (&m.away_team, &m.home_team) };
        let (arsenal_goals, opponent_goals) = if home {
            (m.score.full_time.home, m.score.full_time.away)
        } else {
            (m.score.full_time.away, m.score.full_time.home)
        };
        let status = MatchStatus::from_api(&m.status);
        let outcome = match (status, arsenal_goals, opponent_goals) {
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
            arsenal: us.into(),
            opponent: them.into(),
            arsenal_goals,
            opponent_goals,
            outcome,
        })
    }

    /// "Arsenal v Everton" with the home side first.
    pub fn title(&self) -> String {
        if self.home {
            format!("{} v {}", self.arsenal.short_name, self.opponent.short_name)
        } else {
            format!("{} v {}", self.opponent.short_name, self.arsenal.short_name)
        }
    }

    /// "Arsenal 2–1 Everton" with the home side first, or None before a score exists.
    pub fn score_line(&self) -> Option<String> {
        let (a, o) = (self.arsenal_goals?, self.opponent_goals?);
        Some(if self.home {
            format!("{} {}–{} {}", self.arsenal.short_name, a, o, self.opponent.short_name)
        } else {
            format!("{} {}–{} {}", self.opponent.short_name, o, a, self.arsenal.short_name)
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
    pub is_arsenal: bool,
}

impl From<&ApiTableRow> for TableRow {
    fn from(r: &ApiTableRow) -> Self {
        Self {
            position: r.position,
            team: (&r.team).into(),
            played: r.played_games,
            won: r.won,
            draw: r.draw,
            lost: r.lost,
            goal_difference: r.goal_difference,
            points: r.points,
            is_arsenal: r.team.id == Some(ARSENAL_ID),
        }
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
